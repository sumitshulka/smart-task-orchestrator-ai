
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
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
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("task_statuses")
      .select("*")
      .order("sequence_order", { ascending: true })
      .then(({ data }) => {
        setStatuses(data || []);
        setLoading(false);
      });
  }, []);

  return { statuses, loading, setStatuses };
}

export function useStatusTransitions() {
  const [transitions, setTransitions] = useState<StatusTransition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("task_status_transitions")
      .select("*")
      .then(({ data }) => {
        setTransitions(data || []);
        setLoading(false);
      });
  }, []);

  return { transitions, loading, setTransitions };
}
