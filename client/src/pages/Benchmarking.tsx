import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Calendar, ChevronLeft, ChevronRight, Clock, Target } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, parseISO } from "date-fns";

type Task = {
  id: string;
  title: string;
  estimated_hours: number;
  time_spent_minutes: number;
  created_at: string;
  status: string;
  assigned_to: string;
};

type OrganizationSettings = {
  id: string;
  benchmarking_enabled: boolean;
  min_hours_per_day: number;
  max_hours_per_day: number;
  min_hours_per_week: number;
  max_hours_per_week: number;
  min_hours_per_month: number;
  max_hours_per_month: number;
  allow_user_level_override: boolean;
};

type BenchmarkingData = {
  date: string;
  totalTasks: number;
  totalHours: number;
  status: 'below' | 'within' | 'above';
};

const Benchmarking: React.FC = () => {
  const { user } = useCurrentUserRoleAndTeams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('monthly');

  // Fetch organization settings
  const { data: settings } = useQuery<OrganizationSettings>({
    queryKey: ['/api/organization-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/organization-settings');
      return response;
    }
  });

  // Fetch user tasks with time tracking data
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/users', user?.id, 'tasks'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await apiClient.get(`/users/${user.id}/tasks`);
      return response;
    },
    enabled: !!user?.id
  });

  // Tasks are already filtered for current user from the API
  const userTasks = tasks || [];

  // Get date range based on view type
  const dateRange = useMemo(() => {
    if (viewType === 'weekly') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  }, [currentDate, viewType]);

  // Calculate benchmarking data for each day
  const benchmarkingData = useMemo(() => {
    console.log('Benchmarking calculation:', { 
      settings: !!settings, 
      userTasksCount: userTasks.length, 
      dateRange,
      sampleTask: userTasks[0],
      allTasks: userTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        is_time_managed: task.is_time_managed,
        time_spent_minutes: task.time_spent_minutes,
        estimated_hours: task.estimated_hours,
        actual_completion_date: task.actual_completion_date,
        updated_at: task.updated_at
      }))
    });
    
    if (!settings || !userTasks.length) return [];

    const days = eachDayOfInterval(dateRange);
    
    return days.map(day => {
      // Filter tasks that had work done on this day
      const dayTasks = userTasks.filter(task => {
        // For time-managed tasks, check if they were updated on this day with time spent
        if (task.is_time_managed && task.time_spent_minutes > 0) {
          const taskDate = parseISO(task.updated_at);
          return isSameDay(taskDate, day);
        }
        
        // For non-time-managed completed tasks, check if they were completed on this day
        if (!task.is_time_managed && task.status === 'completed' && task.estimated_hours > 0) {
          const completionDate = task.actual_completion_date ? parseISO(task.actual_completion_date) : parseISO(task.updated_at);
          return isSameDay(completionDate, day);
        }
        
        return false;
      });

      const totalTasks = dayTasks.length;
      const totalHours = dayTasks.reduce((sum, task) => {
        // For time-managed tasks, use actual time spent
        if (task.is_time_managed && task.time_spent_minutes > 0) {
          return sum + task.time_spent_minutes / 60;
        }
        
        // For non-time-managed completed tasks, use estimated hours as effort
        if (!task.is_time_managed && task.status === 'completed' && task.estimated_hours > 0) {
          return sum + task.estimated_hours;
        }
        
        return sum;
      }, 0);

      let status: 'below' | 'within' | 'above' = 'within';
      if (totalHours < settings.min_hours_per_day) {
        status = 'below';
      } else if (totalHours > settings.max_hours_per_day) {
        status = 'above';
      }

      return {
        date: format(day, 'yyyy-MM-dd'),
        totalTasks,
        totalHours: Math.round(totalHours * 100) / 100,
        status
      };
    });
  }, [userTasks, dateRange, settings]);

  // Calculate period totals
  const periodTotals = useMemo(() => {
    const totalTasks = benchmarkingData.reduce((sum, day) => sum + day.totalTasks, 0);
    const totalHours = benchmarkingData.reduce((sum, day) => sum + day.totalHours, 0);
    
    let periodStatus: 'below' | 'within' | 'above' = 'within';
    const targetHours = viewType === 'weekly' 
      ? (settings?.max_hours_per_week || 40)
      : (settings?.max_hours_per_month || 160);
    const minHours = viewType === 'weekly'
      ? (settings?.min_hours_per_week || 0)
      : (settings?.min_hours_per_month || 0);

    if (totalHours < minHours) {
      periodStatus = 'below';
    } else if (totalHours > targetHours) {
      periodStatus = 'above';
    }

    return { totalTasks, totalHours: Math.round(totalHours * 100) / 100, periodStatus };
  }, [benchmarkingData, viewType, settings]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (viewType === 'weekly') {
      setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    }
  };

  const getStatusColor = (status: 'below' | 'within' | 'above') => {
    switch (status) {
      case 'below':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'within':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'above':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadgeVariant = (status: 'below' | 'within' | 'above') => {
    switch (status) {
      case 'below':
        return 'destructive' as const;
      case 'within':
        return 'default' as const;
      case 'above':
        return 'secondary' as const;
    }
  };

  if (!settings?.benchmarking_enabled) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Benchmarking Not Enabled</h3>
            <p className="text-muted-foreground text-center">
              Benchmarking has not been enabled for this organization. 
              Contact your administrator to enable this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Benchmarking
          </h1>
          <p className="text-muted-foreground">Track your productivity against organizational benchmarks</p>
        </div>
      </div>

      {/* Period Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {viewType === 'weekly' ? 'Weekly' : 'Monthly'} Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{periodTotals.totalTasks}</div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{periodTotals.totalHours}h</div>
              <div className="text-sm text-muted-foreground">Total Hours</div>
            </div>
            <div className="text-center">
              <Badge variant={getStatusBadgeVariant(periodTotals.periodStatus)}>
                {periodTotals.periodStatus === 'below' && 'Below Target'}
                {periodTotals.periodStatus === 'within' && 'On Target'}
                {periodTotals.periodStatus === 'above' && 'Above Target'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, viewType === 'weekly' ? "'Week of' MMM dd, yyyy" : "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'weekly' | 'monthly')}>
                <TabsList>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={() => navigatePeriod('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigatePeriod('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-2 ${viewType === 'weekly' ? 'grid-cols-7' : 'grid-cols-7'}`}>
            {/* Day headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            
            {/* Calendar cells */}
            {benchmarkingData.map((dayData, index) => {
              const date = new Date(dayData.date);
              const isToday = isSameDay(date, new Date());
              
              return (
                <div
                  key={dayData.date}
                  className={`
                    min-h-[100px] border rounded-lg p-2 space-y-1
                    ${getStatusColor(dayData.status)}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                  `}
                >
                  <div className="font-semibold text-sm">
                    {format(date, 'd')}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{dayData.totalTasks}</span>
                      <span>tasks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{dayData.totalHours}h</span>
                      <span>logged</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium">Daily Target</div>
              <div>{settings.min_hours_per_day}h - {settings.max_hours_per_day}h</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Weekly Target</div>
              <div>{settings.min_hours_per_week}h - {settings.max_hours_per_week}h</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Monthly Target</div>
              <div>{settings.min_hours_per_month}h - {settings.max_hours_per_month}h</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="font-medium text-sm">Color Legend:</div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                <span>On Target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                <span>Below Target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                <span>Above Target</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Benchmarking;