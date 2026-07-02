
DO $$ BEGIN CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','unqualified','converted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.opp_stage AS ENUM ('prospecting','qualification','proposal','negotiation','won','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM ('call','email','meeting','note','task'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  estimated_value NUMERIC(18,2) DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id),
  converted_customer_id UUID REFERENCES public.customers(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "leads_write" ON public.leads FOR ALL TO authenticated USING (public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  stage public.opp_stage NOT NULL DEFAULT 'prospecting',
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  probability INT NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  actual_close_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opp_select" ON public.opportunities FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "opp_write" ON public.opportunities FOR ALL TO authenticated USING (public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE TRIGGER trg_opp_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_select" ON public.crm_activities FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "act_write" ON public.crm_activities FOR ALL TO authenticated USING (public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE TRIGGER trg_act_updated BEFORE UPDATE ON public.crm_activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_leads_company_status ON public.leads(company_id, status);
CREATE INDEX idx_opp_company_stage ON public.opportunities(company_id, stage);
CREATE INDEX idx_act_company ON public.crm_activities(company_id);

-- Convert Lead to Customer + optional Opportunity
CREATE OR REPLACE FUNCTION public.convert_lead(
  _company_id UUID, _lead_id UUID, _customer_code TEXT, _create_opportunity BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lead RECORD; v_cust_id UUID; v_opp_id UUID; v_code TEXT;
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id AND company_id = _company_id;
  IF v_lead IS NULL THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF v_lead.status = 'converted' THEN RAISE EXCEPTION 'Lead already converted'; END IF;

  v_code := COALESCE(NULLIF(_customer_code,''), 'CUST-' || to_char(now(),'YYMMDDHH24MISS'));
  INSERT INTO public.customers (company_id, code, name, email, phone, is_active, created_by)
  VALUES (_company_id, v_code, COALESCE(v_lead.company_name, v_lead.name), v_lead.email, v_lead.phone, true, auth.uid())
  RETURNING id INTO v_cust_id;

  IF _create_opportunity THEN
    INSERT INTO public.opportunities (company_id, name, customer_id, lead_id, stage, amount, assigned_to, created_by)
    VALUES (_company_id, v_lead.name || ' Opportunity', v_cust_id, _lead_id, 'qualification', COALESCE(v_lead.estimated_value,0), v_lead.assigned_to, auth.uid())
    RETURNING id INTO v_opp_id;
  END IF;

  UPDATE public.leads SET status = 'converted', converted_customer_id = v_cust_id WHERE id = _lead_id;
  RETURN jsonb_build_object('customer_id', v_cust_id, 'opportunity_id', v_opp_id);
END; $$;
