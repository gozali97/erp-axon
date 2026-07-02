
-- Sequence for movement numbering per company (simple: yearly reset later)
CREATE TABLE IF NOT EXISTS public.movement_number_counters (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.movement_number_counters TO authenticated;
GRANT ALL ON public.movement_number_counters TO service_role;
ALTER TABLE public.movement_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters read by members" ON public.movement_number_counters
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));

-- Generate next movement number: MV-YYYYMM-000001
CREATE OR REPLACE FUNCTION public.next_movement_no(_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN
  INSERT INTO public.movement_number_counters (company_id, last_number)
  VALUES (_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET last_number = movement_number_counters.last_number + 1
  RETURNING last_number INTO n;
  RETURN 'MV-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_movement_no(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_movement_no(UUID) TO authenticated;

-- Post a stock movement + update balance atomically
CREATE OR REPLACE FUNCTION public.post_stock_movement(
  _company_id UUID,
  _warehouse_id UUID,
  _product_id UUID,
  _movement_type movement_type,
  _source movement_source,
  _quantity NUMERIC,
  _unit_cost NUMERIC DEFAULT 0,
  _movement_date TIMESTAMPTZ DEFAULT now(),
  _source_ref TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _counterparty_warehouse_id UUID DEFAULT NULL,
  _batch_no TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_movement_id UUID;
  v_base_unit UUID;
  v_no TEXT;
  v_signed_qty NUMERIC;
  v_current_qty NUMERIC;
  v_current_avg NUMERIC;
  v_new_qty NUMERIC;
  v_new_avg NUMERIC;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized to post movements for this company';
  END IF;
  IF _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  SELECT base_unit_id INTO v_base_unit FROM public.products WHERE id = _product_id AND company_id = _company_id;
  IF v_base_unit IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;

  -- +qty for in / transfer_in, -qty for out / transfer_out; adjustment/opname can be +/-
  v_signed_qty := CASE _movement_type
    WHEN 'in' THEN _quantity
    WHEN 'transfer_in' THEN _quantity
    WHEN 'out' THEN -_quantity
    WHEN 'transfer_out' THEN -_quantity
    ELSE _quantity  -- adjustment / opname: caller passes signed via sign of _quantity? we treat as delta; use signed via source_ref convention -> keep positive & rely on caller specifying type
  END;

  v_no := public.next_movement_no(_company_id);

  INSERT INTO public.stock_movements (
    company_id, movement_no, movement_date, movement_type, source, source_ref,
    product_id, warehouse_id, counterparty_warehouse_id, quantity, unit_id,
    quantity_base, unit_cost, total_cost, batch_no, notes, created_by
  ) VALUES (
    _company_id, v_no, _movement_date, _movement_type, _source, _source_ref,
    _product_id, _warehouse_id, _counterparty_warehouse_id, _quantity, v_base_unit,
    _quantity, _unit_cost, _quantity * _unit_cost, _batch_no, _notes, auth.uid()
  ) RETURNING id INTO v_movement_id;

  -- Lock/get current balance
  SELECT quantity_on_hand, average_cost INTO v_current_qty, v_current_avg
  FROM public.stock_balances
  WHERE company_id = _company_id AND product_id = _product_id AND warehouse_id = _warehouse_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_current_qty := 0; v_current_avg := 0;
  END IF;

  v_new_qty := v_current_qty + v_signed_qty;

  -- Weighted average only on inbound with positive cost
  IF v_signed_qty > 0 AND _unit_cost > 0 THEN
    IF v_new_qty > 0 THEN
      v_new_avg := ((v_current_qty * v_current_avg) + (v_signed_qty * _unit_cost)) / v_new_qty;
    ELSE
      v_new_avg := _unit_cost;
    END IF;
  ELSE
    v_new_avg := v_current_avg;
  END IF;

  INSERT INTO public.stock_balances (
    company_id, product_id, warehouse_id, quantity_on_hand, average_cost, last_movement_at
  ) VALUES (_company_id, _product_id, _warehouse_id, v_new_qty, v_new_avg, now())
  ON CONFLICT (company_id, product_id, warehouse_id) DO UPDATE
    SET quantity_on_hand = EXCLUDED.quantity_on_hand,
        average_cost = EXCLUDED.average_cost,
        last_movement_at = now(),
        updated_at = now();

  RETURN v_movement_id;
END;
$$;
REVOKE ALL ON FUNCTION public.post_stock_movement(UUID,UUID,UUID,movement_type,movement_source,NUMERIC,NUMERIC,TIMESTAMPTZ,TEXT,TEXT,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_movement(UUID,UUID,UUID,movement_type,movement_source,NUMERIC,NUMERIC,TIMESTAMPTZ,TEXT,TEXT,UUID,TEXT) TO authenticated;

-- Ensure unique constraint for the ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_balances_company_product_wh_key'
  ) THEN
    ALTER TABLE public.stock_balances
      ADD CONSTRAINT stock_balances_company_product_wh_key UNIQUE (company_id, product_id, warehouse_id);
  END IF;
END $$;

-- Transfer helper: 2 movements in one txn
CREATE OR REPLACE FUNCTION public.post_stock_transfer(
  _company_id UUID, _product_id UUID, _from_warehouse UUID, _to_warehouse UUID,
  _quantity NUMERIC, _unit_cost NUMERIC DEFAULT 0, _movement_date TIMESTAMPTZ DEFAULT now(),
  _notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out UUID; v_avg NUMERIC; v_cost NUMERIC;
BEGIN
  IF _from_warehouse = _to_warehouse THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;
  -- Use current avg cost of source for the transfer valuation
  SELECT average_cost INTO v_avg FROM public.stock_balances
    WHERE company_id=_company_id AND product_id=_product_id AND warehouse_id=_from_warehouse;
  v_cost := COALESCE(NULLIF(_unit_cost,0), v_avg, 0);
  v_out := public.post_stock_movement(_company_id,_from_warehouse,_product_id,'transfer_out','transfer',_quantity,v_cost,_movement_date,NULL,_notes,_to_warehouse,NULL);
  PERFORM public.post_stock_movement(_company_id,_to_warehouse,_product_id,'transfer_in','transfer',_quantity,v_cost,_movement_date,v_out::text,_notes,_from_warehouse,NULL);
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.post_stock_transfer(UUID,UUID,UUID,UUID,NUMERIC,NUMERIC,TIMESTAMPTZ,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_transfer(UUID,UUID,UUID,UUID,NUMERIC,NUMERIC,TIMESTAMPTZ,TEXT) TO authenticated;

-- Adjustment helper (signed delta)
CREATE OR REPLACE FUNCTION public.post_stock_adjustment(
  _company_id UUID, _warehouse_id UUID, _product_id UUID,
  _delta NUMERIC, _unit_cost NUMERIC DEFAULT 0, _notes TEXT DEFAULT NULL,
  _source movement_source DEFAULT 'adjustment'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type movement_type; v_qty NUMERIC;
BEGIN
  IF _delta = 0 THEN RAISE EXCEPTION 'Delta cannot be zero'; END IF;
  IF _delta > 0 THEN v_type := 'in'; v_qty := _delta;
  ELSE v_type := 'out'; v_qty := -_delta; END IF;
  RETURN public.post_stock_movement(_company_id,_warehouse_id,_product_id,v_type,_source,v_qty,_unit_cost,now(),NULL,_notes,NULL,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.post_stock_adjustment(UUID,UUID,UUID,NUMERIC,NUMERIC,TEXT,movement_source) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(UUID,UUID,UUID,NUMERIC,NUMERIC,TEXT,movement_source) TO authenticated;
