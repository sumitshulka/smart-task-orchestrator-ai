import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { getActiveTimers } from '@/integrations/supabase/tasks';
import { useAuth } from '@/contexts/AuthContext';
import TaskTimer from './TaskTimer';

interface ActiveTimersBarProps {
  onTaskUpdated?: () => void;
}

export default function ActiveTimersBar({ onTaskUpdated }: ActiveTimersBarProps) {
  const { user } = useAuth();

  const { data: activeTimers = [], refetch } = useQuery({
    queryKey: ['/api/users', user?.id, 'active-timers'],
    queryFn: () => user ? getActiveTimers(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
    refetchInterval: 5000, // Refresh every 5 seconds to keep timers updated
    staleTime: 0, // Always consider stale to get fresh data
  });

  const handleTaskUpdated = () => {
    refetch();
    onTaskUpdated?.();
  };

  if (!activeTimers.length) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-semibold text-foreground">Active Timers</h3>
        <span className="text-sm text-muted-foreground">
          ({activeTimers.length}/2)
        </span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {activeTimers.map((task) => {
          // Calculate if timer is delayed
          const currentTime = task.time_spent_minutes || 0;
          const estimatedMinutes = (task.estimated_hours || 0) * 60;
          const isDelayed = task.estimated_hours && currentTime > estimatedMinutes && task.timer_state === 'running';
          
          return (
            <Card key={task.id} className={`${isDelayed ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800' : 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800'}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        #{task.task_number || task.id.slice(0, 8)}
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full animate-pulse ml-3 mt-1 ${isDelayed ? 'bg-red-500' : 'bg-green-500'}`} />
                  </div>
                  
                  <TaskTimer 
                    task={task} 
                    onTaskUpdated={handleTaskUpdated}
                    compact={true}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}