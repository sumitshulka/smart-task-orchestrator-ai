import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";
import { apiClient } from "@/lib/api";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

export default function TaskOverdueReport() {
  const [dateRange, setDateRange] = React.useState(defaultDateRange());
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [alphabetFilter, setAlphabetFilter] = React.useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = React.useState<any[]>([]);
  const [preset, setPreset] = React.useState<string>("This Month");
  const [cfFilters, setCfFilters] = React.useState<Record<string, string>>({});
  // When showAll is true the date-range filter is ignored and every currently
  // overdue task is returned (the canonical "All Overdue" view).
  const [showAll, setShowAll] = React.useState(true);

  const { users } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();

  const isAdmin = roles.includes("admin");

  // Fetch reportable CF fields for task module
  const { data: cfFieldsRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-fields/definitions", "task", "reportable"],
    queryFn: async () => {
      const res = await apiClient.get("/custom-fields/definitions?module=task");
      return Array.isArray(res) ? res : res?.definitions ?? [];
    },
  });
  const reportableCfFields = React.useMemo(
    () => cfFieldsRaw.filter((f: any) => f.is_reportable && f.field_type !== "user_reference"),
    [cfFieldsRaw],
  );

  // Build active CF filters
  const activeCfFilters = React.useMemo(() =>
    Object.entries(cfFilters)
      .filter(([, v]) => v.trim() !== "")
      .map(([field_id, value]) => ({ field_id, value: value.trim() })),
    [cfFilters],
  );

  const { data: cfMatchData } = useQuery<{ taskIds: string[] }>({
    queryKey: ["/api/custom-fields/task-ids-filter", activeCfFilters],
    queryFn: () => {
      if (activeCfFilters.length === 0) return Promise.resolve({ taskIds: [] });
      return apiClient.post("/custom-fields/task-ids-filter", { filters: activeCfFilters });
    },
    enabled: activeCfFilters.length > 0,
  });

  const cfMatchSet = React.useMemo(() => {
    if (activeCfFilters.length === 0) return null;
    return new Set(cfMatchData?.taskIds ?? []);
  }, [activeCfFilters, cfMatchData]);

  const { data: tasks, isLoading } = useQuery({
    queryKey: [
      "overdue-tasks",
      showAll ? "all" : format(dateRange.from, "yyyy-MM-dd"),
      showAll ? "all" : format(dateRange.to, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const fetchInput: import("@/integrations/supabase/tasks").FetchTasksInput = {
        limit: 1000,
        // Always include overdue tasks even when a date range is active
        includeOverdue: true,
      };
      // Only apply the creation-date range when the user hasn't requested "Show All"
      if (!showAll) {
        fetchInput.fromDate = format(dateRange.from, "yyyy-MM-dd");
        fetchInput.toDate = format(dateRange.to, "yyyy-MM-dd");
      }
      const { tasks } = await fetchTasksPaginated(fetchInput);

      // Filter for overdue tasks (due date must be before today, not including today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tasks.filter(task =>
        task.due_date &&
        new Date(task.due_date) < today &&
        task.status.toLowerCase() !== "completed"
      );
    }
  });

  const overdueReport = React.useMemo(() => {
    if (!tasks) return [];
    
    let filteredTasks = tasks;

    // Custom field filter
    if (cfMatchSet !== null) {
      filteredTasks = filteredTasks.filter(task => cfMatchSet.has(task.id));
    }
    
    // Apply admin filters
    if (isAdmin) {
      // Department filter
      if (departmentFilter !== "all") {
        filteredTasks = filteredTasks.filter(task => {
          const userInfo = users.find(u => u.id === task.assigned_to);
          return userInfo?.department === departmentFilter;
        });
      }
      
      // Alphabet filter
      if (alphabetFilter !== "all") {
        filteredTasks = filteredTasks.filter(task => {
          const userInfo = users.find(u => u.id === task.assigned_to);
          const name = userInfo?.user_name || userInfo?.email || "";
          return name.toLowerCase().startsWith(alphabetFilter.toLowerCase());
        });
      }
      
      // Selected employees filter
      if (selectedEmployees.length > 0) {
        const selectedIds = selectedEmployees.map(emp => emp.id);
        filteredTasks = filteredTasks.filter(task => 
          selectedIds.includes(task.assigned_to)
        );
      }
    }
    
    const userMap: Record<string, any> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today for consistent comparison
    
    filteredTasks.forEach(task => {
      const assignedId = task.assigned_to || "unassigned";
      const userInfo = users.find(u => u.id === task.assigned_to);
      const name = userInfo?.user_name || userInfo?.email || "Unassigned";
      const email = userInfo?.email || "N/A";
      
      if (!userMap[assignedId]) {
        userMap[assignedId] = {
          employeeName: name,
          employeeEmail: email,
          "0-15": 0,
          "15-30": 0,
          "30-45": 0,
          "45-60": 0,
          ">60": 0,
          totalOverdue: 0
        };
      }
      
      const dueDate = new Date(task.due_date!);
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 15) {
        userMap[assignedId]["0-15"]++;
      } else if (daysDiff <= 30) {
        userMap[assignedId]["15-30"]++;
      } else if (daysDiff <= 45) {
        userMap[assignedId]["30-45"]++;
      } else if (daysDiff <= 60) {
        userMap[assignedId]["45-60"]++;
      } else {
        userMap[assignedId][">60"]++;
      }
      
      userMap[assignedId].totalOverdue++;
    });
    
    return Object.values(userMap);
  }, [tasks, users, departmentFilter, alphabetFilter, selectedEmployees, isAdmin, cfMatchSet]);

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    setDateRange(range);
  }

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));
  const alphabetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  if (isLoading || rolesLoading) {
    return (
      <div className="max-w-5xl mx-0 p-4">
        <h1 className="text-2xl font-semibold mb-4">Task Overdue Report</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Task Overdue Report</h1>
        <Button
          variant={showAll ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAll(v => !v)}
          className="gap-2"
        >
          {showAll ? "Showing All Overdue Tasks" : "Show All Overdue Tasks"}
        </Button>
      </div>
      
      {/* Advanced Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <h3 className="text-lg font-medium mb-4">Filters</h3>
        
        {/* Date Range — hidden when "Show All" is active */}
        {!showAll && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-2">Date Range (filter by task creation date)</label>
            <DateRangePresetSelector
              dateRange={dateRange}
              preset={preset}
              onChange={handlePresetChange}
            />
          </div>
        </div>
        )}

        {/* Admin-only filters */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alphabet Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Name starts with</label>
              <Select value={alphabetFilter} onValueChange={setAlphabetFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Letters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Letters</SelectItem>
                  {alphabetLetters.map(letter => (
                    <SelectItem key={letter} value={letter}>{letter}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Custom Field Filters */}
        {reportableCfFields.length > 0 && (
          <div className="pt-3 border-t mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500" />
                Custom Field Filters
                {activeCfFilters.length > 0 && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 ml-1">
                    {activeCfFilters.length} active
                  </Badge>
                )}
              </span>
              {activeCfFilters.length > 0 && (
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                  onClick={() => setCfFilters({})}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {reportableCfFields.map((f: any) => (
                <div key={f.id}>
                  <Label className="text-xs text-gray-500 mb-1 block">{f.label}</Label>
                  {(f.field_type === "select" || f.field_type === "multiselect") && f.options?.length ? (
                    <select
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    >
                      <option value="">Any</option>
                      {f.options.map((o: any) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.field_type === "boolean" ? (
                    <select
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <Input
                      className="h-8 text-sm"
                      placeholder={
                        f.field_type === "date" || f.field_type === "datetime"
                          ? "YYYY-MM-DD"
                          : `Filter by ${f.label}…`
                      }
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            {showAll
              ? "Showing all currently overdue tasks (not filtered by creation date)"
              : `Tasks created between ${format(dateRange.from, "MMM dd, yyyy")} – ${format(dateRange.to, "MMM dd, yyyy")} that are overdue`}
          </p>
          
          {overdueReport.length === 0 ? (
            <p className="text-gray-500">No overdue tasks found for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Employee Name</th>
                    <th className="text-left py-2 px-3">0-15 Days</th>
                    <th className="text-left py-2 px-3">15-30 Days</th>
                    <th className="text-left py-2 px-3">30-45 Days</th>
                    <th className="text-left py-2 px-3">45-60 Days</th>
                    <th className="text-left py-2 px-3">&gt;60 Days</th>
                    <th className="text-left py-2 px-3">Total Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueReport.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.employeeName}</td>
                      <td className="py-2 px-3">{row["0-15"]}</td>
                      <td className="py-2 px-3">{row["15-30"]}</td>
                      <td className="py-2 px-3">{row["30-45"]}</td>
                      <td className="py-2 px-3">{row["45-60"]}</td>
                      <td className="py-2 px-3">{row[">60"]}</td>
                      <td className="py-2 px-3 font-medium">{row.totalOverdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}