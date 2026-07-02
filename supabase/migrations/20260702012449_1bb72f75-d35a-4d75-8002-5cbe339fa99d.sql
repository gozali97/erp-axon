
-- Bills of Materials
CREATE TABLE public.bills_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  output_quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills_of_materials TO authenticated;
GRANT ALL ON public.bills_of_materials TO service_role;
ALTER TABLE public.bills_of_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read boms" ON public.bills_of_materials FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage boms" ON public.bills_of_materials FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_boms_updated BEFORE UPDATE ON public.bills_of_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BOM Components
CREATE TABLE public.bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bom_id UUID NOT NULL REFERENCES public.bills_of_materials(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(18,4) NOT NULL,
  waste_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bom_id, component_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_components TO authenticated;
GRANT ALL ON public.bom_components TO service_role;
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read bom comps" ON public.bom_components FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "admins manage bom comps" ON public.bom_components FOR ALL TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trg_bom_comps_updated BEFORE UPDATE ON public.bom_components FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Material Requirements calculation
CREATE OR REPLACE FUNCTION public.calc_material_requirements(
  _company_id UUID, _bom_id UUID, _warehouse_id UUID, _target_qty NUMERIC
) RETURNS TABLE (
  component_product_id UUID,
  sku TEXT,
  name TEXT,
  required_qty NUMERIC,
  on_hand NUMERIC,
  shortage NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_output NUMERIC;
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT output_quantity INTO v_output FROM public.bills_of_materials WHERE id=_bom_id AND company_id=_company_id;
  IF v_output IS NULL OR v_output = 0 THEN RAISE EXCEPTION 'BOM not found or output qty zero'; END IF;

  RETURN QUERY
  SELECT
    bc.component_product_id,
    p.sku,
    p.name,
    ROUND((bc.quantity * (1 + bc.waste_pct/100) * _target_qty / v_output)::numeric, 4) AS required_qty,
    COALESCE(sb.quantity_on_hand, 0) AS on_hand,
    GREATEST(0, ROUND((bc.quantity * (1 + bc.waste_pct/100) * _target_qty / v_output)::numeric, 4) - COALESCE(sb.quantity_on_hand, 0)) AS shortage
  FROM public.bom_components bc
  JOIN public.products p ON p.id = bc.component_product_id
  LEFT JOIN public.stock_balances sb
    ON sb.company_id = _company_id
    AND sb.product_id = bc.component_product_id
    AND sb.warehouse_id = _warehouse_id
  WHERE bc.bom_id = _bom_id AND bc.company_id = _company_id
  ORDER BY p.name;
END; $$;
