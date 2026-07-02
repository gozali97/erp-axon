
-- Enums
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');
CREATE TYPE public.normal_balance AS ENUM ('debit','credit');
CREATE TYPE public.journal_status AS ENUM ('draft','posted','void');
CREATE TYPE public.journal_source AS ENUM ('manual','sales','purchase','inventory','payment','opening');

-- Chart of Accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_group BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX ON public.accounts (company_id, account_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON public.accounts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "accounts_write" ON public.accounts FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Journal Entries
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_no TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source journal_source NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  memo TEXT,
  status journal_status NOT NULL DEFAULT 'posted',
  total_debit NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, entry_no)
);
CREATE INDEX ON public.journal_entries (company_id, entry_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "je_select" ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "je_write" ON public.journal_entries FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  description TEXT,
  debit NUMERIC(18,4) NOT NULL DEFAULT 0,
  credit NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX ON public.journal_lines (journal_entry_id);
CREATE INDEX ON public.journal_lines (company_id, account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jl_select" ON public.journal_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "jl_write" ON public.journal_lines FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- Seed default CoA for a company
CREATE OR REPLACE FUNCTION public.seed_default_coa(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (company_id, code, name, account_type, normal_balance, is_group) VALUES
    (_company_id, '1000', 'Aset', 'asset', 'debit', true),
    (_company_id, '1100', 'Kas', 'asset', 'debit', false),
    (_company_id, '1110', 'Bank', 'asset', 'debit', false),
    (_company_id, '1200', 'Piutang Usaha', 'asset', 'debit', false),
    (_company_id, '1300', 'Persediaan', 'asset', 'debit', false),
    (_company_id, '1400', 'PPN Masukan', 'asset', 'debit', false),
    (_company_id, '1500', 'Aset Tetap', 'asset', 'debit', false),
    (_company_id, '2000', 'Kewajiban', 'liability', 'credit', true),
    (_company_id, '2100', 'Utang Usaha', 'liability', 'credit', false),
    (_company_id, '2200', 'PPN Keluaran', 'liability', 'credit', false),
    (_company_id, '2300', 'Utang Pajak', 'liability', 'credit', false),
    (_company_id, '3000', 'Ekuitas', 'equity', 'credit', true),
    (_company_id, '3100', 'Modal', 'equity', 'credit', false),
    (_company_id, '3200', 'Laba Ditahan', 'equity', 'credit', false),
    (_company_id, '4000', 'Pendapatan', 'revenue', 'credit', true),
    (_company_id, '4100', 'Penjualan', 'revenue', 'credit', false),
    (_company_id, '4200', 'Pendapatan Lain-lain', 'revenue', 'credit', false),
    (_company_id, '5000', 'Beban Pokok Penjualan', 'expense', 'debit', true),
    (_company_id, '5100', 'HPP', 'expense', 'debit', false),
    (_company_id, '6000', 'Beban Operasional', 'expense', 'debit', true),
    (_company_id, '6100', 'Beban Gaji', 'expense', 'debit', false),
    (_company_id, '6200', 'Beban Sewa', 'expense', 'debit', false),
    (_company_id, '6300', 'Beban Utilitas', 'expense', 'debit', false),
    (_company_id, '6900', 'Beban Lain-lain', 'expense', 'debit', false)
  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_default_coa(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_coa(UUID) TO authenticated, service_role;

-- Trigger to seed CoA on new company
CREATE OR REPLACE FUNCTION public.tg_seed_coa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_coa(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_seed_coa
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_coa();

-- Backfill for existing companies
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_default_coa(c.id);
  END LOOP;
END $$;

-- Journal number counter (reuse doc_number_counters)
-- Post journal entry RPC
CREATE OR REPLACE FUNCTION public.post_journal_entry(
  _company_id UUID,
  _entry_date DATE,
  _memo TEXT,
  _source journal_source,
  _source_ref TEXT,
  _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je_id UUID; v_no TEXT; v_line JSONB; v_i INT := 0;
  v_debit NUMERIC(18,4); v_credit NUMERIC(18,4);
  v_total_debit NUMERIC(18,4) := 0; v_total_credit NUMERIC(18,4) := 0;
BEGIN
  IF NOT public.is_company_admin(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized to post journal entries';
  END IF;
  IF jsonb_array_length(_lines) < 2 THEN
    RAISE EXCEPTION 'Journal must have at least 2 lines';
  END IF;

  v_no := public.next_doc_no(_company_id, 'journal_entry', 'JE');

  INSERT INTO public.journal_entries (company_id, entry_no, entry_date, source, source_ref, memo, status, created_by)
  VALUES (_company_id, v_no, _entry_date, COALESCE(_source,'manual'), _source_ref, _memo, 'posted', auth.uid())
  RETURNING id INTO v_je_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_i := v_i + 1;
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);
    IF v_debit = 0 AND v_credit = 0 THEN CONTINUE; END IF;
    IF v_debit > 0 AND v_credit > 0 THEN RAISE EXCEPTION 'Line % has both debit and credit', v_i; END IF;

    INSERT INTO public.journal_lines (company_id, journal_entry_id, line_no, account_id, description, debit, credit)
    VALUES (_company_id, v_je_id, v_i, (v_line->>'account_id')::UUID, v_line->>'description', v_debit, v_credit);

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Journal not balanced: debit %, credit %', v_total_debit, v_total_credit;
  END IF;
  IF v_total_debit = 0 THEN RAISE EXCEPTION 'Journal has zero total'; END IF;

  UPDATE public.journal_entries SET total_debit = v_total_debit, total_credit = v_total_credit WHERE id = v_je_id;
  RETURN v_je_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_journal_entry(UUID,DATE,TEXT,journal_source,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(UUID,DATE,TEXT,journal_source,TEXT,JSONB) TO authenticated, service_role;

-- Trial Balance view
CREATE OR REPLACE VIEW public.trial_balance AS
SELECT
  a.company_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.account_type,
  a.normal_balance,
  COALESCE(SUM(jl.debit), 0) AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
FROM public.accounts a
LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
WHERE a.is_group = false
GROUP BY a.company_id, a.id, a.code, a.name, a.account_type, a.normal_balance;

GRANT SELECT ON public.trial_balance TO authenticated;
