import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { Calendar, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";

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

  const { users } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();

  const isAdmin = roles.includes("admin");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["overdue-tasks", format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(dateRange.from, "yyyy-MM-dd"),
        toDate: format(dateRange.to, "yyyy-MM-dd"),
        limit: 1000,
      });
      
      // Filter for overdue tasks
      const today = new Date();
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
  }, [tasks, users, departmentFilter, alphabetFilter, selectedEmployees, isAdmin]);

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
      <h1 className="text-2xl font-semibold mb-4">Task Overdue Report</h1>
      
      {/* Advanced Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <h3 className="text-lg font-medium mb-4">Filters</h3>
        
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <DateRangePresetSelector
              dateRange={dateRange}
              preset={preset}
              onChange={handlePresetChange}
            />
          </div>
        </div>

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
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Report for {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
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