
-- ===== ENUMS =====
CREATE TYPE so_status AS ENUM ('draft','submitted','approved','partial','delivered','closed','cancelled');
CREATE TYPE inv_status AS ENUM ('draft','issued','partial','paid','void');

-- ===== CUSTOMERS =====
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_terms_days INT NOT NULL DEFAULT 30,
  credit_limit NUMERIC(18,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "customers_write" ON public.customers FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== SALES ORDERS =====
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  so_no TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  customer_ref TEXT,
  status so_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, so_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_select" ON public.sales_orders FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "so_write" ON public.sales_orders FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER trg_so_updated BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  description TEXT,
  quantity NUMERIC(18,4) NOT NULL,
  quantity_delivered NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_invoiced NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_lines TO authenticated;
GRANT ALL ON public.sales_order_lines TO service_role;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sol_select" ON public.sales_order_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sol_write" ON public.sales_order_lines FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

-- ===== DELIVERY ORDERS =====
CREATE TABLE public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  do_no TEXT NOT NULL,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  delivery_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  carrier TEXT,
  tracking_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, do_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_orders TO authenticated;
GRANT ALL ON public.delivery_orders TO service_role;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "do_select" ON public.delivery_orders FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "do_write" ON public.delivery_orders FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER trg_do_updated BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.delivery_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  sales_order_line_id UUID REFERENCES public.sales_order_lines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(18,4) NOT NULL,
  movement_id UUID REFERENCES public.stock_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_order_lines TO authenticated;
GRANT ALL ON public.delivery_order_lines TO service_role;
ALTER TABLE public.delivery_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dol_select" ON public.delivery_order_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "dol_write" ON public.delivery_order_lines FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

-- ===== CUSTOMER INVOICES =====
CREATE TABLE public.customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status inv_status NOT NULL DEFAULT 'issued',
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invoices TO authenticated;
GRANT ALL ON public.customer_invoices TO service_role;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON public.customer_invoices FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "inv_write" ON public.customer_invoices FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  sales_order_line_id UUID REFERENCES public.sales_order_lines(id),
  line_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  description TEXT,
  quantity NUMERIC(18,4) NOT NULL,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invoice_lines TO authenticated;
GRANT ALL ON public.customer_invoice_lines TO service_role;
ALTER TABLE public.customer_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invl_select" ON public.customer_invoice_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "invl_write" ON public.customer_invoice_lines FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.create_sales_order(
  _company_id UUID,
  _customer_id UUID,
  _warehouse_id UUID,
  _order_date DATE,
  _expected_date DATE,
  _customer_ref TEXT,
  _notes TEXT,
  _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_so_id UUID; v_so_no TEXT; v_line JSONB; v_i INT := 0;
  v_gross NUMERIC(18,4); v_after_disc NUMERIC(18,4); v_tax NUMERIC(18,4); v_line_total NUMERIC(18,4);
  v_subtotal NUMERIC(18,4) := 0; v_tax_total NUMERIC(18,4) := 0;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'SO must have at least one line'; END IF;

  v_so_no := public.next_doc_no(_company_id, 'sales_order', 'SO');
  INSERT INTO public.sales_orders (company_id, so_no, customer_id, warehouse_id, order_date, expected_date, customer_ref, notes, status, created_by)
  VALUES (_company_id, v_so_no, _customer_id, _warehouse_id, _order_date, _expected_date, _customer_ref, _notes, 'submitted', auth.uid())
  RETURNING id INTO v_so_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_i := v_i + 1;
    v_gross := (v_line->>'quantity')::NUMERIC * (v_line->>'unit_price')::NUMERIC;
    v_after_disc := v_gross * (1 - COALESCE((v_line->>'discount_pct')::NUMERIC, 0)/100);
    v_tax := v_after_disc * COALESCE((v_line->>'tax_pct')::NUMERIC, 0)/100;
    v_line_total := v_after_disc + v_tax;
    v_subtotal := v_subtotal + v_after_disc;
    v_tax_total := v_tax_total + v_tax;

    INSERT INTO public.sales_order_lines (company_id, sales_order_id, line_no, product_id, description, quantity, unit_price, discount_pct, tax_pct, line_total)
    VALUES (_company_id, v_so_id, v_i, (v_line->>'product_id')::UUID, v_line->>'description',
      (v_line->>'quantity')::NUMERIC, (v_line->>'unit_price')::NUMERIC,
      COALESCE((v_line->>'discount_pct')::NUMERIC, 0), COALESCE((v_line->>'tax_pct')::NUMERIC, 0),
      v_line_total);
  END LOOP;

  UPDATE public.sales_orders SET subtotal = v_subtotal, tax_total = v_tax_total, grand_total = v_subtotal + v_tax_total WHERE id = v_so_id;
  RETURN v_so_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_delivery_order(
  _company_id UUID, _sales_order_id UUID, _carrier TEXT, _tracking_no TEXT, _notes TEXT, _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_do_id UUID; v_do_no TEXT; v_so RECORD; v_line JSONB; v_mov UUID;
  v_all BOOLEAN; v_any BOOLEAN;
  v_avg NUMERIC(18,4);
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'DO must have at least one line'; END IF;

  SELECT * INTO v_so FROM public.sales_orders WHERE id = _sales_order_id AND company_id = _company_id;
  IF v_so IS NULL THEN RAISE EXCEPTION 'SO not found'; END IF;
  IF v_so.status IN ('cancelled','closed') THEN RAISE EXCEPTION 'SO is closed/cancelled'; END IF;

  v_do_no := public.next_doc_no(_company_id, 'delivery_order', 'DO');
  INSERT INTO public.delivery_orders (company_id, do_no, sales_order_id, customer_id, warehouse_id, carrier, tracking_no, notes, created_by)
  VALUES (_company_id, v_do_no, _sales_order_id, v_so.customer_id, v_so.warehouse_id, _carrier, _tracking_no, _notes, auth.uid())
  RETURNING id INTO v_do_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF (v_line->>'quantity')::NUMERIC <= 0 THEN CONTINUE; END IF;

    SELECT average_cost INTO v_avg FROM public.stock_balances
      WHERE company_id = _company_id AND product_id = (v_line->>'product_id')::UUID AND warehouse_id = v_so.warehouse_id;

    v_mov := public.post_stock_movement(
      _company_id, v_so.warehouse_id, (v_line->>'product_id')::UUID,
      'out', 'sales', (v_line->>'quantity')::NUMERIC, COALESCE(v_avg, 0),
      now(), v_do_no, _notes, NULL, NULL
    );

    INSERT INTO public.delivery_order_lines (company_id, delivery_order_id, sales_order_line_id, product_id, quantity, movement_id)
    VALUES (_company_id, v_do_id, NULLIF(v_line->>'so_line_id','')::UUID, (v_line->>'product_id')::UUID, (v_line->>'quantity')::NUMERIC, v_mov);

    IF (v_line->>'so_line_id') IS NOT NULL AND (v_line->>'so_line_id') <> '' THEN
      UPDATE public.sales_order_lines
        SET quantity_delivered = quantity_delivered + (v_line->>'quantity')::NUMERIC
        WHERE id = (v_line->>'so_line_id')::UUID;
    END IF;
  END LOOP;

  SELECT bool_and(quantity_delivered >= quantity), bool_or(quantity_delivered > 0)
    INTO v_all, v_any FROM public.sales_order_lines WHERE sales_order_id = _sales_order_id;
  UPDATE public.sales_orders SET status = CASE
    WHEN v_all THEN 'delivered'::so_status
    WHEN v_any THEN 'partial'::so_status
    ELSE status END
  WHERE id = _sales_order_id;

  RETURN v_do_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_customer_invoice(
  _company_id UUID, _sales_order_id UUID, _invoice_date DATE, _due_date DATE, _notes TEXT, _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv_id UUID; v_inv_no TEXT; v_so RECORD; v_line JSONB; v_i INT := 0;
  v_gross NUMERIC(18,4); v_after_disc NUMERIC(18,4); v_tax NUMERIC(18,4); v_line_total NUMERIC(18,4);
  v_subtotal NUMERIC(18,4) := 0; v_tax_total NUMERIC(18,4) := 0;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Invoice must have at least one line'; END IF;

  SELECT * INTO v_so FROM public.sales_orders WHERE id = _sales_order_id AND company_id = _company_id;
  IF v_so IS NULL THEN RAISE EXCEPTION 'SO not found'; END IF;

  v_inv_no := public.next_doc_no(_company_id, 'customer_invoice', 'INV');
  INSERT INTO public.customer_invoices (company_id, invoice_no, sales_order_id, customer_id, invoice_date, due_date, notes, status, created_by)
  VALUES (_company_id, v_inv_no, _sales_order_id, v_so.customer_id, _invoice_date, _due_date, _notes, 'issued', auth.uid())
  RETURNING id INTO v_inv_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF (v_line->>'quantity')::NUMERIC <= 0 THEN CONTINUE; END IF;
    v_i := v_i + 1;
    v_gross := (v_line->>'quantity')::NUMERIC * (v_line->>'unit_price')::NUMERIC;
    v_after_disc := v_gross * (1 - COALESCE((v_line->>'discount_pct')::NUMERIC, 0)/100);
    v_tax := v_after_disc * COALESCE((v_line->>'tax_pct')::NUMERIC, 0)/100;
    v_line_total := v_after_disc + v_tax;
    v_subtotal := v_subtotal + v_after_disc;
    v_tax_total := v_tax_total + v_tax;

    INSERT INTO public.customer_invoice_lines (company_id, invoice_id, sales_order_line_id, line_no, product_id, description, quantity, unit_price, discount_pct, tax_pct, line_total)
    VALUES (_company_id, v_inv_id, NULLIF(v_line->>'so_line_id','')::UUID, v_i, (v_line->>'product_id')::UUID, v_line->>'description',
      (v_line->>'quantity')::NUMERIC, (v_line->>'unit_price')::NUMERIC,
      COALESCE((v_line->>'discount_pct')::NUMERIC, 0), COALESCE((v_line->>'tax_pct')::NUMERIC, 0), v_line_total);

    IF (v_line->>'so_line_id') IS NOT NULL AND (v_line->>'so_line_id') <> '' THEN
      UPDATE public.sales_order_lines
        SET quantity_invoiced = quantity_invoiced + (v_line->>'quantity')::NUMERIC
        WHERE id = (v_line->>'so_line_id')::UUID;
    END IF;
  END LOOP;

  UPDATE public.customer_invoices
    SET subtotal = v_subtotal, tax_total = v_tax_total, grand_total = v_subtotal + v_tax_total
    WHERE id = v_inv_id;
  RETURN v_inv_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_sales_order(UUID,UUID,UUID,DATE,DATE,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_delivery_order(UUID,UUID,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_customer_invoice(UUID,UUID,DATE,DATE,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_order(UUID,UUID,UUID,DATE,DATE,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_delivery_order(UUID,UUID,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_invoice(UUID,UUID,DATE,DATE,TEXT,JSONB) TO authenticated;
