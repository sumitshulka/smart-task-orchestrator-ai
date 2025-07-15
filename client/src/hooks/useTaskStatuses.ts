
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
    const loadTransitions = async () => {
      try {
        // Get the user ID from the session
        const userSession = (window as any).currentUser;
        if (!userSession?.id) {
          console.log('No user session found, skipping transitions load');
          setTransitionsState([]);
          setLoading(false);
          return;
        }

        const response = await fetch('/api/task-status-transitions', {
          headers: {
            'x-user-id': userSession.id
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTransitionsState(data);
        } else {
          console.error('Failed to fetch transitions:', response.status);
          setTransitionsState([]);
        }
      } catch (error) {
        console.error('Error loading transitions:', error);
        setTransitionsState([]);
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to ensure currentUser is available
    const timeout = setTimeout(loadTransitions, 100);
    return () => clearTimeout(timeout);
  }, []);

  const setTransitions = async (newTransitions: StatusTransition[]) => {
    setTransitionsState(newTransitions);
  };

  return { transitions, loading, setTransitions };
}
