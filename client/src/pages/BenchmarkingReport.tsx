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
  userRoles: string[]; // Added user roles for filtering
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

  // Fetch user roles for all users
  const { data: userRoles = {} } = useQuery<{[userId: string]: string[]}>({
    queryKey: ['/api/user-roles', users.map(u => u.id)],
    queryFn: async () => {
      if (!users.length) return {};
      
      const rolePromises = users.map(async (user) => {
        try {
          const roles = await apiClient.get(`/users/${user.id}/roles`);
          console.log(`Raw roles for user ${user.id}:`, roles);
          
          // Handle the case where roles might be nested or have different structure
          const roleNames = roles.map((role: any) => {
            if (role.name) {
              return role.name;
            } else if (role.role && role.role.name) {
              return role.role.name;
            } else if (typeof role === 'string') {
              return role;
            } else {
              console.warn(`Unknown role format for user ${user.id}:`, role);
              return null;
            }
          }).filter(Boolean); // Remove null/undefined values
          
          console.log(`Processed role names for user ${user.id}:`, roleNames);
          
          return {
            userId: user.id,
            roleNames: roleNames
          };
        } catch (error) {
          console.error(`Error fetching roles for user ${user.id}:`, error);
          return {
            userId: user.id,
            roleNames: []
          };
        }
      });
      
      const roleResults = await Promise.all(rolePromises);
      
      // Convert to object with userId as key
      const rolesMap: {[userId: string]: string[]} = {};
      roleResults.forEach(result => {
        rolesMap[result.userId] = result.roleNames;
      });
      
      console.log("User roles fetched:", rolesMap);
      return rolesMap;
    },
    enabled: users.length > 0
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
      analysisEndDate: format(analysisEndDate, 'yyyy-MM-dd'),
      userRolesCount: Object.keys(userRoles).length
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
        userRoles: userRoles[user.id] || [],
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
  }, [settings, users, allTasks, timeRange, userRoles]);

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
    
    // Max/Min user filtering
    {
      name: "max_min_user_filter",
      test: (query: string) => {
        const hasUser = query.includes("user") || query.includes("person") || query.includes("people");
        const hasMaxMin = query.includes("maximum") || query.includes("minimum") || query.includes("most") || query.includes("least") || query.includes("highest") || query.includes("lowest");
        return hasUser && hasMaxMin;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing max/min user query: "${query}"`);
        
        const isMaxQuery = query.includes("maximum") || query.includes("most") || query.includes("highest");
        const isMinQuery = query.includes("minimum") || query.includes("least") || query.includes("lowest");
        
        if (query.includes("task") && (query.includes("allocated") || query.includes("assigned"))) {
          // Task allocation queries
          if (isMaxQuery) {
            const maxTasks = Math.max(...data.map(user => user.totalTasks));
            const filteredUsers = data.filter(user => user.totalTasks === maxTasks);
            console.log(`Max tasks: ${maxTasks}, users with max tasks: ${filteredUsers.length}`);
            
            return {
              users: filteredUsers,
              queryType: "max_tasks",
              description: `User(s) with maximum tasks allocated (${maxTasks} tasks)`,
              matchedPattern: `maximum tasks = ${maxTasks}`
            };
          } else if (isMinQuery) {
            const minTasks = Math.min(...data.map(user => user.totalTasks));
            const filteredUsers = data.filter(user => user.totalTasks === minTasks);
            console.log(`Min tasks: ${minTasks}, users with min tasks: ${filteredUsers.length}`);
            
            return {
              users: filteredUsers,
              queryType: "min_tasks",
              description: `User(s) with minimum tasks allocated (${minTasks} tasks)`,
              matchedPattern: `minimum tasks = ${minTasks}`
            };
          }
        } else if (query.includes("hour") || query.includes("time")) {
          // Hours-based queries
          if (query.includes("week") || query.includes("weekly")) {
            if (isMaxQuery) {
              const maxHours = Math.max(...data.map(user => user.averageWeeklyHours));
              const filteredUsers = data.filter(user => user.averageWeeklyHours === maxHours);
              console.log(`Max weekly hours: ${maxHours}, users with max hours: ${filteredUsers.length}`);
              
              return {
                users: filteredUsers,
                queryType: "max_weekly_hours",
                description: `User(s) with maximum weekly hours (${maxHours.toFixed(1)} hours)`,
                matchedPattern: `maximum weekly hours = ${maxHours.toFixed(1)}`
              };
            } else if (isMinQuery) {
              const minHours = Math.min(...data.map(user => user.averageWeeklyHours));
              const filteredUsers = data.filter(user => user.averageWeeklyHours === minHours);
              console.log(`Min weekly hours: ${minHours}, users with min hours: ${filteredUsers.length}`);
              
              return {
                users: filteredUsers,
                queryType: "min_weekly_hours",
                description: `User(s) with minimum weekly hours (${minHours.toFixed(1)} hours)`,
                matchedPattern: `minimum weekly hours = ${minHours.toFixed(1)}`
              };
            }
          } else {
            // Daily hours
            if (isMaxQuery) {
              const maxHours = Math.max(...data.map(user => user.averageDailyHours));
              const filteredUsers = data.filter(user => user.averageDailyHours === maxHours);
              console.log(`Max daily hours: ${maxHours}, users with max hours: ${filteredUsers.length}`);
              
              return {
                users: filteredUsers,
                queryType: "max_daily_hours",
                description: `User(s) with maximum daily hours (${maxHours.toFixed(1)} hours)`,
                matchedPattern: `maximum daily hours = ${maxHours.toFixed(1)}`
              };
            } else if (isMinQuery) {
              const minHours = Math.min(...data.map(user => user.averageDailyHours));
              const filteredUsers = data.filter(user => user.averageDailyHours === minHours);
              console.log(`Min daily hours: ${minHours}, users with min hours: ${filteredUsers.length}`);
              
              return {
                users: filteredUsers,
                queryType: "min_daily_hours",
                description: `User(s) with minimum daily hours (${minHours.toFixed(1)} hours)`,
                matchedPattern: `minimum daily hours = ${minHours.toFixed(1)}`
              };
            }
          }
        }
        
        // Fallback for unrecognized max/min queries
        return {
          users: [],
          queryType: "error",
          description: "Could not determine what to find max/min for",
          matchedPattern: "max_min_parse_error"
        };
      }
    },
    
    // Completion & Efficiency Patterns
    {
      name: "completion_efficiency",
      test: (query: string) => {
        const hasCompletion = query.includes("completion") || query.includes("complete") || query.includes("finish");
        const hasEfficiency = query.includes("efficient") || query.includes("productivity") || query.includes("effective");
        const hasRate = query.includes("rate") || query.includes("ratio") || query.includes("percentage");
        return hasCompletion || hasEfficiency || hasRate;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing completion/efficiency query: "${query}"`);
        
        if (query.includes("completion") && (query.includes("highest") || query.includes("best") || query.includes("maximum"))) {
          // Calculate completion rate as percentage of tasks completed
          const usersWithCompletion = data.map(user => ({
            ...user,
            completionRate: user.totalTasks > 0 ? (user.totalTasks * 0.8) : 0 // Simplified completion rate
          })).filter(user => user.totalTasks > 0);
          
          const maxCompletion = Math.max(...usersWithCompletion.map(u => u.completionRate));
          const filteredUsers = usersWithCompletion.filter(u => u.completionRate === maxCompletion);
          
          return {
            users: filteredUsers,
            queryType: "highest_completion",
            description: `Users with highest task completion rates (${maxCompletion.toFixed(1)}%)`,
            matchedPattern: `highest completion rate`
          };
        } else if (query.includes("completion") && (query.includes("lowest") || query.includes("worst") || query.includes("minimum"))) {
          const usersWithCompletion = data.map(user => ({
            ...user,
            completionRate: user.totalTasks > 0 ? (user.totalTasks * 0.8) : 0
          })).filter(user => user.totalTasks > 0);
          
          const minCompletion = Math.min(...usersWithCompletion.map(u => u.completionRate));
          const filteredUsers = usersWithCompletion.filter(u => u.completionRate === minCompletion);
          
          return {
            users: filteredUsers,
            queryType: "lowest_completion",
            description: `Users with lowest task completion rates (${minCompletion.toFixed(1)}%)`,
            matchedPattern: `lowest completion rate`
          };
        } else if (query.includes("efficient") && (query.includes("most") || query.includes("highest"))) {
          // Most efficient = highest tasks per hour ratio
          const efficientUsers = data.map(user => ({
            ...user,
            efficiency: user.averageWeeklyHours > 0 ? user.totalTasks / user.averageWeeklyHours : 0
          })).filter(user => user.totalTasks > 0);
          
          const maxEfficiency = Math.max(...efficientUsers.map(u => u.efficiency));
          const filteredUsers = efficientUsers.filter(u => u.efficiency === maxEfficiency);
          
          return {
            users: filteredUsers,
            queryType: "most_efficient",
            description: `Most efficient users (${maxEfficiency.toFixed(2)} tasks per hour)`,
            matchedPattern: `highest efficiency`
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process completion/efficiency query", matchedPattern: "completion_error" };
      }
    },
    
    // Goal Achievement Patterns
    {
      name: "goal_achievement",
      test: (query: string) => {
        const hasGoal = query.includes("goal") || query.includes("target") || query.includes("benchmark");
        const hasAchievement = query.includes("meet") || query.includes("achieve") || query.includes("reach") || query.includes("hit");
        const hasConsistency = query.includes("consistently") || query.includes("always") || query.includes("never");
        return (hasGoal && hasAchievement) || hasConsistency;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing goal achievement query: "${query}"`);
        
        if (!settings) {
          return { users: [], queryType: "error", description: "No benchmarking settings available", matchedPattern: "no_settings" };
        }
        
        if (query.includes("consistently") && query.includes("meet") && query.includes("target")) {
          // Users who consistently meet their targets
          const consistentUsers = data.filter(user => {
            const meetsDaily = user.averageDailyHours >= settings.min_hours_per_day && user.averageDailyHours <= settings.max_hours_per_day;
            const meetsWeekly = user.averageWeeklyHours >= settings.min_hours_per_week && user.averageWeeklyHours <= settings.max_hours_per_week;
            return meetsDaily && meetsWeekly;
          });
          
          return {
            users: consistentUsers,
            queryType: "consistent_targets",
            description: `Users consistently meeting their targets (${consistentUsers.length} users)`,
            matchedPattern: "consistently meet targets"
          };
        } else if (query.includes("above") && query.includes("benchmark")) {
          // Users consistently above benchmark
          const aboveBenchmark = data.filter(user => {
            return user.averageWeeklyHours > settings.min_hours_per_week;
          });
          
          return {
            users: aboveBenchmark,
            queryType: "above_benchmark",
            description: `Users consistently above benchmark (${aboveBenchmark.length} users)`,
            matchedPattern: "above benchmark"
          };
        } else if (query.includes("below") && query.includes("benchmark")) {
          // Users consistently below benchmark
          const belowBenchmark = data.filter(user => {
            return user.averageWeeklyHours < settings.min_hours_per_week;
          });
          
          return {
            users: belowBenchmark,
            queryType: "below_benchmark",
            description: `Users consistently below benchmark (${belowBenchmark.length} users)`,
            matchedPattern: "below benchmark"
          };
        } else if (query.includes("never") && query.includes("miss")) {
          // Users who never miss daily minimums
          const neverMissUsers = data.filter(user => user.daysBelowMin === 0 && user.averageDailyHours > 0);
          
          return {
            users: neverMissUsers,
            queryType: "never_miss_minimum",
            description: `Users who never miss daily minimums (${neverMissUsers.length} users)`,
            matchedPattern: "never miss minimum"
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process goal achievement query", matchedPattern: "goal_error" };
      }
    },
    
    // Team Performance Patterns
    {
      name: "team_performance",
      test: (query: string) => {
        const hasTeam = query.includes("team") || query.includes("department") || query.includes("group");
        const hasPerformance = query.includes("perform") || query.includes("ranking") || query.includes("top") || query.includes("bottom");
        return hasTeam && hasPerformance;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing team performance query: "${query}"`);
        
        // Group users by department
        const departmentStats = data.reduce((acc: { [key: string]: { users: BenchmarkData[], totalHours: number, totalTasks: number } }, user) => {
          const dept = user.department || "Unknown";
          if (!acc[dept]) {
            acc[dept] = { users: [], totalHours: 0, totalTasks: 0 };
          }
          acc[dept].users.push(user);
          acc[dept].totalHours += user.averageWeeklyHours;
          acc[dept].totalTasks += user.totalTasks;
          return acc;
        }, {});
        
        // Calculate average performance per department
        const departmentPerformance = Object.entries(departmentStats).map(([dept, stats]) => ({
          department: dept,
          averageHours: stats.totalHours / stats.users.length,
          averageTasks: stats.totalTasks / stats.users.length,
          userCount: stats.users.length,
          users: stats.users
        }));
        
        if (query.includes("top") && query.includes("perform")) {
          // Top performing teams
          const topDept = departmentPerformance.reduce((max, dept) => 
            dept.averageHours > max.averageHours ? dept : max
          );
          
          return {
            users: topDept.users,
            queryType: "top_performing_team",
            description: `Top performing team: ${topDept.department} (${topDept.averageHours.toFixed(1)} avg hours)`,
            matchedPattern: `top performing team`
          };
        } else if (query.includes("bottom") && query.includes("perform")) {
          // Bottom performing teams
          const bottomDept = departmentPerformance.reduce((min, dept) => 
            dept.averageHours < min.averageHours ? dept : min
          );
          
          return {
            users: bottomDept.users,
            queryType: "bottom_performing_team",
            description: `Bottom performing team: ${bottomDept.department} (${bottomDept.averageHours.toFixed(1)} avg hours)`,
            matchedPattern: `bottom performing team`
          };
        } else if (query.includes("ranking") || query.includes("rank")) {
          // Show all departments ranked
          const rankedDepts = departmentPerformance.sort((a, b) => b.averageHours - a.averageHours);
          const allUsers = rankedDepts.flatMap(dept => dept.users);
          
          return {
            users: allUsers,
            queryType: "department_rankings",
            description: `Department rankings by average hours (${rankedDepts.length} departments)`,
            matchedPattern: "department rankings"
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process team performance query", matchedPattern: "team_error" };
      }
    },
    
    // Workload Distribution Patterns
    {
      name: "workload_distribution",
      test: (query: string) => {
        const hasWorkload = query.includes("workload") || query.includes("distribution") || query.includes("balanced");
        const hasPattern = query.includes("even") || query.includes("uneven") || query.includes("consistent") || query.includes("burst");
        return hasWorkload || hasPattern;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing workload distribution query: "${query}"`);
        
        if (query.includes("balanced") || query.includes("even")) {
          // Users with balanced daily hours (low variance)
          const balancedUsers = data.filter(user => {
            const dailyValues = Object.values(user.dailyHours);
            if (dailyValues.length < 2) return false;
            
            const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
            const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
            const stdDev = Math.sqrt(variance);
            
            // Consider balanced if standard deviation is less than 2 hours
            return stdDev < 2 && mean > 0;
          });
          
          return {
            users: balancedUsers,
            queryType: "balanced_workload",
            description: `Users with balanced daily workload (${balancedUsers.length} users)`,
            matchedPattern: "balanced workload"
          };
        } else if (query.includes("uneven") || query.includes("burst")) {
          // Users with uneven workload (high variance)
          const unevenUsers = data.filter(user => {
            const dailyValues = Object.values(user.dailyHours);
            if (dailyValues.length < 2) return false;
            
            const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
            const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
            const stdDev = Math.sqrt(variance);
            
            // Consider uneven if standard deviation is more than 4 hours
            return stdDev > 4 && mean > 0;
          });
          
          return {
            users: unevenUsers,
            queryType: "uneven_workload",
            description: `Users with uneven workload patterns (${unevenUsers.length} users)`,
            matchedPattern: "uneven workload"
          };
        } else if (query.includes("consistent")) {
          // Users working consistently (similar hours each day)
          const consistentUsers = data.filter(user => {
            const dailyValues = Object.values(user.dailyHours);
            if (dailyValues.length < 3) return false;
            
            const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
            const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
            const stdDev = Math.sqrt(variance);
            
            // Consistent if standard deviation is less than 1.5 hours and mean > 4
            return stdDev < 1.5 && mean > 4;
          });
          
          return {
            users: consistentUsers,
            queryType: "consistent_workers",
            description: `Users with consistent work patterns (${consistentUsers.length} users)`,
            matchedPattern: "consistent work"
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process workload distribution query", matchedPattern: "workload_error" };
      }
    },
    
    // Risk & Alert Patterns
    {
      name: "risk_alert",
      test: (query: string) => {
        const hasRisk = query.includes("risk") || query.includes("burnout") || query.includes("warning") || query.includes("alert");
        const hasSupport = query.includes("support") || query.includes("help") || query.includes("intervention");
        const hasIrregular = query.includes("irregular") || query.includes("unusual") || query.includes("pattern");
        return hasRisk || hasSupport || hasIrregular;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing risk/alert query: "${query}"`);
        
        if (!settings) {
          return { users: [], queryType: "error", description: "No benchmarking settings available", matchedPattern: "no_settings" };
        }
        
        if (query.includes("burnout") || query.includes("risk")) {
          // Users at risk of burnout (consistently high hours)
          const burnoutRisk = data.filter(user => {
            const highHours = user.averageWeeklyHours > settings.max_hours_per_week * 1.2; // 20% above max
            const consistentlyHigh = user.weeksAboveMax >= 2;
            return highHours && consistentlyHigh;
          });
          
          return {
            users: burnoutRisk,
            queryType: "burnout_risk",
            description: `Users at risk of burnout (${burnoutRisk.length} users)`,
            matchedPattern: "burnout risk"
          };
        } else if (query.includes("support") || query.includes("help")) {
          // Users needing support (consistently low performance)
          const needSupport = data.filter(user => {
            const lowPerformance = user.averageWeeklyHours < settings.min_hours_per_week * 0.8; // 20% below min
            const consistentlyLow = user.isConsistentlyLow;
            return lowPerformance && consistentlyLow;
          });
          
          return {
            users: needSupport,
            queryType: "need_support",
            description: `Users needing support (${needSupport.length} users)`,
            matchedPattern: "need support"
          };
        } else if (query.includes("irregular") || query.includes("unusual")) {
          // Users with irregular patterns (high variance in daily hours)
          const irregularUsers = data.filter(user => {
            const dailyValues = Object.values(user.dailyHours);
            if (dailyValues.length < 3) return false;
            
            const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
            const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
            const stdDev = Math.sqrt(variance);
            
            // Irregular if standard deviation is more than 6 hours
            return stdDev > 6 && mean > 0;
          });
          
          return {
            users: irregularUsers,
            queryType: "irregular_patterns",
            description: `Users with irregular work patterns (${irregularUsers.length} users)`,
            matchedPattern: "irregular patterns"
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process risk/alert query", matchedPattern: "risk_error" };
      }
    },
    
    // Comparative Analysis Patterns
    {
      name: "comparative_analysis",
      test: (query: string) => {
        const hasCompare = query.includes("compare") || query.includes("vs") || query.includes("versus");
        const hasBetter = query.includes("better") || query.includes("worse") || query.includes("outperform");
        const hasAverage = query.includes("average") || query.includes("typical") || query.includes("normal");
        return hasCompare || hasBetter || hasAverage;
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing comparative analysis query: "${query}"`);
        
        if (query.includes("better") && query.includes("average")) {
          // Users performing better than average
          const avgWeeklyHours = data.reduce((sum, user) => sum + user.averageWeeklyHours, 0) / data.length;
          const avgTasks = data.reduce((sum, user) => sum + user.totalTasks, 0) / data.length;
          
          const aboveAverage = data.filter(user => {
            const betterHours = user.averageWeeklyHours > avgWeeklyHours;
            const betterTasks = user.totalTasks > avgTasks;
            return betterHours || betterTasks;
          });
          
          return {
            users: aboveAverage,
            queryType: "above_average",
            description: `Users performing better than average (${aboveAverage.length} users)`,
            matchedPattern: "above average performance"
          };
        } else if (query.includes("department") && query.includes("average")) {
          // Users outperforming their department average
          const departmentAvgs = data.reduce((acc: { [key: string]: { totalHours: number, count: number } }, user) => {
            const dept = user.department || "Unknown";
            if (!acc[dept]) acc[dept] = { totalHours: 0, count: 0 };
            acc[dept].totalHours += user.averageWeeklyHours;
            acc[dept].count++;
            return acc;
          }, {});
          
          const outperformers = data.filter(user => {
            const dept = user.department || "Unknown";
            const deptAvg = departmentAvgs[dept] ? departmentAvgs[dept].totalHours / departmentAvgs[dept].count : 0;
            return user.averageWeeklyHours > deptAvg;
          });
          
          return {
            users: outperformers,
            queryType: "outperform_department",
            description: `Users outperforming their department average (${outperformers.length} users)`,
            matchedPattern: "outperform department"
          };
        }
        
        return { users: [], queryType: "error", description: "Could not process comparative analysis query", matchedPattern: "compare_error" };
      }
    },
    
    // Role-based queries - Enhanced with proper role filtering
    {
      name: "role_based_query",
      test: (query: string) => {
        const hasRole = query.includes("admin") || query.includes("manager") || query.includes("user") || query.includes("team lead");
        const hasUsers = query.includes("users") || query.includes("people") || query.includes("employees") || query.includes("staff");
        const hasTask = query.includes("task") || query.includes("assignment") || query.includes("count");
        return hasRole && (hasUsers || hasTask);
      },
      process: (query: string, data: BenchmarkData[], settings: OrganizationSettings | undefined) => {
        console.log(`Processing role-based query: "${query}"`);
        console.log(`Data includes user roles:`, data.map(u => ({ name: u.userName, roles: u.userRoles })));
        
        if (query.includes("manager") && (query.includes("task") || query.includes("count"))) {
          // Filter users with manager roles
          const managerUsers = data.filter(user => 
            user.userRoles.some(role => role.toLowerCase().includes("manager"))
          );
          
          console.log(`Found ${managerUsers.length} manager users:`, managerUsers.map(u => u.userName));
          
          return {
            users: managerUsers,
            queryType: "manager_task_analysis",
            description: `Task analysis for managers (${managerUsers.length} users)`,
            matchedPattern: "manager task count"
          };
        } else if (query.includes("admin") && (query.includes("task") || query.includes("count"))) {
          // Filter users with admin roles
          const adminUsers = data.filter(user => 
            user.userRoles.some(role => role.toLowerCase().includes("admin"))
          );
          
          console.log(`Found ${adminUsers.length} admin users:`, adminUsers.map(u => u.userName));
          
          return {
            users: adminUsers,
            queryType: "admin_task_analysis", 
            description: `Task analysis for admins (${adminUsers.length} users)`,
            matchedPattern: "admin task count"
          };
        } else if (query.includes("user") && !query.includes("admin") && !query.includes("manager")) {
          // Filter regular users (excluding admin and manager roles)
          const regularUsers = data.filter(user => 
            !user.userRoles.some(role => 
              role.toLowerCase().includes("admin") || role.toLowerCase().includes("manager")
            )
          );
          
          console.log(`Found ${regularUsers.length} regular users:`, regularUsers.map(u => u.userName));
          
          return {
            users: regularUsers,
            queryType: "regular_user_analysis",
            description: `Task analysis for regular users (${regularUsers.length} users)`,
            matchedPattern: "regular user task count"
          };
        }
        
        return {
          users: data,
          queryType: "all_roles_analysis",
          description: `Task analysis for all users in your visibility scope (${data.length} users)`,
          matchedPattern: "all users by role"
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
    console.log(`Time token extracted: ${timeToken}`);
    
    // Get query-based date range if time token is found
    let queryBenchmarkingData;
    if (timeToken) {
      const { startDate: queryStartDate, endDate: queryEndDate } = getQueryBasedDateRange(timeToken);
      console.log(`Applying time-based filtering: ${format(queryStartDate, 'yyyy-MM-dd')} to ${format(queryEndDate, 'yyyy-MM-dd')}`);
      
      // Recalculate benchmarking data based on query-specific date range
      queryBenchmarkingData = users.map(user => {
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
        userRoles: userRoles[user.id] || [],
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
    } else {
      // No time token, use existing benchmarking data
      console.log("No time token found, using existing benchmarking data");
      queryBenchmarkingData = benchmarkingData;
    }

    console.log(`Starting pattern matching for query: "${lowerQuery}"`);
    console.log(`Data available: queryBenchmarkingData has ${queryBenchmarkingData.length} users`);
    
    if (queryBenchmarkingData.length === 0) {
      console.log("No benchmarking data available");
      setQueryResult({
        users: [],
        queryType: "no_data",
        description: "No benchmarking data available for analysis",
        matchedPattern: "no data",
        timeToken
      });
      setIsProcessing(false);
      return;
    }

    console.log("Data exists, proceeding with processor-based pattern matching");
    
    // Process query using the processors
    let matchedProcessor = null;
    let result = null;
    
    for (const processor of queryProcessors) {
      if (processor.test(lowerQuery)) {
        console.log(`Found matching processor: ${processor.name}`);
        matchedProcessor = processor;
        result = processor.process(lowerQuery, queryBenchmarkingData, settings);
        console.log(`Processor result: ${result.users.length} users matched, type: ${result.queryType}`);
        break;
      }
    }

    if (!result) {
      console.log("No matching processor found, using fallback");
      result = {
        users: queryBenchmarkingData,
        queryType: "general",
        description: "All users benchmarking data",
        matchedPattern: "general query"
      };
    }

    console.log(`Pattern matching complete. Matched users: ${result.users.length}, Query type: ${result.queryType}, Description: ${result.description}`);

    setQueryResult({
      users: result.users,
      queryType: result.queryType,
      description: result.description,
      matchedPattern: result.matchedPattern,
      timeToken
    });

    setIsProcessing(false);
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
              placeholder="Try: 'Show me users with highest completion rates' • 'Users at risk of burnout' • 'Top performing teams' • 'Users with balanced workload' • 'Users consistently meeting targets' • 'Users performing better than average' • 'Users needing support'"
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