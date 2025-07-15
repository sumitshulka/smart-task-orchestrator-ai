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

  // Pattern-based Query Processors
  interface QueryProcessor {
    name: string;
    test: (query: string) => boolean;
    process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
      users: BenchmarkData[];
      queryType: string;
      description: string;
      matchedPattern: string;
    };
  }

  const queryProcessors: QueryProcessor[] = [
    // Percentage-based performance analysis - ABOVE target
    {
      name: "surpass_exceed_percentage",
      test: (query: string) => {
        const hasAction = query.includes("surpass") || query.includes("exceed") || query.includes("over");
        const hasPercentage = query.includes("%");
        const hasTime = query.includes("hour") || query.includes("week") || query.includes("day");
        return hasAction && hasPercentage && hasTime;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing surpass/exceed percentage query: "${query}"`);
        
        const percentMatch = query.match(/(?:more than|over|above)\s+(\d+)%/) || query.match(/by\s+more\s+than\s+(\d+)%/);
        if (!percentMatch) {
          return { users: [], queryType: "error", description: "Could not parse percentage", matchedPattern: "percentage_parse_error" };
        }
        
        const percentThreshold = parseInt(percentMatch[1]);
        console.log(`Extracted percentage threshold: ${percentThreshold}%`);
        
        if (query.includes("week") || query.includes("weekly")) {
          const targetHours = settings?.min_hours_per_week || 35;
          console.log(`Using weekly target: ${targetHours} hours`);
          
          const filteredUsers = data.filter(user => {
            const actualHours = user.averageWeeklyHours;
            const exceedPercentage = ((actualHours - targetHours) / targetHours) * 100;
            const matches = exceedPercentage > percentThreshold;
            console.log(`User ${user.userName}: ${actualHours}h vs ${targetHours}h target = ${exceedPercentage.toFixed(1)}% (${matches ? 'MATCH' : 'no match'})`);
            return matches;
          });
          
          return {
            users: filteredUsers,
            queryType: "weekly_hours_exceed_percent",
            description: `Users who exceeded weekly hour targets by more than ${percentThreshold}%`,
            matchedPattern: `weekly hours exceed > ${percentThreshold}%`
          };
        } else if (query.includes("day") || query.includes("daily")) {
          const targetHours = settings?.min_hours_per_day || 8;
          const filteredUsers = data.filter(user => {
            const actualHours = user.averageDailyHours;
            const exceedPercentage = ((actualHours - targetHours) / targetHours) * 100;
            return exceedPercentage > percentThreshold;
          });
          
          return {
            users: filteredUsers,
            queryType: "daily_hours_exceed_percent",
            description: `Users who exceeded daily hour targets by more than ${percentThreshold}%`,
            matchedPattern: `daily hours exceed > ${percentThreshold}%`
          };
        }
        
        return { users: [], queryType: "error", description: "Could not determine time period", matchedPattern: "time_period_error" };
      }
    },
    
    // Percentage-based performance analysis - BELOW target
    {
      name: "short_below_percentage",
      test: (query: string) => {
        const hasAction = query.includes("short") || query.includes("below") || query.includes("under") || query.includes("less");
        const hasPercentage = query.includes("%");
        const hasTime = query.includes("hour") || query.includes("week") || query.includes("day");
        return hasAction && hasPercentage && hasTime;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing short/below percentage query: "${query}"`);
        
        const percentMatch = query.match(/(?:more than|over|above)\s+(\d+)%/) || query.match(/by\s+more\s+than\s+(\d+)%/);
        if (!percentMatch) {
          return { users: [], queryType: "error", description: "Could not parse percentage", matchedPattern: "percentage_parse_error" };
        }
        
        const percentThreshold = parseInt(percentMatch[1]);
        console.log(`Extracted percentage threshold: ${percentThreshold}%`);
        
        if (query.includes("week") || query.includes("weekly")) {
          const targetHours = settings?.min_hours_per_week || 35;
          console.log(`Using weekly target: ${targetHours} hours`);
          
          const filteredUsers = data.filter(user => {
            const actualHours = user.averageWeeklyHours;
            const shortfallPercentage = ((targetHours - actualHours) / targetHours) * 100;
            const matches = shortfallPercentage > percentThreshold;
            console.log(`User ${user.userName}: ${actualHours}h vs ${targetHours}h target = ${shortfallPercentage.toFixed(1)}% short (${matches ? 'MATCH' : 'no match'})`);
            return matches;
          });
          
          return {
            users: filteredUsers,
            queryType: "weekly_hours_short_percent",
            description: `Users who are short of weekly hour targets by more than ${percentThreshold}%`,
            matchedPattern: `weekly hours short > ${percentThreshold}%`
          };
        } else if (query.includes("day") || query.includes("daily")) {
          const targetHours = settings?.min_hours_per_day || 8;
          const filteredUsers = data.filter(user => {
            const actualHours = user.averageDailyHours;
            const shortfallPercentage = ((targetHours - actualHours) / targetHours) * 100;
            return shortfallPercentage > percentThreshold;
          });
          
          return {
            users: filteredUsers,
            queryType: "daily_hours_short_percent",
            description: `Users who are short of daily hour targets by more than ${percentThreshold}%`,
            matchedPattern: `daily hours short > ${percentThreshold}%`
          };
        }
        
        return { users: [], queryType: "error", description: "Could not determine time period", matchedPattern: "time_period_error" };
      }
    },
    
    // Hours-based filtering
    {
      name: "hours_above_threshold",
      test: (query: string) => {
        return query.includes("hour") && (query.includes("more than") || query.includes("over") || query.includes("above")) && !query.includes("%");
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        const hoursMatch = query.match(/(?:more than|over|above)\s+(\d+)\s+hour/);
        if (!hoursMatch) return { users: [], queryType: "error", description: "Could not parse hours", matchedPattern: "hours_parse_error" };
        
        const threshold = parseInt(hoursMatch[1]);
        let filteredUsers: BenchmarkData[];
        
        if (query.includes("week")) {
          filteredUsers = data.filter(user => user.averageWeeklyHours > threshold);
          return {
            users: filteredUsers,
            queryType: "hours_above",
            description: `Users with more than ${threshold} hours per week`,
            matchedPattern: `weekly hours > ${threshold}`
          };
        } else {
          filteredUsers = data.filter(user => user.averageDailyHours > threshold);
          return {
            users: filteredUsers,
            queryType: "hours_above",
            description: `Users with more than ${threshold} hours per day`,
            matchedPattern: `daily hours > ${threshold}`
          };
        }
      }
    },
    
    // Department/Team filtering
    {
      name: "department_filter",
      test: (query: string) => query.includes("department") || query.includes("team"),
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        let dept = null;
        const patterns = [
          /(?:department|team)\s+(\w+)/,
          /(?:from|in)\s+(\w+)\s+(?:department|team)/,
          /(\w+)\s+(?:department|team)/
        ];
        
        for (const pattern of patterns) {
          const match = query.match(pattern);
          if (match) {
            dept = match[1];
            break;
          }
        }
        
        if (!dept) return { users: [], queryType: "error", description: "Could not extract department", matchedPattern: "dept_parse_error" };
        
        const filteredUsers = data.filter(user => 
          user.department.toLowerCase().includes(dept.toLowerCase())
        );
        
        return {
          users: filteredUsers,
          queryType: "department_filter",
          description: `Users from ${dept} department/team`,
          matchedPattern: `department/team: ${dept}`
        };
      }
    },
    
    // Default fallback
    {
      name: "general_fallback",
      test: (query: string) => true, // Always matches as fallback
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        return {
          users: data,
          queryType: "general",
          description: "All users benchmarking data",
          matchedPattern: "general query"
        };
      }
    }
  ];

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
      
      if (!queryBenchmarkingData || queryBenchmarkingData.length === 0) {
        console.log(`No data available for analysis, using fallback`);
        matchedUsers = [];
        queryType = "no_data";
        description = "No benchmarking data available";
        matchedPattern = "no data";
      } else {
        console.log(`Data exists, proceeding with processor-based pattern matching`);
        
        // Find the first matching processor
        const processor = queryProcessors.find(p => p.test(lowerQuery));
        console.log(`Found matching processor: ${processor?.name || 'none'}`);
        
        if (processor) {
          const result = processor.process(lowerQuery, queryBenchmarkingData, settings);
          matchedUsers = result.users;
          queryType = result.queryType;
          description = result.description;
          matchedPattern = result.matchedPattern;
          console.log(`Processor result: ${matchedUsers.length} users matched, type: ${queryType}`);
        }
      }
      
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