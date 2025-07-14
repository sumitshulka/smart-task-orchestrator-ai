
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch departments from localStorage.
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      // For now, use localStorage to store departments
      const savedDepartments = localStorage.getItem('departments');
      if (savedDepartments) {
        setDepartments(JSON.parse(savedDepartments));
      } else {
        // Default departments
        const defaultDepartments = [
          {
            id: "1",
            name: "Administration",
            description: "Administrative department",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "2", 
            name: "Engineering",
            description: "Engineering department",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "3",
            name: "Marketing",
            description: "Marketing department", 
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ];
        localStorage.setItem('departments', JSON.stringify(defaultDepartments));
        setDepartments(defaultDepartments);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return { 
    departments, 
    loading, 
    refetch: fetchDepartments 
  };
}
