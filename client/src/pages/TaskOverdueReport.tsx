
import React from "react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { supabase } from "@/integrations/supabase/client";

import TaskReportAdvancedFilters from "@/components/report/TaskReportAdvancedFilters";
import TaskOverdueTable from "@/components/report/TaskOverdueTable";
import TaskOverdueExportButton from "@/components/report/TaskOverdueExportButton";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

async function fetchOverdueTasksView(fromDate: Date, toDate: Date, limit = 1000) {
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
    
    // Filter for overdue tasks (not completed and past due date)
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

  // Filter states for admin users
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [alphabetFilter, setAlphabetFilter] = React.useState<string>("all");
  const [selectedEmployees, setSelectedEmployees] = React.useState<any[]>([]);

  const fromDate = dateRange.from || new Date();
  const toDate = dateRange.to || new Date();

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
    queryKey: ["overdue-task-report", fromDate, toDate, reportUserIds.join(","), roles.join(",")],
    queryFn: async () => {
      if (!user?.id || !fromDate || !toDate) return [];
      
      // All roles use the same fetch method now
      const overdueTasks = await fetchOverdueTasksView(fromDate, toDate, 1000);
      
      // Enrich with department data from users array
      const enrichedTasks = overdueTasks.map(task => {
        const userInfo = users.find(u => u.id === task.assigned_to);
        return {
          ...task,
          assigned_user: {
            ...task.assigned_user,
            department: userInfo?.department || null,
          }
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
      <h1 className="text-2xl font-semibold mb-4">Task Overdue Report</h1>
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
          />
        </div>
        <TaskOverdueExportButton
          disabled={isLoading || overdueReport.length === 0}
          report={overdueReport}
        />
      </div>
      <TaskOverdueTable
        reportingColumns={columns}
        report={overdueReport}
        isLoading={isLoading}
      />
    </div>
  );
}
