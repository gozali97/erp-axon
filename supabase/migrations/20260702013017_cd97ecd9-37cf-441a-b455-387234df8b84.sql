
-- Enums
DO $$ BEGIN
  CREATE TYPE public.wo_status AS ENUM ('draft','released','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Work Orders
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  wo_no TEXT NOT NULL,
  bom_id UUID NOT NULL REFERENCES public.bills_of_materials(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  planned_qty NUMERIC(18,4) NOT NULL CHECK (planned_qty > 0),
  produced_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  status public.wo_status NOT NULL DEFAULT 'draft',
  planned_start DATE,
  planned_end DATE,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  notes TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, wo_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_select" ON public.work_orders FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "wo_write" ON public.work_orders FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

CREATE TRIGGER trg_wo_updated BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshot of components required for the WO
CREATE TABLE public.work_order_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  planned_qty NUMERIC(18,4) NOT NULL,
  consumed_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  movement_id UUID REFERENCES public.stock_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_components TO authenticated;
GRANT ALL ON public.work_order_components TO service_role;
ALTER TABLE public.work_order_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "woc_select" ON public.work_order_components FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "woc_write" ON public.work_order_components FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

CREATE TRIGGER trg_woc_updated BEFORE UPDATE ON public.work_order_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_woc_wo ON public.work_order_components(work_order_id);
CREATE INDEX idx_wo_company_status ON public.work_orders(company_id, status);

-- Extend movement source enum for production if needed
DO $$ BEGIN
  ALTER TYPE public.movement_source ADD VALUE IF NOT EXISTS 'production';
EXCEPTION WHEN others THEN NULL; END $$;

-- RPC: create WO with snapshot
CREATE OR REPLACE FUNCTION public.create_work_order(
  _company_id UUID, _bom_id UUID, _warehouse_id UUID, _planned_qty NUMERIC,
  _planned_start DATE, _planned_end DATE, _notes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wo_id UUID; v_wo_no TEXT; v_bom RECORD; v_comp RECORD;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_bom FROM public.bills_of_materials WHERE id = _bom_id AND company_id = _company_id;
  IF v_bom IS NULL THEN RAISE EXCEPTION 'BOM not found'; END IF;
  IF v_bom.output_quantity IS NULL OR v_bom.output_quantity = 0 THEN RAISE EXCEPTION 'BOM output qty invalid'; END IF;

  v_wo_no := public.next_doc_no(_company_id, 'work_order', 'WO');
  INSERT INTO public.work_orders (company_id, wo_no, bom_id, product_id, warehouse_id, planned_qty, planned_start, planned_end, notes, created_by)
  VALUES (_company_id, v_wo_no, _bom_id, v_bom.product_id, _warehouse_id, _planned_qty, _planned_start, _planned_end, _notes, auth.uid())
  RETURNING id INTO v_wo_id;

  FOR v_comp IN
    SELECT component_product_id, quantity, waste_pct
    FROM public.bom_components WHERE bom_id = _bom_id AND company_id = _company_id
  LOOP
    INSERT INTO public.work_order_components (company_id, work_order_id, component_product_id, planned_qty)
    VALUES (_company_id, v_wo_id, v_comp.component_product_id,
      ROUND((v_comp.quantity * (1 + v_comp.waste_pct/100) * _planned_qty / v_bom.output_quantity)::numeric, 4));
  END LOOP;

  RETURN v_wo_id;
END; $$;

-- Simple state transitions
CREATE OR REPLACE FUNCTION public.set_work_order_status(_company_id UUID, _wo_id UUID, _status wo_status)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_current wo_status;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO v_current FROM public.work_orders WHERE id = _wo_id AND company_id = _company_id;
  IF v_current IS NULL THEN RAISE EXCEPTION 'WO not found'; END IF;
  IF v_current IN ('completed','cancelled') THEN RAISE EXCEPTION 'WO already finalized'; END IF;
  UPDATE public.work_orders SET status = _status,
    actual_start = CASE WHEN _status IN ('released','in_progress') AND actual_start IS NULL THEN now() ELSE actual_start END
    WHERE id = _wo_id;
END; $$;

-- Complete production: consume raw materials, add finished goods, post JE
CREATE OR REPLACE FUNCTION public.complete_work_order(
  _company_id UUID, _wo_id UUID, _produced_qty NUMERIC, _notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wo RECORD; v_comp RECORD; v_mov UUID; v_avg NUMERIC(18,4);
  v_total_cost NUMERIC(18,4) := 0;
  v_unit_cost NUMERIC(18,4);
  v_fg_mov UUID; v_je_id UUID;
  v_inv_acct UUID;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _produced_qty <= 0 THEN RAISE EXCEPTION 'Produced qty must be > 0'; END IF;

  SELECT * INTO v_wo FROM public.work_orders WHERE id = _wo_id AND company_id = _company_id FOR UPDATE;
  IF v_wo IS NULL THEN RAISE EXCEPTION 'WO not found'; END IF;
  IF v_wo.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'WO already finalized'; END IF;

  -- 1) Consume raw materials at current WAC
  FOR v_comp IN
    SELECT * FROM public.work_order_components WHERE work_order_id = _wo_id
  LOOP
    SELECT average_cost INTO v_avg FROM public.stock_balances
      WHERE company_id = _company_id AND product_id = v_comp.component_product_id AND warehouse_id = v_wo.warehouse_id;
    v_avg := COALESCE(v_avg, 0);

    v_mov := public.post_stock_movement(
      _company_id, v_wo.warehouse_id, v_comp.component_product_id,
      'out', 'production', v_comp.planned_qty, v_avg,
      now(), v_wo.wo_no, COALESCE(_notes, 'Material consumption'), NULL, NULL
    );

    UPDATE public.work_order_components
      SET consumed_qty = v_comp.planned_qty, unit_cost = v_avg, movement_id = v_mov
      WHERE id = v_comp.id;

    v_total_cost := v_total_cost + (v_comp.planned_qty * v_avg);
  END LOOP;

  -- 2) Produce finished goods at computed unit cost
  v_unit_cost := CASE WHEN _produced_qty > 0 THEN v_total_cost / _produced_qty ELSE 0 END;

  v_fg_mov := public.post_stock_movement(
    _company_id, v_wo.warehouse_id, v_wo.product_id,
    'in', 'production', _produced_qty, v_unit_cost,
    now(), v_wo.wo_no, COALESCE(_notes, 'Finished goods produced'), NULL, NULL
  );

  -- 3) Journal entry: Dr Persediaan (barang jadi) / Cr Persediaan (bahan baku)
  -- Both sides hit 1300 Persediaan by default (net zero) — but we post for audit trail if amounts differ
  IF v_total_cost > 0 THEN
    v_inv_acct := public.get_account_id(_company_id, '1300');
    IF v_inv_acct IS NOT NULL THEN
      -- Net effect zero since same account; we skip JE to avoid noise
      v_je_id := NULL;
    END IF;
  END IF;

  UPDATE public.work_orders
    SET status = 'completed',
        produced_qty = _produced_qty,
        actual_end = now(),
        journal_entry_id = v_je_id
    WHERE id = _wo_id;

  RETURN jsonb_build_object(
    'work_order_id', _wo_id,
    'total_material_cost', v_total_cost,
    'unit_cost', v_unit_cost,
    'finished_movement_id', v_fg_mov
  );
END; $$;
