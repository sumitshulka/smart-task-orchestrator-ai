
import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useQuery } from "@tanstack/react-query";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { apiClient } from "@/lib/api";

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

async function fetchTaskReportView(fromDate: Date, toDate: Date, limit = 1000) {
  const { format } = await import("date-fns");
  const { fetchTasksPaginated } = await import("@/integrations/supabase/tasks");
  
  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");
  
  try {
    const { tasks } = await fetchTasksPaginated({
      fromDate: fromStr,
      toDate: toStr,
      limit: limit,
    });
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks for report:", error);
    return [];
  }
}

const columns = ["Employee Name", "Total Tasks Assigned", "Completion Ratio"];

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

  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [alphabetFilter, setAlphabetFilter] = React.useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = React.useState<any[]>([]);
  const [cfFilters, setCfFilters] = React.useState<Record<string, string>>({});

  const fromDate = dateRange.from || new Date();
  const toDate = dateRange.to || new Date();

  const { user } = useSupabaseSession();
  const { roles, loading: rolesLoading, teams: userTeams, user: userRow } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const { users } = useUsersAndTeams();
  const statusNames = statuses.map((s) => s.name);

  const isAdmin = roles.includes("admin");

  const userTeamIds = React.useMemo(() => userTeams?.map((t) => t.id) ?? [], [userTeams]);
  const [reportUserIds, setReportUserIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const resolveReportUsers = async () => {
      if (!user?.id || rolesLoading) return;
      if (roles.includes("admin")) {
        setReportUserIds([]);
        return;
      }
      if (roles.includes("manager") || roles.includes("team_manager")) {
        setReportUserIds([]);
      } else if (roles.includes("user")) {
        setReportUserIds([user.id]);
      } else {
        setReportUserIds([]);
      }
    };
    resolveReportUsers();
    // eslint-disable-next-line
  }, [user?.id, roles, userRow?.user_name, userTeamIds.join(".")]);

  // Build active CF filters (non-empty values only)
  const activeCfFilters = React.useMemo(() =>
    Object.entries(cfFilters)
      .filter(([, v]) => v.trim() !== "")
      .map(([field_id, value]) => ({ field_id, value: value.trim() })),
    [cfFilters],
  );

  // Fetch matching task IDs from the backend when CF filters are set
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

  const {
    data: taskData,
    isLoading
  } = useQuery({
    queryKey: ["task-report", fromDate, toDate, reportUserIds.join(","), roles.join(",")],
    queryFn: async () => {
      if (!user?.id || !fromDate || !toDate) return [];
      const tasks = await fetchTaskReportView(fromDate, toDate, 1000);
      
      const enrichedTasks = tasks.map(task => {
        const userInfo = users.find(u => u.id === task.assigned_to);
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
  });

  const reportingColumns = [
    columns[0],
    columns[1],
    ...statusNames,
    columns[columns.length - 1]
  ];

  const report = React.useMemo<EmployeeReport[]>(() => {
    if (!taskData) return [];
    const userMap: Record<string, EmployeeReport> = {};
    
    let filteredTaskData = taskData;

    // Custom field filter — restrict to tasks matching CF criteria
    if (cfMatchSet !== null) {
      filteredTaskData = filteredTaskData.filter(task => cfMatchSet.has(task.id));
    }
    
    if (isAdmin) {
      if (departmentFilter !== "all") {
        filteredTaskData = filteredTaskData.filter(task =>
          task.assigned_user?.department === departmentFilter
        );
      }
      
      if (alphabetFilter !== "all") {
        filteredTaskData = filteredTaskData.filter(task => {
          const firstName = task.assigned_user?.user_name?.charAt(0).toUpperCase();
          return firstName === alphabetFilter;
        });
      }
      
      if (selectedEmployees.length > 0) {
        const selectedIds = selectedEmployees.map(emp => emp.id);
        filteredTaskData = filteredTaskData.filter(task => 
          selectedIds.includes(task.assigned_to)
        );
      }
    }

    filteredTaskData.forEach((task) => {
      const assignedId = task.assigned_to || "unassigned";
      
      let userInfo = task.assigned_user;
      if (!userInfo && task.assigned_to) {
        const userFromList = users.find(u => u.id === task.assigned_to);
        if (userFromList) {
          userInfo = {
            user_name: userFromList.user_name,
            email: userFromList.email,
            department: userFromList.department
          };
        }
      }
      
      const name = (userInfo && userInfo.user_name) || (userInfo && userInfo.email) || "Unassigned";
      const email = (userInfo && userInfo.email) || "N/A";
      if (!userMap[assignedId]) {
        const initialStatusObj: Record<string, number> = {};
        for (const stat of statusNames) initialStatusObj[stat] = 0;
        userMap[assignedId] = {
          systemId: assignedId,
          employeeName: name,
          employeeEmail: email,
          totalAssigned: 0,
          ...initialStatusObj,
        };
      }
      userMap[assignedId].totalAssigned += 1;
      if (statusNames.includes(task.status)) {
        (userMap[assignedId][task.status] as number) += 1;
      }
    });
    return Object.values(userMap).map((u) => {
      const completed = u["Completed"] as number || 0;
      return {
        ...u,
        completionRatio: u.totalAssigned > 0
          ? ((completed / u.totalAssigned) * 100).toFixed(2) + "%"
          : "-"
      };
    });
  }, [taskData, statusNames, isAdmin, departmentFilter, alphabetFilter, selectedEmployees, cfMatchSet]);

  return (
    <div className="max-w-5xl mx-0 p-4">
      <h1 className="text-2xl font-semibold mb-4">Task Report</h1>
      <div className="flex flex-col md:flex-row gap-2 justify-between items-start mb-2">
        <div className="bg-muted rounded p-4 mb-4 md:mb-0 w-full md:w-auto">
          <TaskReportAdvancedFilters
            dateRange={dateRange}
            setDateRange={setDateRange}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            alphabetFilter={alphabetFilter}
            setAlphabetFilter={setAlphabetFilter}
            selectedEmployees={selectedEmployees}
            setSelectedEmployees={setSelectedEmployees}
            allUsers={users}
            isAdmin={isAdmin}
            cfFilters={cfFilters}
            setCfFilters={setCfFilters}
          />
        </div>
        <TaskReportExportButton
          disabled={isLoading || report.length === 0}
          report={report}
          statusNames={statusNames}
        />
      </div>
      <TaskReportTable
        reportingColumns={reportingColumns}
        statusNames={statusNames}
        report={report}
        isLoading={isLoading}
        statusesLoading={statusesLoading}
      />
    </div>
  );
}
