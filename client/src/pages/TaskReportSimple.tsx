import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import TaskReportAdvancedFilters from "@/components/report/TaskReportAdvancedFilters";
import TaskReportTable from "@/components/report/TaskReportTable";
import TaskReportExportButton from "@/components/report/TaskReportExportButton";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

type EmployeeReport = {
  systemId: string;
  employeeName: string;
  employeeEmail: string;
  totalAssigned: number;
  [status: string]: string | number;
  completionRatio?: string;
};

export default function TaskReport() {
  const [dateRange, setDateRange] = React.useState<{ from: Date | null; to: Date | null }>(
    defaultDateRange()
  );

  // Filter states for admin users
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [alphabetFilter, setAlphabetFilter] = React.useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = React.useState<any[]>([]);

  // Make sure we always have valid dates
  const fromDate = dateRange.from || new Date();
  const toDate = dateRange.to || new Date();

  const { users } = useUsersAndTeams();
  const { roles, loading: rolesLoading, teams: userTeams, user: userRow } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  const statusNames = statuses.map((s) => s.name);
  const isAdmin = roles.includes("admin");

  // Keep userTeamIds and reportUserIds for possible filtering
  const userTeamIds = React.useMemo(() => userTeams?.map((t) => t.id) ?? [], [userTeams]);
  const [reportUserIds, setReportUserIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!userRow?.id || rolesLoading) return;
    
    if (roles.includes("admin")) {
      setReportUserIds([]);
    } else if (roles.includes("manager") || roles.includes("team_manager")) {
      setReportUserIds([]);
    } else if (roles.includes("user")) {
      setReportUserIds([userRow.id]);
    } else {
      setReportUserIds([]);
    }
  }, [userRow?.id, roles.join(","), rolesLoading]);

  const { data: taskData, isLoading } = useQuery({
    queryKey: ["task-report", fromDate, toDate, reportUserIds.join(","), roles.join(",")],
    queryFn: async () => {
      if (!userRow?.id || !fromDate || !toDate) return [];
      
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(fromDate, "yyyy-MM-dd"),
        toDate: format(toDate, "yyyy-MM-dd"),
        limit: 1000,
      });
      
      // Enrich tasks with full user data from users array
      const enrichedTasks = tasks.map(task => {
        const userInfo = users.find(u => u.id === task.assigned_to);
        
        // Debug logging to understand the matching issue
        if (task.assigned_to && !userInfo) {
          console.log('[DEBUG] Task with assigned_to but no user found:', {
            taskId: task.id,
            assigned_to: task.assigned_to,
            availableUserIds: users.map(u => u.id),
            users: users.length
          });
        }
        
        return {
          ...task,
          assigned_user: userInfo ? {
            user_name: userInfo.user_name,
            email: userInfo.email,
            department: userInfo.department
          } : null
        };
      });
      
      return enrichedTasks;
    },
    enabled: !!userRow?.id && !rolesLoading && !statusesLoading,
  });

  const reportingColumns = [
    "Employee Name",
    "Total Tasks Assigned",
    ...statusNames,
    "Completion Ratio"
  ];

  const report = React.useMemo<EmployeeReport[]>(() => {
    if (!taskData) return [];
    const userMap: Record<string, EmployeeReport> = {};
    
    // Filter task data based on admin filters
    let filteredTaskData = taskData;
    
    if (isAdmin) {
      // Department filter
      if (departmentFilter !== "all") {
        filteredTaskData = filteredTaskData.filter(task => {
          return task.assigned_user?.department === departmentFilter;
        });
      }
      
      // Alphabet filter
      if (alphabetFilter !== "all") {
        filteredTaskData = filteredTaskData.filter(task => {
          const name = task.assigned_user?.user_name || task.assigned_user?.email || "";
          return name.toLowerCase().startsWith(alphabetFilter.toLowerCase());
        });
      }
      
      // Selected employees filter
      if (selectedEmployees.length > 0) {
        const selectedIds = selectedEmployees.map(emp => emp.id);
        filteredTaskData = filteredTaskData.filter(task => 
          selectedIds.includes(task.assigned_to)
        );
      }
    }

    filteredTaskData.forEach((task) => {
      const userId = task.assigned_to || "unassigned";
      const assignedUser = task.assigned_user;
      const employeeName = assignedUser?.user_name || assignedUser?.email || "Unassigned";
      const employeeEmail = assignedUser?.email || "N/A";
      
      // Debug logging for unassigned tasks
      if (task.assigned_to && !assignedUser) {
        console.log('[DEBUG] Task showing as unassigned:', {
          taskId: task.id,
          title: task.title,
          assigned_to: task.assigned_to,
          assigned_user: task.assigned_user,
          employeeName
        });
      }

      if (!userMap[userId]) {
        userMap[userId] = {
          systemId: userId,
          employeeName,
          employeeEmail,
          totalAssigned: 0,
        };
        
        // Initialize status counts
        statusNames.forEach((status) => {
          userMap[userId][status] = 0;
        });
      }

      userMap[userId].totalAssigned += 1;
      const taskStatus = task.status || "Unknown";
      if (statusNames.includes(taskStatus)) {
        userMap[userId][taskStatus] = (userMap[userId][taskStatus] as number) + 1;
      }
    });

    // Calculate completion ratios
    const reportList = Object.values(userMap);
    reportList.forEach((emp) => {
      const completedCount = statusNames.reduce((sum, status) => {
        if (status.toLowerCase().includes("completed") || status.toLowerCase().includes("done")) {
          return sum + (emp[status] as number);
        }
        return sum;
      }, 0);
      
      emp.completionRatio = emp.totalAssigned > 0 
        ? `${Math.round((completedCount / emp.totalAssigned) * 100)}%` 
        : "0%";
    });

    return reportList;
  }, [taskData, statusNames, departmentFilter, alphabetFilter, selectedEmployees, isAdmin]);

  if (isLoading || rolesLoading || statusesLoading) {
    return (
      <div className="max-w-6xl mx-0 p-4">
        <h1 className="text-2xl font-semibold mb-4">Task Report</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-0 p-4">
      <h1 className="text-2xl font-semibold mb-4">Task Report</h1>
      
      {/* Advanced Filters */}
      <TaskReportAdvancedFilters
        dateRange={dateRange}
        setDateRange={setDateRange}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        alphabetFilter={alphabetFilter}
        setAlphabetFilter={setAlphabetFilter}
        selectedEmployees={selectedEmployees}
        setSelectedEmployees={setSelectedEmployees}
        isAdmin={isAdmin}
        allUsers={users}
      />

      {/* Export Button */}
      <div className="mb-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Export to CSV
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4">
          {report.length === 0 ? (
            <p className="text-gray-500">No tasks found for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {reportingColumns.map((col, idx) => (
                      <th key={idx} className="text-left py-2 px-3">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.employeeName}</td>
                      <td className="py-2 px-3">{row.totalAssigned}</td>
                      {statusNames.map(status => (
                        <td key={status} className="py-2 px-3">{row[status] || 0}</td>
                      ))}
                      <td className="py-2 px-3 font-medium">{row.completionRatio}</td>
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