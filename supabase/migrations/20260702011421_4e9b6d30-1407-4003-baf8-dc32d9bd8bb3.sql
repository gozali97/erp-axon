
-- POS Module: payment methods, payment log, and RPC to create a POS sale in one shot.

DO $$ BEGIN
  CREATE TYPE public.pos_payment_method AS ENUM ('cash','card','transfer','qris','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pos_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  payment_no TEXT NOT NULL,
  method public.pos_payment_method NOT NULL DEFAULT 'cash',
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  reference TEXT,
  cash_account_id UUID REFERENCES public.accounts(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, payment_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_payments TO authenticated;
GRANT ALL ON public.pos_payments TO service_role;

ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_payments members read" ON public.pos_payments
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "pos_payments managers write" ON public.pos_payments
  FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

CREATE TRIGGER pos_payments_updated_at BEFORE UPDATE ON public.pos_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: get or create the "Walk-in Customer" for a company (used when no customer selected)
CREATE OR REPLACE FUNCTION public.get_or_create_walkin_customer(_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.customers
    WHERE company_id = _company_id AND code = 'WALKIN' LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.customers (company_id, code, name, payment_terms_days, is_active, created_by)
  VALUES (_company_id, 'WALKIN', 'Walk-in Customer', 0, true, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Main POS RPC: creates SO + DO (stock out + COGS JE) + Invoice (AR/Revenue/VAT JE)
-- + records payment (settles AR, marks invoice paid if fully paid).
CREATE OR REPLACE FUNCTION public.create_pos_sale(
  _company_id UUID,
  _warehouse_id UUID,
  _customer_id UUID,          -- NULL = walk-in
  _sale_date DATE,
  _lines JSONB,               -- [{product_id, quantity, unit_price, discount_pct, tax_pct, description}]
  _payment_method public.pos_payment_method,
  _amount_paid NUMERIC,
  _cash_account_code TEXT,    -- e.g. '1100' Kas, '1110' Bank
  _payment_reference TEXT,
  _notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_so_id UUID; v_do_id UUID; v_inv_id UUID;
  v_inv RECORD;
  v_pay_no TEXT;
  v_pay_id UUID;
  v_cash_acct UUID; v_ar_acct UUID;
  v_je_id UUID;
  v_do_lines JSONB := '[]'::jsonb;
  v_inv_lines JSONB := '[]'::jsonb;
  v_so_line RECORD;
BEGIN
  IF NOT public.can_manage_inventory(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'POS sale must have at least one line'; END IF;

  v_customer_id := COALESCE(_customer_id, public.get_or_create_walkin_customer(_company_id));

  -- 1) Sales Order
  v_so_id := public.create_sales_order(
    _company_id, v_customer_id, _warehouse_id,
    _sale_date, _sale_date, 'POS', _notes, _lines
  );

  -- Build DO + Invoice line arrays from the created SO lines (need so_line_id)
  FOR v_so_line IN
    SELECT id, product_id, quantity, unit_price, discount_pct, tax_pct, description
    FROM public.sales_order_lines
    WHERE sales_order_id = v_so_id
    ORDER BY line_no
  LOOP
    v_do_lines := v_do_lines || jsonb_build_array(jsonb_build_object(
      'so_line_id', v_so_line.id,
      'product_id', v_so_line.product_id,
      'quantity',   v_so_line.quantity
    ));
    v_inv_lines := v_inv_lines || jsonb_build_array(jsonb_build_object(
      'so_line_id',   v_so_line.id,
      'product_id',   v_so_line.product_id,
      'description',  v_so_line.description,
      'quantity',     v_so_line.quantity,
      'unit_price',   v_so_line.unit_price,
      'discount_pct', v_so_line.discount_pct,
      'tax_pct',      v_so_line.tax_pct
    ));
  END LOOP;

  -- 2) Delivery Order (posts stock-out and HPP/Persediaan JE)
  v_do_id := public.create_delivery_order(
    _company_id, v_so_id, 'POS', NULL, _notes, v_do_lines
  );

  -- 3) Customer Invoice (posts AR/Penjualan/PPN JE)
  v_inv_id := public.create_customer_invoice(
    _company_id, v_so_id, _sale_date, _sale_date, _notes, v_inv_lines
  );

  SELECT * INTO v_inv FROM public.customer_invoices WHERE id = v_inv_id;

  -- 4) Payment: record and post JE Dr Kas/Bank, Cr Piutang
  IF _amount_paid > 0 THEN
    v_cash_acct := public.get_account_id(_company_id, COALESCE(_cash_account_code, '1100'));
    v_ar_acct   := public.get_account_id(_company_id, '1200');

    v_pay_no := public.next_doc_no(_company_id, 'pos_payment', 'PAY');

    IF v_cash_acct IS NOT NULL AND v_ar_acct IS NOT NULL THEN
      v_je_id := public._post_je_internal(
        _company_id, _sale_date,
        'POS Payment ' || v_pay_no || ' for ' || v_inv.invoice_no,
        'sales', v_pay_no,
        jsonb_build_array(
          jsonb_build_object('account_id', v_cash_acct, 'debit', _amount_paid, 'credit', 0, 'description', 'Penerimaan kas POS'),
          jsonb_build_object('account_id', v_ar_acct,   'debit', 0, 'credit', _amount_paid, 'description', 'Pelunasan piutang')
        )
      );
    END IF;

    INSERT INTO public.pos_payments (company_id, invoice_id, payment_no, method, amount, reference, cash_account_id, journal_entry_id, paid_at, created_by)
    VALUES (_company_id, v_inv_id, v_pay_no, _payment_method, _amount_paid, _payment_reference, v_cash_acct, v_je_id, now(), auth.uid())
    RETURNING id INTO v_pay_id;

    UPDATE public.customer_invoices
      SET amount_paid = amount_paid + _amount_paid,
          status = CASE WHEN (amount_paid + _amount_paid) >= grand_total THEN 'paid'::inv_status ELSE status END
      WHERE id = v_inv_id;
  END IF;

  -- Close the SO (fully delivered + invoiced)
  UPDATE public.sales_orders SET status = 'closed'::so_status WHERE id = v_so_id;

  RETURN jsonb_build_object(
    'sales_order_id', v_so_id,
    'delivery_order_id', v_do_id,
    'invoice_id', v_inv_id,
    'invoice_no', v_inv.invoice_no,
    'grand_total', v_inv.grand_total,
    'amount_paid', _amount_paid,
    'change', GREATEST(_amount_paid - v_inv.grand_total, 0),
    'payment_id', v_pay_id,
    'payment_no', v_pay_no
  );
END $$;
