export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_group: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          name?: string
          normal_balance?: Database["public"]["Enums"]["normal_balance"]
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      attendances: {
        Row: {
          attendance_date: string
          clock_in: string | null
          clock_out: string | null
          company_id: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          overtime_hours: number
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_hours: number
        }
        Insert: {
          attendance_date: string
          clock_in?: string | null
          clock_out?: string | null
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          overtime_hours?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_hours?: number
        }
        Update: {
          attendance_date?: string
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          overtime_hours?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_of_materials: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          output_quantity: number
          product_id: string
          updated_at: string
          version: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          output_quantity?: number
          product_id: string
          updated_at?: string
          version?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          output_quantity?: number
          product_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_of_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_components: {
        Row: {
          bom_id: string
          company_id: string
          component_product_id: string
          created_at: string
          id: string
          notes: string | null
          quantity: number
          updated_at: string
          waste_pct: number
        }
        Insert: {
          bom_id: string
          company_id: string
          component_product_id: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity: number
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          bom_id?: string
          company_id?: string
          component_product_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_components_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bills_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_landing_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      cms_posts: {
        Row: {
          author_id: string | null
          body: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          opportunity_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_lines: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          invoice_id: string
          line_no: number
          line_total: number
          product_id: string
          quantity: number
          sales_order_line_id: string | null
          tax_pct: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          invoice_id: string
          line_no: number
          line_total?: number
          product_id: string
          quantity: number
          sales_order_line_id?: string | null
          tax_pct?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          invoice_id?: string
          line_no?: number
          line_total?: number
          product_id?: string
          quantity?: number
          sales_order_line_id?: string | null
          tax_pct?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_sales_order_line_id_fkey"
            columns: ["sales_order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string | null
          grand_total: number
          id: string
          invoice_date: string
          invoice_no: string
          notes: string | null
          sales_order_id: string | null
          status: Database["public"]["Enums"]["inv_status"]
          subtotal: number
          tax_total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no: string
          notes?: string | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["inv_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no?: string
          notes?: string | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["inv_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          currency: string
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_order_lines: {
        Row: {
          company_id: string
          created_at: string
          delivery_order_id: string
          id: string
          movement_id: string | null
          product_id: string
          quantity: number
          sales_order_line_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_order_id: string
          id?: string
          movement_id?: string | null
          product_id: string
          quantity: number
          sales_order_line_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_order_id?: string
          id?: string
          movement_id?: string | null
          product_id?: string
          quantity?: number
          sales_order_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_lines_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_lines_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_lines_sales_order_line_id_fkey"
            columns: ["sales_order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_date: string
          do_no: string
          id: string
          notes: string | null
          sales_order_id: string
          tracking_no: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_date?: string
          do_no: string
          id?: string
          notes?: string | null
          sales_order_id: string
          tracking_no?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_date?: string
          do_no?: string
          id?: string
          notes?: string | null
          sales_order_id?: string
          tracking_no?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          manager_employee_id: string | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_departments_manager"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_number_counters: {
        Row: {
          company_id: string
          doc_type: string
          last_number: number
        }
        Insert: {
          company_id: string
          doc_type: string
          last_number?: number
        }
        Update: {
          company_id?: string
          doc_type?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "doc_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          allowance_fixed: number
          annual_leave_quota: number
          bank_account: string | null
          bank_name: string | null
          base_salary: number
          birth_date: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          employee_no: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender: string | null
          hire_date: string
          id: string
          manager_id: string | null
          national_id: string | null
          phone: string | null
          position_id: string | null
          resign_date: string | null
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          allowance_fixed?: number
          annual_leave_quota?: number
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          birth_date?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_no: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender?: string | null
          hire_date?: string
          id?: string
          manager_id?: string | null
          national_id?: string | null
          phone?: string | null
          position_id?: string | null
          resign_date?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          allowance_fixed?: number
          annual_leave_quota?: number
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          birth_date?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          manager_id?: string | null
          national_id?: string | null
          phone?: string | null
          position_id?: string | null
          resign_date?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_lines: {
        Row: {
          company_id: string
          created_at: string
          goods_receipt_id: string
          id: string
          movement_id: string | null
          product_id: string
          purchase_order_line_id: string | null
          quantity: number
          unit_cost: number
        }
        Insert: {
          company_id: string
          created_at?: string
          goods_receipt_id: string
          id?: string
          movement_id?: string | null
          product_id: string
          purchase_order_line_id?: string | null
          quantity: number
          unit_cost?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          goods_receipt_id?: string
          id?: string
          movement_id?: string | null
          product_id?: string
          purchase_order_line_id?: string | null
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          gr_no: string
          id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_date: string
          supplier_id: string
          supplier_ref: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          gr_no: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          supplier_id: string
          supplier_ref?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          gr_no?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          supplier_id?: string
          supplier_ref?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          entry_date: string
          entry_no: string
          id: string
          memo: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_no: string
          id?: string
          memo?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_no?: string
          id?: string
          memo?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          company_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_no: number
        }
        Insert: {
          account_id: string
          company_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_no: number
        }
        Update: {
          account_id?: string
          company_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_id: string
          company_name: string | null
          converted_customer_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          company_name?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          company_name?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          request_no: string
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          days: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          request_no: string
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          request_no?: string
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_number_counters: {
        Row: {
          company_id: string
          last_number: number
        }
        Insert: {
          company_id: string
          last_number?: number
        }
        Update: {
          company_id?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "movement_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          actual_close_date: string | null
          amount: number
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          probability: number
          stage: Database["public"]["Enums"]["opp_stage"]
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["opp_stage"]
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          amount?: number
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["opp_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          allowance: number
          base_salary: number
          bonus: number
          company_id: string
          created_at: string
          deduction: number
          employee_id: string
          gross_pay: number
          id: string
          net_pay: number
          notes: string | null
          overtime: number
          payroll_run_id: string
          tax: number
          updated_at: string
        }
        Insert: {
          allowance?: number
          base_salary?: number
          bonus?: number
          company_id: string
          created_at?: string
          deduction?: number
          employee_id: string
          gross_pay?: number
          id?: string
          net_pay?: number
          notes?: string | null
          overtime?: number
          payroll_run_id: string
          tax?: number
          updated_at?: string
        }
        Update: {
          allowance?: number
          base_salary?: number
          bonus?: number
          company_id?: string
          created_at?: string
          deduction?: number
          employee_id?: string
          gross_pay?: number
          id?: string
          net_pay?: number
          notes?: string | null
          overtime?: number
          payroll_run_id?: string
          tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          pay_date: string
          period_month: number
          period_year: number
          run_no: string
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          pay_date: string
          period_month: number
          period_year: number
          run_no: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          pay_date?: string
          period_month?: number
          period_year?: number
          run_no?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          amount: number
          cash_account_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          journal_entry_id: string | null
          method: Database["public"]["Enums"]["pos_payment_method"]
          paid_at: string
          payment_no: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          journal_entry_id?: string | null
          method?: Database["public"]["Enums"]["pos_payment_method"]
          paid_at?: string
          payment_no: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          journal_entry_id?: string | null
          method?: Database["public"]["Enums"]["pos_payment_method"]
          paid_at?: string
          payment_no?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "pos_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          code: string
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          level: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          company_id: string
          created_at: string
          factor_to_base: number
          id: string
          is_purchase_default: boolean
          is_sale_default: boolean
          product_id: string
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          factor_to_base: number
          id?: string
          is_purchase_default?: boolean
          is_sale_default?: boolean
          product_id: string
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          factor_to_base?: number
          id?: string
          is_purchase_default?: boolean
          is_sale_default?: boolean
          product_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_unit_id: string
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          max_stock: number | null
          min_stock: number
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_price: number
          reorder_point: number | null
          sale_price: number
          sku: string
          track_batch: boolean
          track_serial: boolean
          updated_at: string
          valuation_method: Database["public"]["Enums"]["valuation_method"]
        }
        Insert: {
          barcode?: string | null
          base_unit_id: string
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_stock?: number | null
          min_stock?: number
          name: string
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_price?: number
          reorder_point?: number | null
          sale_price?: number
          sku: string
          track_batch?: boolean
          track_serial?: boolean
          updated_at?: string
          valuation_method?: Database["public"]["Enums"]["valuation_method"]
        }
        Update: {
          barcode?: string | null
          base_unit_id?: string
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_stock?: number | null
          min_stock?: number
          name?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_price?: number
          reorder_point?: number | null
          sale_price?: number
          sku?: string
          track_batch?: boolean
          track_serial?: boolean
          updated_at?: string
          valuation_method?: Database["public"]["Enums"]["valuation_method"]
        }
        Relationships: [
          {
            foreignKeyName: "products_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_company_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_company_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_company_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          line_no: number
          line_total: number
          product_id: string
          purchase_order_id: string
          quantity: number
          quantity_received: number
          tax_pct: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_no: number
          line_total?: number
          product_id: string
          purchase_order_id: string
          quantity: number
          quantity_received?: number
          tax_pct?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_no?: number
          line_total?: number
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number
          tax_pct?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          expected_date: string | null
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          po_no: string
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          supplier_id: string
          tax_total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          po_no: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id: string
          tax_total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          po_no?: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          line_no: number
          line_total: number
          product_id: string
          quantity: number
          quantity_delivered: number
          quantity_invoiced: number
          sales_order_id: string
          tax_pct: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_no: number
          line_total?: number
          product_id: string
          quantity: number
          quantity_delivered?: number
          quantity_invoiced?: number
          sales_order_id: string
          tax_pct?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_no?: number
          line_total?: number
          product_id?: string
          quantity?: number
          quantity_delivered?: number
          quantity_invoiced?: number
          sales_order_id?: string
          tax_pct?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          customer_ref: string | null
          expected_date: string | null
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          so_no: string
          status: Database["public"]["Enums"]["so_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          customer_ref?: string | null
          expected_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          so_no: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          customer_ref?: string | null
          expected_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          so_no?: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          average_cost: number
          company_id: string
          id: string
          last_movement_at: string | null
          product_id: string
          quantity_on_hand: number
          quantity_reserved: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          average_cost?: number
          company_id: string
          id?: string
          last_movement_at?: string | null
          product_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          average_cost?: number
          company_id?: string
          id?: string
          last_movement_at?: string | null
          product_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_cost_layers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          movement_id: string | null
          product_id: string
          quantity_remaining: number
          received_at: string
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          movement_id?: string | null
          product_id: string
          quantity_remaining: number
          received_at?: string
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          movement_id?: string | null
          product_id?: string
          quantity_remaining?: number
          received_at?: string
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_cost_layers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_cost_layers_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_cost_layers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_cost_layers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_no: string | null
          company_id: string
          counterparty_warehouse_id: string | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          movement_date: string
          movement_no: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          quantity_base: number
          serial_no: string | null
          source: Database["public"]["Enums"]["movement_source"]
          source_ref: string | null
          total_cost: number
          unit_cost: number
          unit_id: string
          warehouse_id: string
        }
        Insert: {
          batch_no?: string | null
          company_id: string
          counterparty_warehouse_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          movement_date?: string
          movement_no: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          quantity_base: number
          serial_no?: string | null
          source: Database["public"]["Enums"]["movement_source"]
          source_ref?: string | null
          total_cost?: number
          unit_cost?: number
          unit_id: string
          warehouse_id: string
        }
        Update: {
          batch_no?: string | null
          company_id?: string
          counterparty_warehouse_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          movement_date?: string
          movement_no?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          quantity_base?: number
          serial_no?: string | null
          source?: Database["public"]["Enums"]["movement_source"]
          source_ref?: string | null
          total_cost?: number
          unit_cost?: number
          unit_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_counterparty_warehouse_id_fkey"
            columns: ["counterparty_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_conversions: {
        Row: {
          company_id: string
          created_at: string
          factor: number
          from_unit_id: string
          id: string
          to_unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          factor: number
          from_unit_id: string
          id?: string
          to_unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          factor?: number
          from_unit_id?: string
          id?: string
          to_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_conversions_from_unit_id_fkey"
            columns: ["from_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_conversions_to_unit_id_fkey"
            columns: ["to_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          category: Database["public"]["Enums"]["unit_category"]
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["unit_category"]
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["unit_category"]
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouse_access: {
        Row: {
          created_at: string
          id: string
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouse_access_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          allow_negative_stock: boolean
          branch_id: string
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allow_negative_stock?: boolean
          branch_id: string
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allow_negative_stock?: boolean
          branch_id?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_components: {
        Row: {
          company_id: string
          component_product_id: string
          consumed_qty: number
          created_at: string
          id: string
          movement_id: string | null
          planned_qty: number
          unit_cost: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          company_id: string
          component_product_id: string
          consumed_qty?: number
          created_at?: string
          id?: string
          movement_id?: string | null
          planned_qty: number
          unit_cost?: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          company_id?: string
          component_product_id?: string
          consumed_qty?: number
          created_at?: string
          id?: string
          movement_id?: string | null
          planned_qty?: number
          unit_cost?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_components_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_components_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          bom_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          planned_end: string | null
          planned_qty: number
          planned_start: string | null
          produced_qty: number
          product_id: string
          status: Database["public"]["Enums"]["wo_status"]
          updated_at: string
          warehouse_id: string
          wo_no: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          bom_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_qty: number
          planned_start?: string | null
          produced_qty?: number
          product_id: string
          status?: Database["public"]["Enums"]["wo_status"]
          updated_at?: string
          warehouse_id: string
          wo_no: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          bom_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_qty?: number
          planned_start?: string | null
          produced_qty?: number
          product_id?: string
          status?: Database["public"]["Enums"]["wo_status"]
          updated_at?: string
          warehouse_id?: string
          wo_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bills_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trial_balance: {
        Row: {
          account_id: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          balance: number | null
          code: string | null
          company_id: string | null
          name: string | null
          normal_balance: Database["public"]["Enums"]["normal_balance"] | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _post_je_internal: {
        Args: {
          _company_id: string
          _entry_date: string
          _lines: Json
          _memo: string
          _source: Database["public"]["Enums"]["journal_source"]
          _source_ref: string
        }
        Returns: string
      }
      calc_material_requirements: {
        Args: {
          _bom_id: string
          _company_id: string
          _target_qty: number
          _warehouse_id: string
        }
        Returns: {
          component_product_id: string
          name: string
          on_hand: number
          required_qty: number
          shortage: number
          sku: string
        }[]
      }
      can_manage_inventory: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      complete_work_order: {
        Args: {
          _company_id: string
          _notes: string
          _produced_qty: number
          _wo_id: string
        }
        Returns: Json
      }
      convert_lead: {
        Args: {
          _company_id: string
          _create_opportunity?: boolean
          _customer_code: string
          _lead_id: string
        }
        Returns: Json
      }
      create_customer_invoice: {
        Args: {
          _company_id: string
          _due_date: string
          _invoice_date: string
          _lines: Json
          _notes: string
          _sales_order_id: string
        }
        Returns: string
      }
      create_delivery_order: {
        Args: {
          _carrier: string
          _company_id: string
          _lines: Json
          _notes: string
          _sales_order_id: string
          _tracking_no: string
        }
        Returns: string
      }
      create_goods_receipt: {
        Args: {
          _company_id: string
          _lines: Json
          _notes: string
          _purchase_order_id: string
          _supplier_ref: string
        }
        Returns: string
      }
      create_payroll_run: {
        Args: {
          _company_id: string
          _notes: string
          _pay_date: string
          _period_month: number
          _period_year: number
        }
        Returns: string
      }
      create_pos_sale: {
        Args: {
          _amount_paid: number
          _cash_account_code: string
          _company_id: string
          _customer_id: string
          _lines: Json
          _notes: string
          _payment_method: Database["public"]["Enums"]["pos_payment_method"]
          _payment_reference: string
          _sale_date: string
          _warehouse_id: string
        }
        Returns: Json
      }
      create_purchase_order: {
        Args: {
          _company_id: string
          _expected_date: string
          _lines: Json
          _notes: string
          _order_date: string
          _supplier_id: string
          _warehouse_id: string
        }
        Returns: string
      }
      create_sales_order: {
        Args: {
          _company_id: string
          _customer_id: string
          _customer_ref: string
          _expected_date: string
          _lines: Json
          _notes: string
          _order_date: string
          _warehouse_id: string
        }
        Returns: string
      }
      create_work_order: {
        Args: {
          _bom_id: string
          _company_id: string
          _notes: string
          _planned_end: string
          _planned_qty: number
          _planned_start: string
          _warehouse_id: string
        }
        Returns: string
      }
      get_account_id: {
        Args: { _code: string; _company_id: string }
        Returns: string
      }
      get_or_create_walkin_customer: {
        Args: { _company_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      next_doc_no: {
        Args: { _company_id: string; _doc_type: string; _prefix: string }
        Returns: string
      }
      next_movement_no: { Args: { _company_id: string }; Returns: string }
      post_journal_entry: {
        Args: {
          _company_id: string
          _entry_date: string
          _lines: Json
          _memo: string
          _source: Database["public"]["Enums"]["journal_source"]
          _source_ref: string
        }
        Returns: string
      }
      post_payroll_run: {
        Args: {
          _cash_account_code?: string
          _company_id: string
          _mark_paid?: boolean
          _run_id: string
        }
        Returns: string
      }
      post_stock_adjustment: {
        Args: {
          _company_id: string
          _delta: number
          _notes?: string
          _product_id: string
          _source?: Database["public"]["Enums"]["movement_source"]
          _unit_cost?: number
          _warehouse_id: string
        }
        Returns: string
      }
      post_stock_movement: {
        Args: {
          _batch_no?: string
          _company_id: string
          _counterparty_warehouse_id?: string
          _movement_date?: string
          _movement_type: Database["public"]["Enums"]["movement_type"]
          _notes?: string
          _product_id: string
          _quantity: number
          _source: Database["public"]["Enums"]["movement_source"]
          _source_ref?: string
          _unit_cost?: number
          _warehouse_id: string
        }
        Returns: string
      }
      post_stock_transfer: {
        Args: {
          _company_id: string
          _from_warehouse: string
          _movement_date?: string
          _notes?: string
          _product_id: string
          _quantity: number
          _to_warehouse: string
          _unit_cost?: number
        }
        Returns: string
      }
      seed_default_coa: { Args: { _company_id: string }; Returns: undefined }
      seed_hr_accounts: { Args: { _company_id: string }; Returns: undefined }
      set_work_order_status: {
        Args: {
          _company_id: string
          _status: Database["public"]["Enums"]["wo_status"]
          _wo_id: string
        }
        Returns: undefined
      }
      user_company_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      activity_type: "call" | "email" | "meeting" | "note" | "task"
      app_role:
        | "owner"
        | "director"
        | "finance"
        | "purchasing"
        | "sales"
        | "warehouse"
        | "viewer"
      attendance_status: "present" | "late" | "absent" | "leave" | "holiday"
      employment_status: "active" | "on_leave" | "resigned" | "terminated"
      employment_type:
        | "permanent"
        | "contract"
        | "probation"
        | "intern"
        | "freelance"
      inv_status: "draft" | "issued" | "partial" | "paid" | "void"
      journal_source:
        | "manual"
        | "sales"
        | "purchase"
        | "inventory"
        | "payment"
        | "opening"
      journal_status: "draft" | "posted" | "void"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "unqualified"
        | "converted"
      leave_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "cancelled"
      leave_type:
        | "annual"
        | "sick"
        | "maternity"
        | "paternity"
        | "unpaid"
        | "other"
      movement_source:
        | "purchase"
        | "sale"
        | "production"
        | "transfer"
        | "adjustment"
        | "opname"
        | "opening"
        | "return_in"
        | "return_out"
      movement_type:
        | "in"
        | "out"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "opname"
      normal_balance: "debit" | "credit"
      opp_stage:
        | "prospecting"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      payroll_status: "draft" | "approved" | "posted" | "paid"
      po_status:
        | "draft"
        | "submitted"
        | "approved"
        | "partial"
        | "received"
        | "closed"
        | "cancelled"
      pos_payment_method: "cash" | "card" | "transfer" | "qris" | "other"
      product_type: "stockable" | "service" | "consumable"
      so_status:
        | "draft"
        | "submitted"
        | "approved"
        | "partial"
        | "delivered"
        | "closed"
        | "cancelled"
      unit_category:
        | "count"
        | "weight"
        | "volume"
        | "length"
        | "area"
        | "time"
        | "other"
      valuation_method: "fifo" | "lifo" | "average" | "standard"
      wo_status:
        | "draft"
        | "released"
        | "in_progress"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      activity_type: ["call", "email", "meeting", "note", "task"],
      app_role: [
        "owner",
        "director",
        "finance",
        "purchasing",
        "sales",
        "warehouse",
        "viewer",
      ],
      attendance_status: ["present", "late", "absent", "leave", "holiday"],
      employment_status: ["active", "on_leave", "resigned", "terminated"],
      employment_type: [
        "permanent",
        "contract",
        "probation",
        "intern",
        "freelance",
      ],
      inv_status: ["draft", "issued", "partial", "paid", "void"],
      journal_source: [
        "manual",
        "sales",
        "purchase",
        "inventory",
        "payment",
        "opening",
      ],
      journal_status: ["draft", "posted", "void"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "unqualified",
        "converted",
      ],
      leave_status: ["draft", "submitted", "approved", "rejected", "cancelled"],
      leave_type: [
        "annual",
        "sick",
        "maternity",
        "paternity",
        "unpaid",
        "other",
      ],
      movement_source: [
        "purchase",
        "sale",
        "production",
        "transfer",
        "adjustment",
        "opname",
        "opening",
        "return_in",
        "return_out",
      ],
      movement_type: [
        "in",
        "out",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "opname",
      ],
      normal_balance: ["debit", "credit"],
      opp_stage: [
        "prospecting",
        "qualification",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      payroll_status: ["draft", "approved", "posted", "paid"],
      po_status: [
        "draft",
        "submitted",
        "approved",
        "partial",
        "received",
        "closed",
        "cancelled",
      ],
      pos_payment_method: ["cash", "card", "transfer", "qris", "other"],
      product_type: ["stockable", "service", "consumable"],
      so_status: [
        "draft",
        "submitted",
        "approved",
        "partial",
        "delivered",
        "closed",
        "cancelled",
      ],
      unit_category: [
        "count",
        "weight",
        "volume",
        "length",
        "area",
        "time",
        "other",
      ],
      valuation_method: ["fifo", "lifo", "average", "standard"],
      wo_status: ["draft", "released", "in_progress", "completed", "cancelled"],
    },
  },
} as const
