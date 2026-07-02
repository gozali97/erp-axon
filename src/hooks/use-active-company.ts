import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's active company id from their profile.
 * Falls back to the first company they belong to.
 */
export function useActiveCompany() {
  return useQuery({
    queryKey: ["active-company"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, active_company_id")
        .maybeSingle();
      if (profile?.active_company_id) return profile.active_company_id;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("company_id")
        .limit(1);
      return roles?.[0]?.company_id ?? null;
    },
    staleTime: 60_000,
  });
}
