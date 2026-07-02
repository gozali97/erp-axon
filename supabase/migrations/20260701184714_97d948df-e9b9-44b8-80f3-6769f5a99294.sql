
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'owner',
  'director',
  'finance',
  'purchasing',
  'sales',
  'warehouse',
  'viewer'
);

-- =========================================================
-- COMPANIES
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'IDR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- BRANCHES
-- =========================================================
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_branches_company_id ON public.branches(company_id);

-- =========================================================
-- WAREHOUSES
-- =========================================================
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_warehouses_company_id ON public.warehouses(company_id);
CREATE INDEX idx_warehouses_branch_id ON public.warehouses(branch_id);

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  active_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER_ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);

-- =========================================================
-- USER_WAREHOUSE_ACCESS
-- =========================================================
CREATE TABLE public.user_warehouse_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, warehouse_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_warehouse_access TO authenticated;
GRANT ALL ON public.user_warehouse_access TO service_role;
ALTER TABLE public.user_warehouse_access ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_uwa_user_id ON public.user_warehouse_access(user_id);
CREATE INDEX idx_uwa_warehouse_id ON public.user_warehouse_access(warehouse_id);

-- =========================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================================

-- Does user have this role in this company?
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = _role
  )
$$;

-- Does user have ANY role in this company?
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;

-- Is user owner OR director of this company?
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role IN ('owner', 'director')
  )
$$;

-- Companies where the user has any role
CREATE OR REPLACE FUNCTION public.user_company_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT company_id FROM public.user_roles WHERE user_id = _user_id
$$;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- COMPANIES
CREATE POLICY "Members can view their companies"
  ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), id));

CREATE POLICY "Any authenticated user can create a company"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their company"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), id));

CREATE POLICY "Owners can delete their company"
  ON public.companies FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), id, 'owner'));

-- BRANCHES
CREATE POLICY "Members can view branches in their companies"
  ON public.branches FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can insert branches"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update branches"
  ON public.branches FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete branches"
  ON public.branches FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

-- WAREHOUSES
CREATE POLICY "Members can view warehouses in their companies"
  ON public.warehouses FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can insert warehouses"
  ON public.warehouses FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update warehouses"
  ON public.warehouses FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete warehouses"
  ON public.warehouses FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

-- PROFILES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in their companies"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can insert roles in their companies"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can update roles in their companies"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Admins can delete roles in their companies"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

-- USER_WAREHOUSE_ACCESS
CREATE POLICY "Users can view their own warehouse access"
  ON public.user_warehouse_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage warehouse access in their companies"
  ON public.user_warehouse_access FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = warehouse_id
        AND public.is_company_admin(auth.uid(), w.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = warehouse_id
        AND public.is_company_admin(auth.uid(), w.company_id)
    )
  );

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- SIGNUP HANDLER: create profile + default Company/Branch/Warehouse + owner role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  new_branch_id UUID;
  new_warehouse_id UUID;
  company_name TEXT;
  display_name TEXT;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    display_name || '''s Company'
  );

  -- Create the company
  INSERT INTO public.companies (name, legal_name, created_by)
  VALUES (company_name, company_name, NEW.id)
  RETURNING id INTO new_company_id;

  -- Create default branch
  INSERT INTO public.branches (company_id, code, name)
  VALUES (new_company_id, 'MAIN', 'Main Branch')
  RETURNING id INTO new_branch_id;

  -- Create default warehouse
  INSERT INTO public.warehouses (company_id, branch_id, code, name, is_default)
  VALUES (new_company_id, new_branch_id, 'MAIN-WH', 'Main Warehouse', true)
  RETURNING id INTO new_warehouse_id;

  -- Owner role
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (NEW.id, new_company_id, 'owner');

  -- Warehouse access
  INSERT INTO public.user_warehouse_access (user_id, warehouse_id)
  VALUES (NEW.id, new_warehouse_id);

  -- Profile
  INSERT INTO public.profiles (id, display_name, email, active_company_id, avatar_url)
  VALUES (
    NEW.id,
    display_name,
    NEW.email,
    new_company_id,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
