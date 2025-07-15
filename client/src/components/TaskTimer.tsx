import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, Square } from 'lucide-react';
import { Task, startTaskTimer, pauseTaskTimer, stopTaskTimer } from '@/integrations/supabase/tasks';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface TaskTimerProps {
  task: Task;
  onTaskUpdated?: () => void;
  compact?: boolean;
}

export default function TaskTimer({ task, onTaskUpdated, compact = false }: TaskTimerProps) {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate current elapsed time
  useEffect(() => {
    if (task.timer_state === 'running' && task.timer_started_at) {
      const interval = setInterval(() => {
        const startTime = new Date(task.timer_started_at!).getTime();
        const now = new Date().getTime();
        const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
        const totalMinutes = (task.time_spent_minutes || 0) + elapsedMinutes;
        setCurrentTime(totalMinutes);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCurrentTime(task.time_spent_minutes || 0);
    }
  }, [task.timer_state, task.timer_started_at, task.time_spent_minutes]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleTimerAction = async (action: 'start' | 'pause' | 'stop') => {
    if (!user?.id) return;
    
    // Check if task is in a final state where timer should not be allowed
    const finalStatuses = ['completed', 'review'];
    if (finalStatuses.includes(task.status.toLowerCase())) {
      toast({ 
        title: 'Timer unavailable', 
        description: 'Timer actions are not allowed for completed or review tasks',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      switch (action) {
        case 'start':
          await startTaskTimer(task.id, user.id);
          toast({ title: 'Timer started', description: `Timer started for "${task.title}"` });
          break;
        case 'pause':
          await pauseTaskTimer(task.id, user.id);
          toast({ title: 'Timer paused', description: `Timer paused for "${task.title}"` });
          break;
        case 'stop':
          await stopTaskTimer(task.id, user.id);
          toast({ title: 'Timer stopped', description: `Timer stopped for "${task.title}"` });
          break;
      }
      onTaskUpdated?.();
    } catch (error) {
      toast({ 
        title: 'Timer action failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task.is_time_managed) {
    return null;
  }

  if (compact) {
    const estimatedMinutes = (task.estimated_hours || 0) * 60;
    const timeRemaining = Math.max(0, estimatedMinutes - currentTime);
    const isLowTime = timeRemaining > 0 && timeRemaining < 15;
    const isDelayed = task.estimated_hours && currentTime > estimatedMinutes && task.timer_state === 'running';
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{formatTime(currentTime)}</span>
          {task.estimated_hours && (
            <span className="text-xs text-muted-foreground">
              / {formatTime(estimatedMinutes)}
            </span>
          )}
        </div>
        {task.estimated_hours && !isDelayed && (
          <div className={`text-xs ${isLowTime ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {formatTime(timeRemaining)} left
          </div>
        )}
        {isDelayed && (
          <Badge variant="destructive" className="text-xs py-0 px-1">
            Delayed
          </Badge>
        )}
        {task.timer_state === 'running' && (
          <div className={`w-2 h-2 rounded-full animate-pulse ${isDelayed ? 'bg-red-500' : 'bg-green-500'}`} />
        )}
      </div>
    );
  }

  // Calculate time allocation details
  const estimatedMinutes = (task.estimated_hours || 0) * 60;
  const timeRemaining = Math.max(0, estimatedMinutes - currentTime);
  const isLowTime = timeRemaining > 0 && timeRemaining < 15;
  const isDelayed = task.estimated_hours && currentTime > estimatedMinutes && task.timer_state === 'running';
  
  // Check if task is in final state where timer controls should be disabled
  const finalStatuses = ['completed', 'review'];
  const isTimerDisabled = finalStatuses.includes(task.status.toLowerCase());
  
  return (
    <Card className={`w-full ${isDelayed ? 'border-red-500 bg-red-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">{formatTime(currentTime)}</div>
              {task.estimated_hours && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Total: {formatTime(estimatedMinutes)}
                  </div>
                  {!isDelayed && (
                    <div className={`text-sm ${isLowTime ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      Remaining: {formatTime(timeRemaining)}
                    </div>
                  )}
                  {isDelayed && (
                    <div className="text-sm text-red-600 font-medium">
                      Exceeded by: {formatTime(currentTime - estimatedMinutes)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isDelayed && (
              <Badge variant="destructive">
                Delayed
              </Badge>
            )}
            <Badge variant={
              task.timer_state === 'running' ? 'default' : 
              task.timer_state === 'paused' ? 'secondary' : 'outline'
            }>
              {task.timer_state === 'running' ? 'Running' : 
               task.timer_state === 'paused' ? 'Paused' : 'Stopped'}
            </Badge>
            
            {!isTimerDisabled && (
              <div className="flex gap-1">
                {task.timer_state !== 'running' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTimerAction('start')}
                    disabled={isLoading}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                {task.timer_state === 'running' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTimerAction('pause')}
                    disabled={isLoading}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                
                {task.timer_state !== 'stopped' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTimerAction('stop')}
                    disabled={isLoading}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            
            {isTimerDisabled && (
              <div className="text-xs text-muted-foreground px-2">
                Timer controls disabled for {task.status} tasks
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}