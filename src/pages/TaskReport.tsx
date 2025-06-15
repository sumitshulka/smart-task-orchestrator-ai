import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useQuery } from "@tanstack/react-query";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { supabase } from "@/integrations/supabase/client";

import TaskReportFilters from "@/components/report/TaskReportFilters";
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
  const { supabase } = await import("@/integrations/supabase/client");
  const { format } = await import("date-fns");
  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("tasks_report_view")
    .select("*")
    .gte("created_at", fromStr)
    .lte("created_at", toStr)
    .limit(limit);
  if (error) {
    console.error("Error fetching from tasks_report_view:", error);
    return [];
  }
  return data || [];
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

  // Make sure we always have valid dates
  const fromDate = dateRange.from || new Date();
  const toDate = dateRange.to || new Date();

  const { user } = useSupabaseSession();
  const { roles, loading: rolesLoading, teams: userTeams, user: userRow } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const statusNames = statuses.map((s) => s.name);

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
        const { data: managedByMe } = await supabase
          .from("users")
          .select("id")
          .eq("manager", userRow?.user_name ?? "");
        let teamMembers: any[] = [];
        if (userTeamIds.length) {
          const { data: teamMems } = await supabase
            .from("team_memberships")
            .select("user_id")
            .in("team_id", userTeamIds);
          teamMembers = teamMems?.map((m: any) => m.user_id) ?? [];
        }
        const allReportUsers = [
          ...(managedByMe?.map((u: any) => u.id) ?? []),
          ...teamMembers,
        ].filter((uid, i, arr) => uid && arr.indexOf(uid) === i && uid !== user.id);
        setReportUserIds([user.id, ...allReportUsers]);
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
    data: taskData,
    isLoading
  } = useQuery({
    queryKey: ["task-report", fromDate, toDate, reportUserIds.join(","), roles.join(",")],
    queryFn: async () => {
      if (!user?.id || !fromDate || !toDate) return [];
      if (roles.includes("admin")) {
        const rows = await fetchTaskReportView(fromDate, toDate, 1000);
        return (rows as any[]).map((r) => ({
          ...r,
          assigned_to: r.assignee_email ? r.assignee_email : null,
          assigned_user: {
            user_name: r.assignee_name,
            email: r.assignee_email,
          },
        }));
      }
      let filters: any = {
        fromDate: format(fromDate, "yyyy-MM-dd"),
        toDate: format(toDate, "yyyy-MM-dd"),
        limit: 1000,
      };
      if (reportUserIds.length === 1) {
        filters.assignedTo = reportUserIds[0];
      }
      const { tasks } = await fetchTasksPaginated(filters);
      if (reportUserIds.length === 1) {
        return tasks.filter((t) => t.assigned_to === reportUserIds[0] || t.created_by === reportUserIds[0]);
      }
      if (reportUserIds.length > 1) {
        return tasks.filter((t) => reportUserIds.includes(t.assigned_to ?? ""));
      }
      return tasks;
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
    taskData.forEach((task) => {
      const assignedId = task.assigned_to || "unassigned";
      const userInfo = task.assigned_user;
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
  }, [taskData, statusNames]);

  return (
    <div className="max-w-5xl mx-0 p-4">
      <h1 className="text-2xl font-semibold mb-4">Task Report</h1>
      <div className="flex flex-col md:flex-row gap-2 justify-between items-start mb-2">
        <div className="bg-muted rounded p-4 mb-4 md:mb-0 w-full md:w-auto">
          <TaskReportFilters dateRange={dateRange} setDateRange={setDateRange} />
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
