
-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms_days INT NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'IDR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers members read" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "suppliers admins write" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PO STATUS ENUM ============
CREATE TYPE public.po_status AS ENUM ('draft','submitted','approved','partial','received','closed','cancelled');

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_no TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status public.po_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po members read" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "po admins write" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  description TEXT,
  quantity NUMERIC(18,4) NOT NULL,
  quantity_received NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(6,4) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(6,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, line_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT ALL ON public.purchase_order_lines TO service_role;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol members read" ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pol admins write" ON public.purchase_order_lines FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- Numbering counter for PO/GR
CREATE TABLE public.doc_number_counters (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, doc_type)
);
GRANT SELECT ON public.doc_number_counters TO authenticated;
GRANT ALL ON public.doc_number_counters TO service_role;
ALTER TABLE public.doc_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docno members read" ON public.doc_number_counters FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.next_doc_no(_company_id UUID, _doc_type TEXT, _prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN
  INSERT INTO public.doc_number_counters (company_id, doc_type, last_number)
  VALUES (_company_id, _doc_type, 1)
  ON CONFLICT (company_id, doc_type) DO UPDATE SET last_number = doc_number_counters.last_number + 1
  RETURNING last_number INTO n;
  RETURN _prefix || '-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 5, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_doc_no(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_no(UUID,TEXT,TEXT) TO authenticated;

-- ============ GOODS RECEIPTS ============
CREATE TABLE public.goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  gr_no TEXT NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  receipt_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_ref TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, gr_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipts TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr members read" ON public.goods_receipts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "gr admins write" ON public.goods_receipts FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER gr_updated BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES public.purchase_order_lines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(18,4) NOT NULL,
  unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  movement_id UUID REFERENCES public.stock_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipt_lines TO authenticated;
GRANT ALL ON public.goods_receipt_lines TO service_role;
ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grl members read" ON public.goods_receipt_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "grl admins write" ON public.goods_receipt_lines FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- ============ RPC: create purchase order (header + lines, compute totals, assign PO no) ============
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  _company_id UUID,
  _supplier_id UUID,
  _warehouse_id UUID,
  _order_date DATE,
  _expected_date DATE,
  _notes TEXT,
  _lines JSONB   -- [{product_id, quantity, unit_price, discount_pct, tax_pct, description}]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po_id UUID;
  v_po_no TEXT;
  v_line JSONB;
  v_i INT := 0;
  v_line_total NUMERIC(18,4);
  v_gross NUMERIC(18,4);
  v_after_disc NUMERIC(18,4);
  v_tax NUMERIC(18,4);
  v_subtotal NUMERIC(18,4) := 0;
  v_tax_total NUMERIC(18,4) := 0;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'PO must have at least one line'; END IF;

  v_po_no := public.next_doc_no(_company_id, 'purchase_order', 'PO');

  INSERT INTO public.purchase_orders (company_id, po_no, supplier_id, warehouse_id, order_date, expected_date, notes, status, created_by)
  VALUES (_company_id, v_po_no, _supplier_id, _warehouse_id, _order_date, _expected_date, _notes, 'submitted', auth.uid())
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_i := v_i + 1;
    v_gross := (v_line->>'quantity')::NUMERIC * (v_line->>'unit_price')::NUMERIC;
    v_after_disc := v_gross * (1 - COALESCE((v_line->>'discount_pct')::NUMERIC, 0) / 100);
    v_tax := v_after_disc * COALESCE((v_line->>'tax_pct')::NUMERIC, 0) / 100;
    v_line_total := v_after_disc + v_tax;
    v_subtotal := v_subtotal + v_after_disc;
    v_tax_total := v_tax_total + v_tax;

    INSERT INTO public.purchase_order_lines (
      company_id, purchase_order_id, line_no, product_id, description,
      quantity, unit_price, discount_pct, tax_pct, line_total
    ) VALUES (
      _company_id, v_po_id, v_i, (v_line->>'product_id')::UUID, v_line->>'description',
      (v_line->>'quantity')::NUMERIC, (v_line->>'unit_price')::NUMERIC,
      COALESCE((v_line->>'discount_pct')::NUMERIC, 0),
      COALESCE((v_line->>'tax_pct')::NUMERIC, 0),
      v_line_total
    );
  END LOOP;

  UPDATE public.purchase_orders
    SET subtotal = v_subtotal, tax_total = v_tax_total, grand_total = v_subtotal + v_tax_total
    WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_purchase_order(UUID,UUID,UUID,DATE,DATE,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(UUID,UUID,UUID,DATE,DATE,TEXT,JSONB) TO authenticated;

-- ============ RPC: create goods receipt (posts stock in + updates PO line qty + PO status) ============
CREATE OR REPLACE FUNCTION public.create_goods_receipt(
  _company_id UUID,
  _purchase_order_id UUID,
  _supplier_ref TEXT,
  _notes TEXT,
  _lines JSONB   -- [{po_line_id, product_id, quantity, unit_cost}]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gr_id UUID;
  v_gr_no TEXT;
  v_po RECORD;
  v_line JSONB;
  v_mov_id UUID;
  v_all_received BOOLEAN;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'GR must have at least one line'; END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = _purchase_order_id AND company_id = _company_id;
  IF v_po IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.status IN ('cancelled','closed') THEN RAISE EXCEPTION 'PO is closed/cancelled'; END IF;

  v_gr_no := public.next_doc_no(_company_id, 'goods_receipt', 'GR');
  INSERT INTO public.goods_receipts (company_id, gr_no, purchase_order_id, supplier_id, warehouse_id, supplier_ref, notes, created_by)
  VALUES (_company_id, v_gr_no, _purchase_order_id, v_po.supplier_id, v_po.warehouse_id, _supplier_ref, _notes, auth.uid())
  RETURNING id INTO v_gr_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF (v_line->>'quantity')::NUMERIC <= 0 THEN CONTINUE; END IF;

    v_mov_id := public.post_stock_movement(
      _company_id,
      v_po.warehouse_id,
      (v_line->>'product_id')::UUID,
      'in',
      'purchase',
      (v_line->>'quantity')::NUMERIC,
      COALESCE((v_line->>'unit_cost')::NUMERIC, 0),
      now(),
      v_gr_no,
      _notes,
      NULL, NULL
    );

    INSERT INTO public.goods_receipt_lines (
      company_id, goods_receipt_id, purchase_order_line_id, product_id, quantity, unit_cost, movement_id
    ) VALUES (
      _company_id, v_gr_id,
      NULLIF(v_line->>'po_line_id','')::UUID,
      (v_line->>'product_id')::UUID,
      (v_line->>'quantity')::NUMERIC,
      COALESCE((v_line->>'unit_cost')::NUMERIC, 0),
      v_mov_id
    );

    IF (v_line->>'po_line_id') IS NOT NULL AND (v_line->>'po_line_id') <> '' THEN
      UPDATE public.purchase_order_lines
        SET quantity_received = quantity_received + (v_line->>'quantity')::NUMERIC
        WHERE id = (v_line->>'po_line_id')::UUID;
    END IF;
  END LOOP;

  -- Update PO status
  SELECT bool_and(quantity_received >= quantity) INTO v_all_received
    FROM public.purchase_order_lines WHERE purchase_order_id = _purchase_order_id;
  UPDATE public.purchase_orders
    SET status = CASE WHEN v_all_received THEN 'received'::po_status ELSE 'partial'::po_status END
    WHERE id = _purchase_order_id;

  RETURN v_gr_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_goods_receipt(UUID,UUID,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_goods_receipt(UUID,UUID,TEXT,TEXT,JSONB) TO authenticated;
