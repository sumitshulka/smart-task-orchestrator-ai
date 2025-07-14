
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

export type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
  color?: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
};

export type StatusTransition = {
  id: string;
  from_status: string;
  to_status: string;
  created_at: string;
};

export function useTaskStatuses() {
  const { data: statuses = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['/api/task-statuses'],
    queryFn: () => apiClient.getTaskStatuses(),
  });

  const refreshStatuses = () => {
    refetch();
  };

  return { statuses, loading, refreshStatuses };
}

export function useStatusTransitions() {
  const [transitions, setTransitionsState] = useState<StatusTransition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load transitions from localStorage
    const loadTransitions = () => {
      try {
        const savedTransitions = localStorage.getItem('status_transitions');
        if (savedTransitions) {
          setTransitionsState(JSON.parse(savedTransitions));
        } else {
          // Default transitions for a forward-only workflow
          const defaultTransitions = [
            {
              id: "trans-1",
              from_status: "pending",
              to_status: "in_progress",
              created_at: new Date().toISOString(),
            },
            {
              id: "trans-2",
              from_status: "in_progress", 
              to_status: "review",
              created_at: new Date().toISOString(),
            },
            {
              id: "trans-3",
              from_status: "review",
              to_status: "completed",
              created_at: new Date().toISOString(),
            }
          ];
          localStorage.setItem('status_transitions', JSON.stringify(defaultTransitions));
          setTransitionsState(defaultTransitions);
        }
      } catch (error) {
        console.error("Error loading status transitions:", error);
        setTransitionsState([]);
      } finally {
        setLoading(false);
      }
    };

    loadTransitions();
  }, []);

  const setTransitions = (newTransitions: StatusTransition[]) => {
    setTransitionsState(newTransitions);
    localStorage.setItem('status_transitions', JSON.stringify(newTransitions));
  };

  return { transitions, loading, setTransitions };
}
