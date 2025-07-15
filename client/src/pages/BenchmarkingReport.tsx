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
import { format, subDays, subWeeks, subMonths, parseISO, startOfDay, endOfDay } from "date-fns";

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

  // Calculate benchmarking data for all users
  const benchmarkingData = useMemo(() => {
    if (!settings || !users.length || !allTasks.length) return [];

    const endDate = new Date();
    const startDate = timeRange === "week" ? subWeeks(endDate, 4) : 
                     timeRange === "month" ? subMonths(endDate, 3) : subDays(endDate, 30);

    return users.map(user => {
      const userTasks = allTasks.filter(task => task.assigned_to === user.id);
      const relevantTasks = userTasks.filter(task => {
        const taskDate = parseISO(task.updated_at || task.created_at);
        return taskDate >= startDate && taskDate <= endDate;
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
          const taskDate = parseISO(task.updated_at || task.created_at);
          const dateKey = format(taskDate, 'yyyy-MM-dd');
          const weekKey = format(startOfDay(taskDate), 'yyyy-MM-dd');
          const monthKey = format(new Date(taskDate.getFullYear(), taskDate.getMonth(), 1), 'yyyy-MM-dd');

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

      const daysAboveMax = dailyValues.filter(h => h > settings.max_hours_per_day).length;
      const daysBelowMin = dailyValues.filter(h => h > 0 && h < settings.min_hours_per_day).length;
      const weeksAboveMax = weeklyValues.filter(h => h > settings.max_hours_per_week).length;
      const weeksBelowMin = weeklyValues.filter(h => h > 0 && h < settings.min_hours_per_week).length;

      const isConsistentlyLow = weeklyValues.length >= 2 && weeklyValues.every(h => h < settings.min_hours_per_week);
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

  // NLP Query Processing
  const processNaturalLanguageQuery = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    const lowerQuery = query.toLowerCase();

    let matchedUsers: BenchmarkData[] = [];
    let queryType = "unknown";
    let description = "";
    let matchedPattern = "";

    try {
      // Pattern matching for different query types
      if (lowerQuery.includes("consistently below") && lowerQuery.includes("min")) {
        matchedUsers = benchmarkingData.filter(user => user.isConsistentlyLow);
        queryType = "consistently_below_min";
        description = "Users who are consistently below minimum benchmark";
        matchedPattern = "consistently below min benchmark";
      }
      else if (lowerQuery.includes("consistently above") || lowerQuery.includes("always above")) {
        matchedUsers = benchmarkingData.filter(user => user.isConsistentlyHigh);
        queryType = "consistently_above_max";
        description = "Users who are consistently above maximum benchmark";
        matchedPattern = "consistently/always above benchmark";
      }
      else if (lowerQuery.includes("exact") && (lowerQuery.includes("hours") || lowerQuery.includes("benchmark"))) {
        matchedUsers = benchmarkingData.filter(user => user.isExactHours);
        queryType = "exact_hours";
        description = "Users showing exact benchmark hours";
        matchedPattern = "exact hours/benchmark";
      }
      else if (lowerQuery.includes("below") && lowerQuery.includes("min")) {
        matchedUsers = benchmarkingData.filter(user => user.weeksBelowMin > 0);
        queryType = "below_min";
        description = "Users with weeks below minimum benchmark";
        matchedPattern = "below min";
      }
      else if (lowerQuery.includes("above") && lowerQuery.includes("max")) {
        matchedUsers = benchmarkingData.filter(user => user.weeksAboveMax > 0);
        queryType = "above_max";
        description = "Users with weeks above maximum benchmark";
        matchedPattern = "above max";
      }
      else if (lowerQuery.includes("low perform") || lowerQuery.includes("underperform")) {
        matchedUsers = benchmarkingData.filter(user => 
          user.averageWeeklyHours < settings?.min_hours_per_week || user.daysBelowMin > user.daysAboveMax
        );
        queryType = "low_performance";
        description = "Low performing users";
        matchedPattern = "low perform/underperform";
      }
      else if (lowerQuery.includes("high perform") || lowerQuery.includes("overperform")) {
        matchedUsers = benchmarkingData.filter(user => 
          user.averageWeeklyHours > settings?.max_hours_per_week || user.daysAboveMax > user.daysBelowMin
        );
        queryType = "high_performance";
        description = "High performing users";
        matchedPattern = "high perform/overperform";
      }
      else if (lowerQuery.includes("department") || lowerQuery.includes("team")) {
        const dept = lowerQuery.match(/department\s+(\w+)|team\s+(\w+)/)?.[1] || lowerQuery.match(/department\s+(\w+)|team\s+(\w+)/)?.[2];
        if (dept) {
          matchedUsers = benchmarkingData.filter(user => 
            user.department.toLowerCase().includes(dept.toLowerCase())
          );
          queryType = "department_filter";
          description = `Users from ${dept} department/team`;
          matchedPattern = `department/team: ${dept}`;
        }
      }
      else {
        // Default to showing all users with some analysis
        matchedUsers = benchmarkingData;
        queryType = "general";
        description = "All users benchmarking data";
        matchedPattern = "general query";
      }

      setQueryResult({
        users: matchedUsers,
        queryType,
        description,
        matchedPattern
      });

    } catch (error) {
      console.error("Query processing error:", error);
      setQueryResult({
        users: [],
        queryType: "error",
        description: "Error processing query",
        matchedPattern: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
              onClick={processNaturalLanguageQuery} 
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