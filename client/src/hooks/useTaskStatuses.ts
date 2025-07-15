
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
  const { data: transitions = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['/api/task-status-transitions'],
    queryFn: async () => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      const response = await fetch('/api/task-status-transitions', {
        headers: {
          'x-user-id': user?.id || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transitions');
      }
      return response.json();
    },
  });

  const setTransitions = async (newTransitions: StatusTransition[]) => {
    // For now, just refetch from the server after changes
    refetch();
  };

  return { transitions, loading, setTransitions };
}
