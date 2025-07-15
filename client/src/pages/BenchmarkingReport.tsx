import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Search, TrendingDown, TrendingUp, Target, Calendar, Users } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { format, subDays, subWeeks, subMonths, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type User = {
  id: string;
  user_name: string;
  email: string;
  department: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  is_time_managed: boolean;
  time_spent_minutes: number;
  estimated_hours: number;
  assigned_to: string;
  actual_completion_date: string;
  updated_at: string;
  created_at: string;
};

type OrganizationSettings = {
  benchmarking_enabled: boolean;
  min_hours_per_day: number;
  max_hours_per_day: number;
  min_hours_per_week: number;
  max_hours_per_week: number;
  min_hours_per_month: number;
  max_hours_per_month: number;
};

type BenchmarkData = {
  userId: string;
  userName: string;
  department: string;
  dailyHours: { [date: string]: number };
  weeklyHours: { [weekStart: string]: number };
  monthlyHours: { [monthStart: string]: number };
  totalTasks: number;
  averageDailyHours: number;
  averageWeeklyHours: number;
  averageMonthlyHours: number;
  daysAboveMax: number;
  daysBelowMin: number;
  weeksAboveMax: number;
  weeksBelowMin: number;
  isConsistentlyLow: boolean;
  isConsistentlyHigh: boolean;
  isExactHours: boolean;
};

type QueryResult = {
  users: BenchmarkData[];
  queryType: string;
  description: string;
  matchedPattern: string;
  queryStartDate?: Date;
  queryEndDate?: Date;
  timeToken?: string | null;
};

const BenchmarkingReport: React.FC = () => {
  const { user } = useCurrentUserRoleAndTeams();
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("month");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch organization settings
  const { data: settings } = useQuery<OrganizationSettings>({
    queryKey: ['/api/organization-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/organization-settings');
      return response;
    }
  });

  // Fetch all users (filtered by role permissions)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response;
    }
  });

  // Fetch all tasks
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await apiClient.get('/tasks');
      return response;
    }
  });

  // Get the current date range being analyzed
  const getAnalysisDateRange = () => {
    const endDate = new Date();
    let startDate;
    
    if (timeRange === "week") {
      // Last 4 weeks
      startDate = subWeeks(endDate, 4);
    } else if (timeRange === "month") {
      // Last 3 months
      startDate = subMonths(endDate, 3);
    } else {
      // Last 30 days
      startDate = subDays(endDate, 30);
    }
    
    return { startDate, endDate };
  };

  const { startDate: analysisStartDate, endDate: analysisEndDate } = getAnalysisDateRange();

  // Calculate benchmarking data for all users
  const benchmarkingData = useMemo(() => {
    if (!settings || !users.length || !allTasks.length) return [];

    console.log("Benchmarking calculation debug:", {
      settingsEnabled: settings.benchmarking_enabled,
      usersCount: users.length,
      allTasksCount: allTasks.length,
      timeRange,
      analysisStartDate: format(analysisStartDate, 'yyyy-MM-dd'),
      analysisEndDate: format(analysisEndDate, 'yyyy-MM-dd')
    });

    return users.map(user => {
      const userTasks = allTasks.filter(task => task.assigned_to === user.id);
      console.log(`User ${user.user_name || user.email} tasks:`, userTasks.length);

      const relevantTasks = userTasks.filter(task => {
        const taskDate = parseISO(task.updated_at || task.created_at);
        const isInRange = taskDate >= analysisStartDate && taskDate <= analysisEndDate;
        if (task.assigned_to === user.id) {
          console.log(`Task ${task.title}: date=${format(taskDate, 'yyyy-MM-dd')}, inRange=${isInRange}, timeSpent=${task.time_spent_minutes}, estimated=${task.estimated_hours}, status=${task.status}`);
        }
        return isInRange;
      });

      const dailyHours: { [date: string]: number } = {};
      const weeklyHours: { [weekStart: string]: number } = {};
      const monthlyHours: { [monthStart: string]: number } = {};

      relevantTasks.forEach(task => {
        let hours = 0;
        
        // For time-managed tasks, use time_spent_minutes regardless of status
        if (task.is_time_managed && task.time_spent_minutes > 0) {
          hours = task.time_spent_minutes / 60;
        } 
        // For non-time-managed tasks, use estimated_hours only if completed
        else if (!task.is_time_managed && task.status === 'completed' && task.estimated_hours > 0) {
          hours = task.estimated_hours;
        }

        if (hours > 0) {
          // Use actual_completion_date if available, otherwise updated_at, then created_at
          let taskDate;
          if (task.actual_completion_date) {
            taskDate = parseISO(task.actual_completion_date);
          } else if (task.updated_at) {
            taskDate = parseISO(task.updated_at);
          } else {
            taskDate = parseISO(task.created_at);
          }

          const dateKey = format(taskDate, 'yyyy-MM-dd');
          // Use startOfWeek with Sunday as the first day (options: { weekStartsOn: 0 })
          const weekKey = format(startOfWeek(taskDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
          const monthKey = format(startOfMonth(taskDate), 'yyyy-MM-dd');

          dailyHours[dateKey] = (dailyHours[dateKey] || 0) + hours;
          weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + hours;
          monthlyHours[monthKey] = (monthlyHours[monthKey] || 0) + hours;

          console.log(`Added ${hours} hours for user ${user.user_name || user.email} on ${dateKey} (week: ${weekKey})`);
        }
      });

      const dailyValues = Object.values(dailyHours);
      const weeklyValues = Object.values(weeklyHours);
      const monthlyValues = Object.values(monthlyHours);

      // Log detailed weekly breakdown for debugging (only for key user)
      if (user.user_name === "Sumit Shukla" || user.email === "ss@sumits.me") {
        console.log(`${user.user_name || user.email} weekly hours breakdown:`, weeklyHours);
        console.log(`${user.user_name || user.email} daily hours breakdown:`, dailyHours);
      }

      const averageDailyHours = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
      const averageWeeklyHours = weeklyValues.length > 0 ? weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length : 0;
      const averageMonthlyHours = monthlyValues.length > 0 ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length : 0;

      const daysAboveMax = dailyValues.filter(h => h > settings.max_hours_per_day).length;
      const daysBelowMin = dailyValues.filter(h => h > 0 && h < settings.min_hours_per_day).length;
      const weeksAboveMax = weeklyValues.filter(h => h > settings.max_hours_per_week).length;
      const weeksBelowMin = weeklyValues.filter(h => h > 0 && h < settings.min_hours_per_week).length;

      const isConsistentlyLow = weeklyValues.length === 0 || (weeklyValues.length >= 1 && weeklyValues.every(h => h < settings.min_hours_per_week));
      // Log only for debugging specific users
      if (user.user_name === "Sumit Shukla") {
        console.log(`User ${user.user_name || user.email}: weeklyValues=${weeklyValues.length}, isConsistentlyLow=${isConsistentlyLow}, minHours=${settings.min_hours_per_week}`);
      }
      const isConsistentlyHigh = weeklyValues.length >= 2 && weeklyValues.every(h => h > settings.max_hours_per_week);
      const isExactHours = weeklyValues.some(h => h === settings.max_hours_per_week || h === settings.min_hours_per_week);

      return {
        userId: user.id,
        userName: user.user_name || user.email,
        department: user.department || "Unknown",
        dailyHours,
        weeklyHours,
        monthlyHours,
        totalTasks: relevantTasks.length,
        averageDailyHours,
        averageWeeklyHours,
        averageMonthlyHours,
        daysAboveMax,
        daysBelowMin,
        weeksAboveMax,
        weeksBelowMin,
        isConsistentlyLow,
        isConsistentlyHigh,
        isExactHours
      };
    });
  }, [settings, users, allTasks, timeRange]);

  // Parse time-related tokens from the query
  const parseTimeTokens = (queryText: string) => {
    const lowerQuery = queryText.toLowerCase();
    
    // Check for specific time periods in the query
    if (lowerQuery.includes("this week") || lowerQuery.includes("current week")) {
      return "current_week";
    } else if (lowerQuery.includes("last week") || lowerQuery.includes("previous week")) {
      return "last_week";
    } else if (lowerQuery.includes("this month") || lowerQuery.includes("current month")) {
      return "current_month";
    } else if (lowerQuery.includes("last month") || lowerQuery.includes("previous month")) {
      return "last_month";
    } else if (lowerQuery.includes("today")) {
      return "today";
    } else if (lowerQuery.includes("yesterday")) {
      return "yesterday";
    } else if (lowerQuery.includes("week") && !lowerQuery.includes("weeks")) {
      // Generic "week" reference defaults to current week
      return "current_week";
    } else if (lowerQuery.includes("month") && !lowerQuery.includes("months")) {
      // Generic "month" reference defaults to current month
      return "current_month";
    }
    
    // No specific time token found, use default time range
    return null;
  };

  // Calculate dynamic date range based on query tokens
  const getQueryBasedDateRange = (timeToken: string | null) => {
    const now = new Date();
    
    switch (timeToken) {
      case "current_week":
        return {
          startDate: startOfWeek(now, { weekStartsOn: 0 }),
          endDate: endOfWeek(now, { weekStartsOn: 0 })
        };
      case "last_week":
        const lastWeek = subWeeks(now, 1);
        return {
          startDate: startOfWeek(lastWeek, { weekStartsOn: 0 }),
          endDate: endOfWeek(lastWeek, { weekStartsOn: 0 })
        };
      case "current_month":
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth)
        };
      case "today":
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now)
        };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return {
          startDate: startOfDay(yesterday),
          endDate: endOfDay(yesterday)
        };
      default:
        // Fall back to default time range setting
        return { startDate: analysisStartDate, endDate: analysisEndDate };
    }
  };

  // NLP Query Processing
  const processNaturalLanguageQuery = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    const lowerQuery = query.toLowerCase();

    console.log(`Processing query: "${query}" -> lowercased: "${lowerQuery}"`);
    
    // Parse time tokens from the query
    const timeToken = parseTimeTokens(query);
    const { startDate: queryStartDate, endDate: queryEndDate } = getQueryBasedDateRange(timeToken);
    
    console.log(`Time token extracted: ${timeToken}`);

    // Recalculate benchmarking data based on query-specific date range
    const queryBenchmarkingData = users.map(user => {
      const userTasks = allTasks.filter(task => task.assigned_to === user.id);
      const relevantTasks = userTasks.filter(task => {
        const taskDate = parseISO(task.updated_at || task.created_at);
        return taskDate >= queryStartDate && taskDate <= queryEndDate;
      });

      const dailyHours: { [date: string]: number } = {};
      const weeklyHours: { [weekStart: string]: number } = {};
      const monthlyHours: { [monthStart: string]: number } = {};

      relevantTasks.forEach(task => {
        let hours = 0;
        
        if (task.is_time_managed && task.time_spent_minutes > 0) {
          hours = task.time_spent_minutes / 60;
        } else if (!task.is_time_managed && task.status === 'completed' && task.estimated_hours > 0) {
          hours = task.estimated_hours;
        }

        if (hours > 0) {
          let taskDate;
          if (task.actual_completion_date) {
            taskDate = parseISO(task.actual_completion_date);
          } else if (task.updated_at) {
            taskDate = parseISO(task.updated_at);
          } else {
            taskDate = parseISO(task.created_at);
          }

          const dateKey = format(taskDate, 'yyyy-MM-dd');
          const weekKey = format(startOfWeek(taskDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
          const monthKey = format(startOfMonth(taskDate), 'yyyy-MM-dd');

          dailyHours[dateKey] = (dailyHours[dateKey] || 0) + hours;
          weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + hours;
          monthlyHours[monthKey] = (monthlyHours[monthKey] || 0) + hours;
        }
      });

      const dailyValues = Object.values(dailyHours);
      const weeklyValues = Object.values(weeklyHours);
      const monthlyValues = Object.values(monthlyHours);

      const averageDailyHours = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
      const averageWeeklyHours = weeklyValues.length > 0 ? weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length : 0;
      const averageMonthlyHours = monthlyValues.length > 0 ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length : 0;

      const totalHoursInPeriod = dailyValues.reduce((a, b) => a + b, 0);

      return {
        userId: user.id,
        userName: user.user_name || user.email,
        department: user.department || "Unknown",
        dailyHours,
        weeklyHours,
        monthlyHours,
        totalTasks: relevantTasks.length,
        averageDailyHours,
        averageWeeklyHours,
        averageMonthlyHours,
        totalHoursInPeriod,
        daysAboveMax: dailyValues.filter(h => h > settings?.max_hours_per_day).length,
        daysBelowMin: dailyValues.filter(h => h > 0 && h < settings?.min_hours_per_day).length,
        weeksAboveMax: weeklyValues.filter(h => h > settings?.max_hours_per_week).length,
        weeksBelowMin: weeklyValues.filter(h => h > 0 && h < settings?.min_hours_per_week).length,
        isConsistentlyLow: weeklyValues.length === 0 || (weeklyValues.length >= 1 && weeklyValues.every(h => h < settings?.min_hours_per_week)),
        isConsistentlyHigh: weeklyValues.length >= 1 && weeklyValues.every(h => h > settings?.max_hours_per_week),
        isExactHours: weeklyValues.some(h => h === settings?.max_hours_per_week || h === settings?.min_hours_per_week)
      };
    });

    let matchedUsers: any[] = [];
    let queryType = "unknown";
    let description = "";
    let matchedPattern = "";

    try {
      console.log(`Starting pattern matching for query: "${lowerQuery}"`);
      console.log(`Data available: queryBenchmarkingData has ${queryBenchmarkingData?.length || 0} users`);
      console.log(`QueryBenchmarkingData:`, queryBenchmarkingData);
      
      if (!queryBenchmarkingData || queryBenchmarkingData.length === 0) {
        console.log(`No data available for analysis, using fallback`);
        matchedUsers = [];
        queryType = "no_data";
        description = "No benchmarking data available";
        matchedPattern = "no data";
      } else {
        console.log(`Data exists, proceeding with pattern matching`);
        // Pattern matching for different query types
        console.log(`Testing first condition: achieved/surpassed/exceeded + benchmark`);
        if ((lowerQuery.includes("achieved") || lowerQuery.includes("surpassed") || lowerQuery.includes("exceeded")) && lowerQuery.includes("benchmark")) {
          console.log(`Matched: achieved/surpassed/exceeded benchmark`);
          matchedUsers = queryBenchmarkingData.filter(user => 
            user.averageWeeklyHours >= settings?.min_hours_per_week || user.totalHoursInPeriod >= settings?.min_hours_per_week
          );
          queryType = "achieved_benchmark";
          description = "Users who have achieved, surpassed, or exceeded the benchmark";
          matchedPattern = "achieved/surpassed/exceeded benchmark";
        }
        else if (lowerQuery.includes("consistently below") && lowerQuery.includes("min")) {
          console.log(`Testing condition: consistently below min`);
          matchedUsers = queryBenchmarkingData.filter(user => user.isConsistentlyLow);
          queryType = "consistently_below_min";
          description = "Users who are consistently below minimum benchmark";
          matchedPattern = "consistently below min benchmark";
        }
        else if (lowerQuery.includes("consistently above") || lowerQuery.includes("always above")) {
          matchedUsers = queryBenchmarkingData.filter(user => user.isConsistentlyHigh);
          queryType = "consistently_above_max";
          description = "Users who are consistently above maximum benchmark";
          matchedPattern = "consistently/always above benchmark";
        }
        else if (lowerQuery.includes("exact") && (lowerQuery.includes("hours") || lowerQuery.includes("benchmark"))) {
          matchedUsers = queryBenchmarkingData.filter(user => user.isExactHours);
          queryType = "exact_hours";
          description = "Users showing exact benchmark hours";
          matchedPattern = "exact hours/benchmark";
        }
        else if (lowerQuery.includes("below") && lowerQuery.includes("min")) {
          matchedUsers = queryBenchmarkingData.filter(user => user.weeksBelowMin > 0);
          queryType = "below_min";
          description = "Users with weeks below minimum benchmark";
          matchedPattern = "below min";
        }
        else if (lowerQuery.includes("above") && lowerQuery.includes("max")) {
          matchedUsers = queryBenchmarkingData.filter(user => user.weeksAboveMax > 0);
          queryType = "above_max";
          description = "Users with weeks above maximum benchmark";
          matchedPattern = "above max";
        }
        else if (lowerQuery.includes("low perform") || lowerQuery.includes("underperform")) {
        matchedUsers = queryBenchmarkingData.filter(user => 
          user.averageWeeklyHours < settings?.min_hours_per_week || user.daysBelowMin > user.daysAboveMax
        );
        queryType = "low_performance";
        description = "Low performing users";
        matchedPattern = "low perform/underperform";
      }
      else if (lowerQuery.includes("high perform") || lowerQuery.includes("overperform")) {
        matchedUsers = queryBenchmarkingData.filter(user => 
          user.averageWeeklyHours > settings?.max_hours_per_week || user.daysAboveMax > user.daysBelowMin
        );
        queryType = "high_performance";
        description = "High performing users";
        matchedPattern = "high perform/overperform";
      }
      else if (lowerQuery.includes("task") && (lowerQuery.includes("more than") || lowerQuery.includes("greater than") || lowerQuery.includes("over") || lowerQuery.includes("above"))) {
        // Parse numerical task count conditions like "more than 5 tasks"
        const taskCountMatch = lowerQuery.match(/(?:more than|greater than|over|above)\s+(\d+)\s+task/);
        if (taskCountMatch) {
          const threshold = parseInt(taskCountMatch[1]);
          matchedUsers = queryBenchmarkingData.filter(user => user.totalTasks > threshold);
          queryType = "task_count_above";
          description = `Users with more than ${threshold} tasks`;
          matchedPattern = `task count > ${threshold}`;
          console.log(`Task count filtering: threshold=${threshold}, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("task") && (lowerQuery.includes("less than") || lowerQuery.includes("fewer than") || lowerQuery.includes("under") || lowerQuery.includes("below"))) {
        // Parse numerical task count conditions like "less than 3 tasks"
        const taskCountMatch = lowerQuery.match(/(?:less than|fewer than|under|below)\s+(\d+)\s+task/);
        if (taskCountMatch) {
          const threshold = parseInt(taskCountMatch[1]);
          matchedUsers = queryBenchmarkingData.filter(user => user.totalTasks < threshold);
          queryType = "task_count_below";
          description = `Users with less than ${threshold} tasks`;
          matchedPattern = `task count < ${threshold}`;
          console.log(`Task count filtering: threshold=${threshold}, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("task") && (lowerQuery.includes("exactly") || lowerQuery.includes("equal") || lowerQuery.match(/\b(\d+)\s+task/))) {
        // Parse exact task count like "exactly 5 tasks" or "5 tasks"
        let taskCountMatch = lowerQuery.match(/exactly\s+(\d+)\s+task/) || lowerQuery.match(/equal\s+to\s+(\d+)\s+task/);
        if (!taskCountMatch) {
          taskCountMatch = lowerQuery.match(/\b(\d+)\s+task/);
        }
        if (taskCountMatch) {
          const exactCount = parseInt(taskCountMatch[1]);
          matchedUsers = queryBenchmarkingData.filter(user => user.totalTasks === exactCount);
          queryType = "task_count_exact";
          description = `Users with exactly ${exactCount} tasks`;
          matchedPattern = `task count = ${exactCount}`;
          console.log(`Task count filtering: exactCount=${exactCount}, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("hour") && (lowerQuery.includes("more than") || lowerQuery.includes("greater than") || lowerQuery.includes("over") || lowerQuery.includes("above"))) {
        // Parse numerical hours conditions like "more than 20 hours per week"
        const hoursMatch = lowerQuery.match(/(?:more than|greater than|over|above)\s+(\d+)\s+hour/);
        if (hoursMatch) {
          const threshold = parseInt(hoursMatch[1]);
          if (lowerQuery.includes("week")) {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageWeeklyHours > threshold);
            description = `Users with more than ${threshold} hours per week`;
            matchedPattern = `weekly hours > ${threshold}`;
          } else if (lowerQuery.includes("day")) {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageDailyHours > threshold);
            description = `Users with more than ${threshold} hours per day`;
            matchedPattern = `daily hours > ${threshold}`;
          } else {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageWeeklyHours > threshold);
            description = `Users with more than ${threshold} hours (weekly average)`;
            matchedPattern = `weekly hours > ${threshold}`;
          }
          queryType = "hours_above";
          console.log(`Hours filtering: threshold=${threshold}, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("hour") && (lowerQuery.includes("less than") || lowerQuery.includes("fewer than") || lowerQuery.includes("under") || lowerQuery.includes("below"))) {
        // Parse numerical hours conditions like "less than 10 hours per week"
        const hoursMatch = lowerQuery.match(/(?:less than|fewer than|under|below)\s+(\d+)\s+hour/);
        if (hoursMatch) {
          const threshold = parseInt(hoursMatch[1]);
          if (lowerQuery.includes("week")) {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageWeeklyHours < threshold);
            description = `Users with less than ${threshold} hours per week`;
            matchedPattern = `weekly hours < ${threshold}`;
          } else if (lowerQuery.includes("day")) {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageDailyHours < threshold);
            description = `Users with less than ${threshold} hours per day`;
            matchedPattern = `daily hours < ${threshold}`;
          } else {
            matchedUsers = queryBenchmarkingData.filter(user => user.averageWeeklyHours < threshold);
            description = `Users with less than ${threshold} hours (weekly average)`;
            matchedPattern = `weekly hours < ${threshold}`;
          }
          queryType = "hours_below";
          console.log(`Hours filtering: threshold=${threshold}, matched=${matchedUsers.length} users`);
        }
        }
        else if (lowerQuery.includes("surpass") || lowerQuery.includes("exceed") || (lowerQuery.includes("over") && lowerQuery.includes("%"))) {
        console.log(`*** TESTING SURPASS CONDITION: query="${lowerQuery}" ***`);
        console.log(`*** SURPASS CHECK: includes surpass=${lowerQuery.includes("surpass")}, includes exceed=${lowerQuery.includes("exceed")}, includes over=${lowerQuery.includes("over")}, includes %=${lowerQuery.includes("%")} ***`);
        console.log(`*** ENTERING SURPASS/EXCEED CONDITION ***`);
        console.log(`Matched: surpass/exceed/over with % pattern`);
        console.log(`Condition breakdown: surpass=${lowerQuery.includes("surpass")}, exceed=${lowerQuery.includes("exceed")}, over=${lowerQuery.includes("over")}, %=${lowerQuery.includes("%")}`);
        // Parse percentage-based performance queries like "surpassed their hours by more than 10%"
        const percentMatch = lowerQuery.match(/(?:more than|over|above)\s+(\d+)%/) || lowerQuery.match(/by\s+more\s+than\s+(\d+)%/);
        console.log(`Percentage match result:`, percentMatch);
        console.log(`Query contains: surpass=${lowerQuery.includes("surpass")}, exceed=${lowerQuery.includes("exceed")}, over=${lowerQuery.includes("over")}, %=${lowerQuery.includes("%")}`);
        if (percentMatch) {
          const percentThreshold = parseInt(percentMatch[1]);
          
          if (lowerQuery.includes("hour") && (lowerQuery.includes("week") || lowerQuery.includes("weekly"))) {
            // Users who exceeded weekly hour targets by X%
            matchedUsers = queryBenchmarkingData.filter(user => {
              const targetHours = settings?.min_hours_per_week || 35;
              const actualHours = user.averageWeeklyHours;
              const exceedPercentage = ((actualHours - targetHours) / targetHours) * 100;
              return exceedPercentage > percentThreshold;
            });
            queryType = "weekly_hours_exceed_percent";
            description = `Users who exceeded weekly hour targets by more than ${percentThreshold}%`;
            matchedPattern = `weekly hours exceed > ${percentThreshold}%`;
          } else if (lowerQuery.includes("hour") && (lowerQuery.includes("day") || lowerQuery.includes("daily"))) {
            // Users who exceeded daily hour targets by X%
            matchedUsers = queryBenchmarkingData.filter(user => {
              const targetHours = settings?.min_hours_per_day || 8;
              const actualHours = user.averageDailyHours;
              const exceedPercentage = ((actualHours - targetHours) / targetHours) * 100;
              return exceedPercentage > percentThreshold;
            });
            queryType = "daily_hours_exceed_percent";
            description = `Users who exceeded daily hour targets by more than ${percentThreshold}%`;
            matchedPattern = `daily hours exceed > ${percentThreshold}%`;
          } else {
            // Default to weekly hours
            matchedUsers = queryBenchmarkingData.filter(user => {
              const targetHours = settings?.min_hours_per_week || 35;
              const actualHours = user.averageWeeklyHours;
              const exceedPercentage = ((actualHours - targetHours) / targetHours) * 100;
              return exceedPercentage > percentThreshold;
            });
            queryType = "hours_exceed_percent";
            description = `Users who exceeded hour targets by more than ${percentThreshold}%`;
            matchedPattern = `hours exceed > ${percentThreshold}%`;
          }
          console.log(`Percentage filtering: threshold=${percentThreshold}%, matched=${matchedUsers.length} users`);
        } else {
          console.log(`No percentage match found in query: "${lowerQuery}"`);
        }
      }
      else if (lowerQuery.includes("underperform") || lowerQuery.includes("below") && lowerQuery.includes("%")) {
        // Parse percentage-based underperformance queries like "below target by more than 20%"
        const percentMatch = lowerQuery.match(/(?:more than|over|above|by)\s+(\d+)%/);
        if (percentMatch) {
          const percentThreshold = parseInt(percentMatch[1]);
          
          if (lowerQuery.includes("hour") && (lowerQuery.includes("week") || lowerQuery.includes("weekly"))) {
            matchedUsers = benchmarkingData.filter(user => {
              const targetHours = settings?.min_hours_per_week || 35;
              const actualHours = user.averageWeeklyHours;
              const underPercentage = ((targetHours - actualHours) / targetHours) * 100;
              return underPercentage > percentThreshold;
            });
            queryType = "weekly_hours_under_percent";
            description = `Users below weekly hour targets by more than ${percentThreshold}%`;
            matchedPattern = `weekly hours under > ${percentThreshold}%`;
          } else {
            matchedUsers = benchmarkingData.filter(user => {
              const targetHours = settings?.min_hours_per_week || 35;
              const actualHours = user.averageWeeklyHours;
              const underPercentage = ((targetHours - actualHours) / targetHours) * 100;
              return underPercentage > percentThreshold;
            });
            queryType = "hours_under_percent";
            description = `Users below hour targets by more than ${percentThreshold}%`;
            matchedPattern = `hours under > ${percentThreshold}%`;
          }
          console.log(`Under-performance filtering: threshold=${percentThreshold}%, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("team") && (lowerQuery.includes("best") || lowerQuery.includes("top") || lowerQuery.includes("highest"))) {
        // Team performance analysis - top performing teams/departments
        const departmentStats = benchmarkingData.reduce((acc, user) => {
          const dept = user.department;
          if (!acc[dept]) {
            acc[dept] = { users: [], totalHours: 0, totalTasks: 0, count: 0 };
          }
          acc[dept].users.push(user);
          acc[dept].totalHours += user.averageWeeklyHours;
          acc[dept].totalTasks += user.totalTasks;
          acc[dept].count += 1;
          return acc;
        }, {} as Record<string, { users: any[], totalHours: number, totalTasks: number, count: number }>);
        
        const topDept = Object.entries(departmentStats)
          .sort(([,a], [,b]) => (b.totalHours / b.count) - (a.totalHours / a.count))[0];
        
        if (topDept) {
          matchedUsers = topDept[1].users;
          queryType = "top_team_performance";
          description = `Users from ${topDept[0]} department (highest performing team)`;
          matchedPattern = `top team: ${topDept[0]}`;
          console.log(`Team performance analysis: top department=${topDept[0]}, avg hours=${(topDept[1].totalHours / topDept[1].count).toFixed(1)}`);
        }
      }
      else if (lowerQuery.includes("team") && (lowerQuery.includes("worst") || lowerQuery.includes("bottom") || lowerQuery.includes("lowest"))) {
        // Team performance analysis - bottom performing teams/departments
        const departmentStats = benchmarkingData.reduce((acc, user) => {
          const dept = user.department;
          if (!acc[dept]) {
            acc[dept] = { users: [], totalHours: 0, totalTasks: 0, count: 0 };
          }
          acc[dept].users.push(user);
          acc[dept].totalHours += user.averageWeeklyHours;
          acc[dept].totalTasks += user.totalTasks;
          acc[dept].count += 1;
          return acc;
        }, {} as Record<string, { users: any[], totalHours: number, totalTasks: number, count: number }>);
        
        const bottomDept = Object.entries(departmentStats)
          .sort(([,a], [,b]) => (a.totalHours / a.count) - (b.totalHours / b.count))[0];
        
        if (bottomDept) {
          matchedUsers = bottomDept[1].users;
          queryType = "bottom_team_performance";
          description = `Users from ${bottomDept[0]} department (lowest performing team)`;
          matchedPattern = `bottom team: ${bottomDept[0]}`;
          console.log(`Team performance analysis: bottom department=${bottomDept[0]}, avg hours=${(bottomDept[1].totalHours / bottomDept[1].count).toFixed(1)}`);
        }
      }
      else if (lowerQuery.includes("completion") && lowerQuery.includes("%")) {
        // Task completion rate analysis
        const percentMatch = lowerQuery.match(/(?:more than|over|above|less than|below|under)\s+(\d+)%/);
        const isAbove = lowerQuery.includes("more than") || lowerQuery.includes("over") || lowerQuery.includes("above");
        
        if (percentMatch) {
          const percentThreshold = parseInt(percentMatch[1]);
          // For now, use a proxy metric - users with tasks vs target task load
          const avgTaskCount = benchmarkingData.reduce((sum, user) => sum + user.totalTasks, 0) / benchmarkingData.length;
          
          if (isAbove) {
            matchedUsers = benchmarkingData.filter(user => {
              const completionRate = avgTaskCount > 0 ? (user.totalTasks / avgTaskCount) * 100 : 0;
              return completionRate > 100 + percentThreshold;
            });
            description = `Users with task completion above average by ${percentThreshold}%`;
            matchedPattern = `completion rate > avg+${percentThreshold}%`;
          } else {
            matchedUsers = benchmarkingData.filter(user => {
              const completionRate = avgTaskCount > 0 ? (user.totalTasks / avgTaskCount) * 100 : 0;
              return completionRate < 100 - percentThreshold;
            });
            description = `Users with task completion below average by ${percentThreshold}%`;
            matchedPattern = `completion rate < avg-${percentThreshold}%`;
          }
          queryType = "completion_rate_analysis";
          console.log(`Completion rate filtering: threshold=${percentThreshold}%, matched=${matchedUsers.length} users`);
        }
      }
      else if (lowerQuery.includes("group") && (lowerQuery.includes("performance") || lowerQuery.includes("hour") || lowerQuery.includes("task"))) {
        // Group performance analysis
        if (lowerQuery.includes("above") || lowerQuery.includes("top")) {
          matchedUsers = benchmarkingData.filter(user => 
            user.averageWeeklyHours > (settings?.min_hours_per_week || 35) && user.totalTasks > 0
          );
          queryType = "group_above_target";
          description = "Users in above-target performance group";
          matchedPattern = "group performance: above target";
        } else if (lowerQuery.includes("below") || lowerQuery.includes("bottom")) {
          matchedUsers = queryBenchmarkingData.filter(user => 
            user.averageWeeklyHours < (settings?.min_hours_per_week || 35) || user.totalTasks === 0
          );
          queryType = "group_below_target";
          description = "Users in below-target performance group";
          matchedPattern = "group performance: below target";
        }
      }
      else if (lowerQuery.includes("department") || lowerQuery.includes("team")) {
        // Try multiple patterns to extract department name
        let dept = null;
        
        // Pattern 1: "department administration" or "team sales"
        let match = lowerQuery.match(/(?:department|team)\s+(\w+)/);
        if (match) dept = match[1];
        
        // Pattern 2: "from administration department" or "in sales team"
        if (!dept) {
          match = lowerQuery.match(/(?:from|in)\s+(\w+)\s+(?:department|team)/);
          if (match) dept = match[1];
        }
        
        // Pattern 3: "administration department" or "sales team" (just department name + word)
        if (!dept) {
          match = lowerQuery.match(/(\w+)\s+(?:department|team)/);
          if (match) dept = match[1];
        }
        
        console.log(`Department query processing: original="${query}", extracted="${dept}"`);
        
        if (dept) {
          matchedUsers = queryBenchmarkingData.filter(user => 
            user.department.toLowerCase().includes(dept.toLowerCase())
          );
          queryType = "department_filter";
          description = `Users from ${dept} department/team`;
          matchedPattern = `department/team: ${dept}`;
        }
      }
      else {
        console.log(`No patterns matched, falling back to general query. Query was: "${lowerQuery}"`);
        console.log(`Patterns checked: surpass=${lowerQuery.includes("surpass")}, exceed=${lowerQuery.includes("exceed")}, over=${lowerQuery.includes("over")}, %=${lowerQuery.includes("%")}`);
        // Default to showing all users with some analysis
        matchedUsers = queryBenchmarkingData;
        queryType = "general";
        description = "All users benchmarking data";
        matchedPattern = "general query";
      }
      } // Closing brace for main else block that contains all pattern matching
      
      console.log(`Pattern matching complete. Matched users: ${matchedUsers.length}, Query type: ${queryType}, Description: ${description}`);

      setQueryResult({
        users: matchedUsers,
        queryType,
        description,
        matchedPattern,
        queryStartDate,
        queryEndDate,
        timeToken
      });

    } catch (error) {
      console.error("Query processing error:", error);
      setQueryResult({
        users: [],
        queryType: "error",
        description: "Error processing query",
        matchedPattern: "error",
        queryStartDate,
        queryEndDate,
        timeToken
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      console.log(`Enter key pressed, processing query: "${query}"`);
      processNaturalLanguageQuery();
    }
  };

  const getBenchmarkStatus = (user: BenchmarkData) => {
    if (!settings) return "unknown";
    
    if (user.isConsistentlyLow) return "consistently-low";
    if (user.isConsistentlyHigh) return "consistently-high";
    if (user.averageWeeklyHours >= settings.min_hours_per_week && user.averageWeeklyHours <= settings.max_hours_per_week) return "within-range";
    if (user.averageWeeklyHours < settings.min_hours_per_week) return "below-min";
    if (user.averageWeeklyHours > settings.max_hours_per_week) return "above-max";
    return "unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "within-range": return "bg-green-100 text-green-800";
      case "below-min": return "bg-orange-100 text-orange-800";
      case "above-max": return "bg-blue-100 text-blue-800";
      case "consistently-low": return "bg-red-100 text-red-800";
      case "consistently-high": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "within-range": return <Target className="w-4 h-4" />;
      case "below-min": case "consistently-low": return <TrendingDown className="w-4 h-4" />;
      case "above-max": case "consistently-high": return <TrendingUp className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (!settings?.benchmarking_enabled) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto" />
            <h3 className="text-lg font-semibold">Benchmarking Reports Disabled</h3>
            <p className="text-muted-foreground">
              Benchmarking reports are not enabled for this organization. 
              Please contact your administrator to enable benchmarking in the General Settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benchmarking Report</h1>
          <p className="text-muted-foreground">
            Analyze user performance with natural language queries
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Label htmlFor="time-range" className="text-sm font-medium">Time Range:</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">4 Weeks</SelectItem>
              <SelectItem value="month">3 Months</SelectItem>
              <SelectItem value="custom">30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Query Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Natural Language Query</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query">Ask about user benchmarking patterns:</Label>
            <Textarea
              id="query"
              placeholder="Try: 'Show me users who are consistently below the min benchmark for a week' or 'Show me users who are always above the benchmark'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="min-h-[80px]"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <p>Example queries:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>"Show me users consistently below min benchmark"</li>
                <li>"Show me users with exact benchmark hours"</li>
                <li>"Show me high performing users"</li>
                <li>"Show me users from administration department"</li>
              </ul>
            </div>
            <Button 
              onClick={() => {
                console.log(`Analyze button clicked, processing query: "${query}"`);
                processNaturalLanguageQuery();
              }} 
              disabled={isProcessing || !query.trim()}
              className="ml-4"
            >
              {isProcessing ? "Processing..." : "Analyze"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query Results */}
      {queryResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Query Results</span>
              <Badge variant="outline">
                {queryResult.users.length} users found
              </Badge>
            </CardTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Query:</strong> "{query}"</p>
              <p><strong>Matched Pattern:</strong> {queryResult.matchedPattern}</p>
              <p><strong>Description:</strong> {queryResult.description}</p>
              <p><strong>Analysis Period:</strong> {queryResult.queryStartDate && queryResult.queryEndDate ? `${format(queryResult.queryStartDate, 'MMM dd, yyyy')} - ${format(queryResult.queryEndDate, 'MMM dd, yyyy')}` : `${format(analysisStartDate, 'MMM dd, yyyy')} - ${format(analysisEndDate, 'MMM dd, yyyy')}`} ({queryResult.timeToken ? queryResult.timeToken.replace('_', ' ') : (timeRange === "week" ? "4 weeks" : timeRange === "month" ? "3 months" : "30 days")})</p>
            </div>
          </CardHeader>
          <CardContent>
            {queryResult.users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No users match your query criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">User</th>
                      <th className="text-left p-3">Department</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Avg Daily Hours</th>
                      <th className="text-right p-3">Avg Weekly Hours</th>
                      <th className="text-right p-3">Tasks</th>
                      <th className="text-right p-3">Days Below Min</th>
                      <th className="text-right p-3">Days Above Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.users.map((user) => {
                      const status = getBenchmarkStatus(user);
                      return (
                        <tr key={user.userId} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{user.userName}</div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{user.department}</td>
                          <td className="p-3">
                            <Badge className={`${getStatusColor(status)} flex items-center space-x-1`}>
                              {getStatusIcon(status)}
                              <span className="capitalize">{status.replace('-', ' ')}</span>
                            </Badge>
                          </td>
                          <td className="p-3 text-right">{user.averageDailyHours.toFixed(1)}h</td>
                          <td className="p-3 text-right">{user.averageWeeklyHours.toFixed(1)}h</td>
                          <td className="p-3 text-right">{user.totalTasks}</td>
                          <td className="p-3 text-right">{user.daysBelowMin}</td>
                          <td className="p-3 text-right">{user.daysAboveMax}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benchmark Settings Summary */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Current Benchmarks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{settings.min_hours_per_day} - {settings.max_hours_per_day}h</div>
                <div className="text-sm text-muted-foreground">Daily Range</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{settings.min_hours_per_week} - {settings.max_hours_per_week}h</div>
                <div className="text-sm text-muted-foreground">Weekly Range</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{settings.min_hours_per_month} - {settings.max_hours_per_month}h</div>
                <div className="text-sm text-muted-foreground">Monthly Range</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BenchmarkingReport;