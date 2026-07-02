
-- HR Module: Departments, Positions, Employees, Attendance, Leave, Payroll

CREATE TYPE public.employment_status AS ENUM ('active','on_leave','resigned','terminated');
CREATE TYPE public.employment_type AS ENUM ('permanent','contract','probation','intern','freelance');
CREATE TYPE public.attendance_status AS ENUM ('present','late','absent','leave','holiday');
CREATE TYPE public.leave_type AS ENUM ('annual','sick','maternity','paternity','unpaid','other');
CREATE TYPE public.leave_status AS ENUM ('draft','submitted','approved','rejected','cancelled');
CREATE TYPE public.payroll_status AS ENUM ('draft','approved','posted','paid');

-- Departments
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_employee_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read departments" ON public.departments FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Positions
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read positions" ON public.positions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage positions" ON public.positions FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_no TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  birth_date DATE,
  national_id TEXT,
  tax_id TEXT,
  address TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'permanent',
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resign_date DATE,
  base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  allowance_fixed NUMERIC(18,2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  annual_leave_quota NUMERIC(5,2) NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (company_id, employee_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read employees" ON public.employees FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage employees" ON public.employees FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_dept ON public.employees(department_id);

ALTER TABLE public.departments
  ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Attendance
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status public.attendance_status NOT NULL DEFAULT 'present',
  work_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT ALL ON public.attendances TO service_role;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read attendances" ON public.attendances FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage attendances" ON public.attendances FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_attendances_updated BEFORE UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Leave Requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_no TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'submitted',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (company_id, request_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read leave" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage leave" ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_leave_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payroll Runs
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_no TEXT NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  pay_date DATE NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  total_gross NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(18,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (company_id, run_no),
  UNIQUE (company_id, period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read payroll" ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage payroll" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payroll Lines (per employee)
CREATE TABLE public.payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(18,2) NOT NULL DEFAULT 0,
  overtime NUMERIC(18,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(18,2) NOT NULL DEFAULT 0,
  deduction NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  gross_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_lines TO authenticated;
GRANT ALL ON public.payroll_lines TO service_role;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read payroll lines" ON public.payroll_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage payroll lines" ON public.payroll_lines FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_payroll_lines_updated BEFORE UPDATE ON public.payroll_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add HR expense accounts if not exist
CREATE OR REPLACE FUNCTION public.seed_hr_accounts(_company_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.accounts (company_id, code, name, account_type, normal_balance, is_group) VALUES
    (_company_id, '2400', 'Utang Gaji', 'liability', 'credit', false),
    (_company_id, '2410', 'Utang PPh 21', 'liability', 'credit', false)
  ON CONFLICT (company_id, code) DO NOTHING;
END; $$;

-- Backfill HR accounts for existing companies
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_hr_accounts(c.id);
  END LOOP;
END $$;

-- Trigger for new companies to also get HR accounts
CREATE OR REPLACE FUNCTION public.tg_seed_coa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.seed_default_coa(NEW.id);
  PERFORM public.seed_hr_accounts(NEW.id);
  RETURN NEW;
END; $$;

-- Create Payroll Run RPC: generates lines from active employees
CREATE OR REPLACE FUNCTION public.create_payroll_run(
  _company_id UUID, _period_year INT, _period_month INT, _pay_date DATE, _notes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_run_id UUID; v_run_no TEXT;
  v_emp RECORD;
  v_gross NUMERIC(18,2); v_ded NUMERIC(18,2); v_net NUMERIC(18,2);
  v_total_gross NUMERIC(18,2) := 0; v_total_ded NUMERIC(18,2) := 0; v_total_net NUMERIC(18,2) := 0;
BEGIN
  IF NOT public.is_company_admin(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_run_no := public.next_doc_no(_company_id, 'payroll_run', 'PR');
  INSERT INTO public.payroll_runs (company_id, run_no, period_year, period_month, pay_date, notes, created_by)
  VALUES (_company_id, v_run_no, _period_year, _period_month, _pay_date, _notes, auth.uid())
  RETURNING id INTO v_run_id;

  FOR v_emp IN
    SELECT id, base_salary, allowance_fixed FROM public.employees
    WHERE company_id = _company_id AND employment_status = 'active'
  LOOP
    v_gross := COALESCE(v_emp.base_salary,0) + COALESCE(v_emp.allowance_fixed,0);
    v_ded := 0;
    v_net := v_gross - v_ded;
    INSERT INTO public.payroll_lines (company_id, payroll_run_id, employee_id, base_salary, allowance, gross_pay, deduction, net_pay)
    VALUES (_company_id, v_run_id, v_emp.id, v_emp.base_salary, v_emp.allowance_fixed, v_gross, v_ded, v_net);
    v_total_gross := v_total_gross + v_gross;
    v_total_ded := v_total_ded + v_ded;
    v_total_net := v_total_net + v_net;
  END LOOP;

  UPDATE public.payroll_runs SET total_gross=v_total_gross, total_deductions=v_total_ded, total_net=v_total_net WHERE id=v_run_id;
  RETURN v_run_id;
END; $$;

-- Post Payroll Run: creates JE Dr Beban Gaji / Cr Kas (or Utang Gaji if not paid)
CREATE OR REPLACE FUNCTION public.post_payroll_run(_company_id UUID, _run_id UUID, _cash_account_code TEXT DEFAULT '1100', _mark_paid BOOLEAN DEFAULT true)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_run RECORD; v_je_id UUID;
  v_exp_acct UUID; v_credit_acct UUID; v_tax_acct UUID;
  v_total_tax NUMERIC(18,2);
  v_lines JSONB;
BEGIN
  IF NOT public.is_company_admin(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_run FROM public.payroll_runs WHERE id=_run_id AND company_id=_company_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status IN ('posted','paid') THEN RAISE EXCEPTION 'Payroll already posted'; END IF;

  SELECT COALESCE(SUM(tax),0) INTO v_total_tax FROM public.payroll_lines WHERE payroll_run_id=_run_id;

  v_exp_acct := public.get_account_id(_company_id, '6100'); -- Beban Gaji
  v_credit_acct := public.get_account_id(_company_id, COALESCE(_cash_account_code, '1100'));
  v_tax_acct := public.get_account_id(_company_id, '2410');

  IF v_exp_acct IS NULL OR v_credit_acct IS NULL THEN
    RAISE EXCEPTION 'Required accounts missing';
  END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_exp_acct, 'debit', v_run.total_gross, 'credit', 0, 'description', 'Beban gaji '||v_run.run_no),
    jsonb_build_object('account_id', v_credit_acct, 'debit', 0, 'credit', v_run.total_net, 'description', 'Pembayaran gaji '||v_run.run_no)
  );
  IF v_total_tax > 0 AND v_tax_acct IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_tax_acct, 'debit', 0, 'credit', v_total_tax, 'description', 'PPh 21 terutang')
    );
  END IF;

  v_je_id := public._post_je_internal(_company_id, v_run.pay_date,
    'Payroll '||v_run.run_no, 'manual', v_run.run_no, v_lines);

  UPDATE public.payroll_runs
    SET status = CASE WHEN _mark_paid THEN 'paid'::payroll_status ELSE 'posted'::payroll_status END,
        journal_entry_id = v_je_id
    WHERE id = _run_id;
  RETURN v_je_id;
END; $$;
