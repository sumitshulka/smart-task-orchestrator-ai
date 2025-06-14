
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

/**
 * Hook to fetch department names from Supabase.
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("departments")
      .select("name")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          toast({
            title: "Failed to load departments",
            description: error.message,
          });
          setDepartments([]);
        } else {
          setDepartments(data?.map((d: { name: string }) => d.name) || []);
        }
        setLoading(false);
      });
  }, []);

  return { departments, loading };
}
