
-- =========================================================
-- CMS TABLES
-- =========================================================

CREATE TABLE public.cms_landing_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.cms_landing_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_landing_content TO authenticated;
GRANT ALL ON public.cms_landing_content TO service_role;

ALTER TABLE public.cms_landing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read landing content"
  ON public.cms_landing_content FOR SELECT
  USING (true);

CREATE POLICY "Any authenticated admin can manage landing content"
  ON public.cms_landing_content FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','director')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','director')
  ));

CREATE TRIGGER cms_landing_content_updated_at
  BEFORE UPDATE ON public.cms_landing_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blog posts
CREATE TABLE public.cms_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_posts TO authenticated;
GRANT ALL ON public.cms_posts TO service_role;

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published posts"
  ON public.cms_posts FOR SELECT
  USING (status = 'published' OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','director')
  ));

CREATE POLICY "Admins can manage posts"
  ON public.cms_posts FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','director')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','director')
  ));

CREATE TRIGGER cms_posts_updated_at
  BEFORE UPDATE ON public.cms_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial landing content
INSERT INTO public.cms_landing_content (key, value) VALUES
  ('hero', jsonb_build_object(
    'eyebrow', 'AXON ERP',
    'title', 'ERP modular untuk bisnis modern',
    'subtitle', 'Inventory, procurement, sales, dan akuntansi dalam satu platform API-first — tanpa monolit legacy.',
    'ctaPrimary', 'Mulai gratis',
    'ctaSecondary', 'Lihat modul'
  )),
  ('tagline', jsonb_build_object('text', 'Dipercaya SME & mid-market Indonesia')),
  ('cta', jsonb_build_object(
    'title', 'Siap mengganti spreadsheet Anda?',
    'subtitle', 'Setup dalam hitungan menit. Migrasikan data kapan saja.',
    'button', 'Buat akun'
  ))
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- AUTO-POSTING ACCOUNTING
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_account_id(_company_id UUID, _code TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.accounts WHERE company_id = _company_id AND code = _code LIMIT 1
$$;

-- Internal helper: post a JE bypassing admin check (called from other SECURITY DEFINER RPCs)
CREATE OR REPLACE FUNCTION public._post_je_internal(
  _company_id UUID, _entry_date DATE, _memo TEXT,
  _source journal_source, _source_ref TEXT, _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_je_id UUID; v_no TEXT; v_line JSONB; v_i INT := 0;
  v_debit NUMERIC(18,4); v_credit NUMERIC(18,4);
  v_total_debit NUMERIC(18,4) := 0; v_total_credit NUMERIC(18,4) := 0;
BEGIN
  v_no := public.next_doc_no(_company_id, 'journal_entry', 'JE');
  INSERT INTO public.journal_entries (company_id, entry_no, entry_date, source, source_ref, memo, status, created_by)
  VALUES (_company_id, v_no, _entry_date, _source, _source_ref, _memo, 'posted', auth.uid())
  RETURNING id INTO v_je_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_i := v_i + 1;
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);
    IF v_debit = 0 AND v_credit = 0 THEN CONTINUE; END IF;

    INSERT INTO public.journal_lines (company_id, journal_entry_id, line_no, account_id, description, debit, credit)
    VALUES (_company_id, v_je_id, v_i, (v_line->>'account_id')::UUID, v_line->>'description', v_debit, v_credit);

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Auto-JE not balanced: debit %, credit %', v_total_debit, v_total_credit;
  END IF;

  UPDATE public.journal_entries SET total_debit = v_total_debit, total_credit = v_total_credit WHERE id = v_je_id;
  RETURN v_je_id;
END; $$;

-- Rewrite create_goods_receipt with auto-JE
CREATE OR REPLACE FUNCTION public.create_goods_receipt(_company_id uuid, _purchase_order_id uuid, _supplier_ref text, _notes text, _lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gr_id UUID; v_gr_no TEXT; v_po RECORD; v_line JSONB; v_mov_id UUID;
  v_all_received BOOLEAN;
  v_total NUMERIC(18,4) := 0;
  v_inv_acct UUID; v_ap_acct UUID;
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
      _company_id, v_po.warehouse_id, (v_line->>'product_id')::UUID,
      'in', 'purchase', (v_line->>'quantity')::NUMERIC,
      COALESCE((v_line->>'unit_cost')::NUMERIC, 0), now(), v_gr_no, _notes, NULL, NULL
    );

    INSERT INTO public.goods_receipt_lines (company_id, goods_receipt_id, purchase_order_line_id, product_id, quantity, unit_cost, movement_id)
    VALUES (_company_id, v_gr_id, NULLIF(v_line->>'po_line_id','')::UUID,
      (v_line->>'product_id')::UUID, (v_line->>'quantity')::NUMERIC,
      COALESCE((v_line->>'unit_cost')::NUMERIC, 0), v_mov_id);

    v_total := v_total + ((v_line->>'quantity')::NUMERIC * COALESCE((v_line->>'unit_cost')::NUMERIC, 0));

    IF (v_line->>'po_line_id') IS NOT NULL AND (v_line->>'po_line_id') <> '' THEN
      UPDATE public.purchase_order_lines
        SET quantity_received = quantity_received + (v_line->>'quantity')::NUMERIC
        WHERE id = (v_line->>'po_line_id')::UUID;
    END IF;
  END LOOP;

  SELECT bool_and(quantity_received >= quantity) INTO v_all_received
    FROM public.purchase_order_lines WHERE purchase_order_id = _purchase_order_id;
  UPDATE public.purchase_orders
    SET status = CASE WHEN v_all_received THEN 'received'::po_status ELSE 'partial'::po_status END
    WHERE id = _purchase_order_id;

  -- Auto-JE: Dr Persediaan (1300), Cr Utang Usaha (2100)
  IF v_total > 0 THEN
    v_inv_acct := public.get_account_id(_company_id, '1300');
    v_ap_acct  := public.get_account_id(_company_id, '2100');
    IF v_inv_acct IS NOT NULL AND v_ap_acct IS NOT NULL THEN
      PERFORM public._post_je_internal(_company_id, CURRENT_DATE,
        'Goods Receipt ' || v_gr_no, 'purchase', v_gr_no,
        jsonb_build_array(
          jsonb_build_object('account_id', v_inv_acct, 'debit', v_total, 'credit', 0, 'description', 'Persediaan masuk'),
          jsonb_build_object('account_id', v_ap_acct,  'debit', 0, 'credit', v_total, 'description', 'Utang usaha ke supplier')
        ));
    END IF;
  END IF;

  RETURN v_gr_id;
END;
$function$;

-- Rewrite create_delivery_order with COGS auto-JE
CREATE OR REPLACE FUNCTION public.create_delivery_order(_company_id uuid, _sales_order_id uuid, _carrier text, _tracking_no text, _notes text, _lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_do_id UUID; v_do_no TEXT; v_so RECORD; v_line JSONB; v_mov UUID;
  v_all BOOLEAN; v_any BOOLEAN;
  v_avg NUMERIC(18,4);
  v_cogs_total NUMERIC(18,4) := 0;
  v_cogs_acct UUID; v_inv_acct UUID;
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

    v_cogs_total := v_cogs_total + ((v_line->>'quantity')::NUMERIC * COALESCE(v_avg, 0));

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

  -- Auto-JE: Dr HPP (5100), Cr Persediaan (1300)
  IF v_cogs_total > 0 THEN
    v_cogs_acct := public.get_account_id(_company_id, '5100');
    v_inv_acct  := public.get_account_id(_company_id, '1300');
    IF v_cogs_acct IS NOT NULL AND v_inv_acct IS NOT NULL THEN
      PERFORM public._post_je_internal(_company_id, CURRENT_DATE,
        'HPP dari Delivery ' || v_do_no, 'sales', v_do_no,
        jsonb_build_array(
          jsonb_build_object('account_id', v_cogs_acct, 'debit', v_cogs_total, 'credit', 0, 'description', 'HPP penjualan'),
          jsonb_build_object('account_id', v_inv_acct,  'debit', 0, 'credit', v_cogs_total, 'description', 'Persediaan keluar')
        ));
    END IF;
  END IF;

  RETURN v_do_id;
END; $function$;

-- Rewrite create_customer_invoice with Revenue auto-JE
CREATE OR REPLACE FUNCTION public.create_customer_invoice(_company_id uuid, _sales_order_id uuid, _invoice_date date, _due_date date, _notes text, _lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv_id UUID; v_inv_no TEXT; v_so RECORD; v_line JSONB; v_i INT := 0;
  v_gross NUMERIC(18,4); v_after_disc NUMERIC(18,4); v_tax NUMERIC(18,4); v_line_total NUMERIC(18,4);
  v_subtotal NUMERIC(18,4) := 0; v_tax_total NUMERIC(18,4) := 0;
  v_ar_acct UUID; v_rev_acct UUID; v_vat_out_acct UUID;
  v_je_lines JSONB;
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

  -- Auto-JE: Dr Piutang, Cr Penjualan, Cr PPN Keluaran
  IF (v_subtotal + v_tax_total) > 0 THEN
    v_ar_acct      := public.get_account_id(_company_id, '1200');
    v_rev_acct     := public.get_account_id(_company_id, '4100');
    v_vat_out_acct := public.get_account_id(_company_id, '2200');
    IF v_ar_acct IS NOT NULL AND v_rev_acct IS NOT NULL THEN
      v_je_lines := jsonb_build_array(
        jsonb_build_object('account_id', v_ar_acct,  'debit', v_subtotal + v_tax_total, 'credit', 0, 'description', 'Piutang customer'),
        jsonb_build_object('account_id', v_rev_acct, 'debit', 0, 'credit', v_subtotal, 'description', 'Pendapatan penjualan')
      );
      IF v_tax_total > 0 AND v_vat_out_acct IS NOT NULL THEN
        v_je_lines := v_je_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_vat_out_acct, 'debit', 0, 'credit', v_tax_total, 'description', 'PPN Keluaran')
        );
      END IF;
      PERFORM public._post_je_internal(_company_id, _invoice_date,
        'Invoice ' || v_inv_no, 'sales', v_inv_no, v_je_lines);
    END IF;
  END IF;

  RETURN v_inv_id;
END; $function$;
