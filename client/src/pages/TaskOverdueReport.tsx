
import React from "react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
// Removed supabase import as it's no longer needed

import TaskReportAdvancedFilters from "@/components/report/TaskReportAdvancedFilters";
import TaskReportTable from "@/components/report/TaskReportTable";
import TaskReportExportButton from "@/components/report/TaskReportExportButton";
import { Button } from "@/components/ui/button";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

/**
 * Fetch overdue tasks.
 * When fromDate/toDate are null the creation-date filter is skipped and all
 * currently overdue tasks are returned (the "Show All" mode).
 */
async function fetchOverdueTasksView(fromDate: Date | null, toDate: Date | null, limit = 1000) {
  const { format } = await import("date-fns");
  const { fetchTasksPaginated } = await import("@/integrations/supabase/tasks");
  
  try {
    const input: import("@/integrations/supabase/tasks").FetchTasksInput = {
      limit,
      // Always surface overdue tasks even when a date range is used
      includeOverdue: true,
    };
    if (fromDate && toDate) {
      input.fromDate = format(fromDate, "yyyy-MM-dd");
      input.toDate = format(toDate, "yyyy-MM-dd");
    }

    const { tasks } = await fetchTasksPaginated(input);
    
    // Keep only tasks that are genuinely overdue (not completed, due date in past)
    const today = new Date();
    const overdueTasks = tasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < today && 
      task.status.toLowerCase() !== "completed"
    );
    
    return overdueTasks;
  } catch (error) {
    console.error("Error fetching overdue tasks:", error);
    return [];
  }
}

async function fetchManagerOverdueTasksView(fromDate: Date, toDate: Date, limit = 1000) {
  // Use the same logic as fetchOverdueTasksView since we're using API client now
  return await fetchOverdueTasksView(fromDate, toDate, limit);
}

const columns = ["Employee Name", "0-15 Days", "15-30 Days", "30-45 Days", "45-60 Days", ">60 Days", "Total Overdue"];

type OverdueReport = {
  systemId: string;
  employeeName: string;
  employeeEmail: string;
  "0-15": number;
  "15-30": number;
  "30-45": number;
  "45-60": number;
  ">60": number;
  totalOverdue: number;
};

export default function TaskOverdueReport() {
  const [dateRange, setDateRange] = React.useState<{ from: Date | null; to: Date | null }>(
    defaultDateRange()
  );
  // When true: ignore the date range and return ALL currently overdue tasks.
  const [showAll, setShowAll] = React.useState(true);

  // Filter states for admin users
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [alphabetFilter, setAlphabetFilter] = React.useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = React.useState<any[]>([]);

  const fromDate = showAll ? null : (dateRange.from || new Date());
  const toDate = showAll ? null : (dateRange.to || new Date());

  const { user } = useSupabaseSession();
  const { roles, loading: rolesLoading, teams: userTeams, user: userRow } = useCurrentUserRoleAndTeams();
  const { users } = useUsersAndTeams();

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
        // Simplified approach for now
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

  const {
    data: overdueTaskData,
    isLoading
  } = useQuery({
    queryKey: ["overdue-task-report", showAll ? "all" : fromDate, showAll ? "all" : toDate, reportUserIds.join(","), roles.join(",")],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // All roles use the same fetch method now
      // Pass null dates when showAll is true to skip the date range filter
      const overdueTasks = await fetchOverdueTasksView(fromDate, toDate, 1000);
      
      // Enrich tasks with full user data from users array
      const enrichedTasks = overdueTasks.map(task => {
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
      
      // Filter by user role if needed
      if (roles.includes("user") && reportUserIds.length === 1) {
        return enrichedTasks.filter(task => task.assigned_to === reportUserIds[0]);
      }
      
      return enrichedTasks;
    },
  });

  const overdueReport = React.useMemo<OverdueReport[]>(() => {
    if (!overdueTaskData) return [];
    const userMap: Record<string, OverdueReport> = {};
    
    // Filter task data based on admin filters
    let filteredTaskData = overdueTaskData;
    
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

    const today = new Date();
    
    filteredTaskData.forEach((task) => {
      const assignedId = task.assigned_to || "unassigned";
      
      // Get user info from users array if not present in task.assigned_user
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
        userMap[assignedId] = {
          systemId: assignedId,
          employeeName: name,
          employeeEmail: email,
          "0-15": 0,
          "15-30": 0,
          "30-45": 0,
          "45-60": 0,
          ">60": 0,
          totalOverdue: 0,
        };
      }
      
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const daysPastDue = differenceInDays(today, dueDate);
        
        if (daysPastDue >= 0) {
          userMap[assignedId].totalOverdue += 1;
          
          if (daysPastDue <= 15) {
            userMap[assignedId]["0-15"] += 1;
          } else if (daysPastDue <= 30) {
            userMap[assignedId]["15-30"] += 1;
          } else if (daysPastDue <= 45) {
            userMap[assignedId]["30-45"] += 1;
          } else if (daysPastDue <= 60) {
            userMap[assignedId]["45-60"] += 1;
          } else {
            userMap[assignedId][">60"] += 1;
          }
        }
      }
    });
    
    return Object.values(userMap);
  }, [overdueTaskData, isAdmin, departmentFilter, alphabetFilter, selectedEmployees]);

  return (
    <div className="max-w-5xl mx-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Task Overdue Report</h1>
        <Button
          variant={showAll ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? "Showing All Overdue Tasks" : "Show All Overdue Tasks"}
        </Button>
      </div>
      <div className="flex flex-col md:flex-row gap-2 justify-between items-start mb-2">
        {!showAll && (
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
          />
        </div>
        )}
        <TaskReportExportButton
          disabled={isLoading || overdueReport.length === 0}
          report={overdueReport}
          statusNames={["0-15", "15-30", "30-45", "45-60", ">60"]}
        />
      </div>
      <TaskReportTable
        reportingColumns={columns}
        statusNames={["0-15", "15-30", "30-45", "45-60", ">60"]}
        report={overdueReport}
        isLoading={isLoading}
        statusesLoading={false}
      />
    </div>
  );
}
