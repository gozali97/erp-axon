
-- ============ ENUMS ============
CREATE TYPE public.unit_category AS ENUM ('count', 'weight', 'volume', 'length', 'area', 'time', 'other');
CREATE TYPE public.product_type AS ENUM ('stockable', 'service', 'consumable');
CREATE TYPE public.valuation_method AS ENUM ('fifo', 'lifo', 'average', 'standard');
CREATE TYPE public.movement_type AS ENUM ('in', 'out', 'transfer_in', 'transfer_out', 'adjustment', 'opname');
CREATE TYPE public.movement_source AS ENUM ('purchase', 'sale', 'production', 'transfer', 'adjustment', 'opname', 'opening', 'return_in', 'return_out');

-- ============ HELPER: owner/director can manage inventory master data ============
CREATE OR REPLACE FUNCTION public.can_manage_inventory(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_company_admin(_user_id, _company_id)
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_inventory(uuid, uuid) FROM PUBLIC, anon;

-- ============ UNITS ============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category public.unit_category NOT NULL DEFAULT 'count',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_units_company ON public.units(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "units_write" ON public.units FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ UNIT CONVERSIONS ============
CREATE TABLE public.unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  to_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  factor NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, from_unit_id, to_unit_id),
  CHECK (from_unit_id <> to_unit_id)
);
CREATE INDEX idx_unit_conversions_company ON public.unit_conversions(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_conversions TO authenticated;
GRANT ALL ON public.unit_conversions TO service_role;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uc_select" ON public.unit_conversions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "uc_write" ON public.unit_conversions FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_categories_company ON public.categories(company_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_select" ON public.categories FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "cat_write" ON public.categories FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER cat_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  base_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_type public.product_type NOT NULL DEFAULT 'stockable',
  valuation_method public.valuation_method NOT NULL DEFAULT 'average',
  sale_price NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  purchase_price NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  min_stock NUMERIC(18,4) NOT NULL DEFAULT 0,
  max_stock NUMERIC(18,4),
  reorder_point NUMERIC(18,4),
  track_batch BOOLEAN NOT NULL DEFAULT FALSE,
  track_serial BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(company_id, is_active);
CREATE INDEX idx_products_search ON public.products USING gin (to_tsvector('simple', coalesce(sku,'') || ' ' || coalesce(name,'') || ' ' || coalesce(barcode,'')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_select" ON public.products FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "prod_write" ON public.products FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER prod_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRODUCT UNITS ============
CREATE TABLE public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  factor_to_base NUMERIC(18,6) NOT NULL CHECK (factor_to_base > 0),
  is_purchase_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_sale_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, unit_id)
);
CREATE INDEX idx_pu_company ON public.product_units(company_id);
CREATE INDEX idx_pu_product ON public.product_units(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_units TO authenticated;
GRANT ALL ON public.product_units TO service_role;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pu_select" ON public.product_units FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pu_write" ON public.product_units FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));

-- ============ STOCK BALANCES ============
CREATE TABLE public.stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(18,4) NOT NULL DEFAULT 0,
  average_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);
CREATE INDEX idx_sb_company ON public.stock_balances(company_id);
CREATE INDEX idx_sb_product ON public.stock_balances(product_id);
CREATE INDEX idx_sb_warehouse ON public.stock_balances(warehouse_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_balances TO authenticated;
GRANT ALL ON public.stock_balances TO service_role;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sb_select" ON public.stock_balances FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sb_write_managers" ON public.stock_balances FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid(), company_id))
  WITH CHECK (public.can_manage_inventory(auth.uid(), company_id));
CREATE TRIGGER sb_updated_at BEFORE UPDATE ON public.stock_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STOCK MOVEMENTS (immutable journal) ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_no TEXT NOT NULL,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  movement_type public.movement_type NOT NULL,
  source public.movement_source NOT NULL,
  source_ref TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  counterparty_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  quantity_base NUMERIC(18,4) NOT NULL CHECK (quantity_base > 0),
  unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  batch_no TEXT,
  serial_no TEXT,
  expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, movement_no)
);
CREATE INDEX idx_sm_company_date ON public.stock_movements(company_id, movement_date DESC);
CREATE INDEX idx_sm_product ON public.stock_movements(product_id);
CREATE INDEX idx_sm_warehouse ON public.stock_movements(warehouse_id);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_select" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sm_insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (
      public.can_manage_inventory(auth.uid(), company_id)
      OR EXISTS (
        SELECT 1 FROM public.user_warehouse_access
        WHERE user_id = auth.uid() AND warehouse_id = stock_movements.warehouse_id
      )
    )
  );
-- No UPDATE/DELETE grants → journal is immutable at the API layer.

-- ============ STOCK COST LAYERS ============
CREATE TABLE public.stock_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quantity_remaining NUMERIC(18,4) NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC(18,4) NOT NULL CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scl_pw ON public.stock_cost_layers(product_id, warehouse_id, received_at);
CREATE INDEX idx_scl_company ON public.stock_cost_layers(company_id);
GRANT SELECT ON public.stock_cost_layers TO authenticated;
GRANT ALL ON public.stock_cost_layers TO service_role;
ALTER TABLE public.stock_cost_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scl_select" ON public.stock_cost_layers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

-- ============ SEED default units for new companies ============
CREATE OR REPLACE FUNCTION public.seed_default_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.units (company_id, code, name, category) VALUES
    (NEW.id, 'PCS', 'Pieces', 'count'),
    (NEW.id, 'BOX', 'Box', 'count'),
    (NEW.id, 'KG',  'Kilogram', 'weight'),
    (NEW.id, 'G',   'Gram', 'weight'),
    (NEW.id, 'L',   'Liter', 'volume'),
    (NEW.id, 'M',   'Meter', 'length')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_default_units() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_seed_default_units
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_units();

-- Seed units for existing companies too
INSERT INTO public.units (company_id, code, name, category)
SELECT c.id, u.code, u.name, u.category::public.unit_category
FROM public.companies c
CROSS JOIN (VALUES
  ('PCS', 'Pieces', 'count'),
  ('BOX', 'Box', 'count'),
  ('KG',  'Kilogram', 'weight'),
  ('G',   'Gram', 'weight'),
  ('L',   'Liter', 'volume'),
  ('M',   'Meter', 'length')
) AS u(code, name, category)
ON CONFLICT DO NOTHING;
