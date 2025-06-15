import React from "react";
import { useForm } from "react-hook-form";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useQuery } from "@tanstack/react-query";
import {
  Form, FormLabel, FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { supabase } from "@/integrations/supabase/client";

function defaultFilterDates() {
  const now = new Date();
  return {
    fromDate: startOfMonth(now),
    toDate: endOfMonth(now)
  };
}

// Edit columns as before; do not expose systemId, append email under employee name.
const columns = [
  "Employee Name",
  "Total Tasks Assigned",
  // Dynamically fill in statuses from DB
  // "Completed", etc, will be generated after fetching
  "Completion Ratio"
];

type EmployeeReport = {
  systemId: string;
  employeeName: string;
  employeeEmail: string;
  totalAssigned: number;
  [status: string]: string | number; // Dynamic status counts, also include systemId/email/name/assigned/ratio
  completionRatio?: string;
};

export default function TaskReport() {
  const form = useForm<{ fromDate: Date; toDate: Date }>({
    defaultValues: defaultFilterDates(),
  });

  const fromDate = form.watch("fromDate");
  const toDate = form.watch("toDate");

  const { user } = useSupabaseSession();
  const { roles, loading: rolesLoading, teams: userTeams, user: userRow } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const statusNames = statuses.map(s => s.name);

  // Helper: get uuids of users team
  const userTeamIds = React.useMemo(() => userTeams?.map(t => t.id) ?? [], [userTeams]);

  // --- NEW: For manager/team_manager, get users in their teams ---
  const [reportUserIds, setReportUserIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    // For admin: show all tasks/users (don't restrict), for user: just self, for manager: only those assigned to any in reportUserIds
    const resolveReportUsers = async () => {
      if (!user?.id || rolesLoading) return;

      if (roles.includes("admin")) {
        setReportUserIds([]); // Empty array means include all
        return;
      }
      if (roles.includes("manager") || roles.includes("team_manager")) {
        // Get all user ids where user's manager is self OR in their teams
        // 1. Users with manager = my user_name
        const { data: managedByMe } = await supabase
          .from("users")
          .select("id")
          .eq("manager", userRow?.user_name ?? "");
        // 2. Users who share my team memberships
        let teamMembers: any[] = [];
        if (userTeamIds.length) {
          const { data: teamMems } = await supabase
            .from("team_memberships")
            .select("user_id")
            .in("team_id", userTeamIds);
          teamMembers = teamMems?.map((m: any) => m.user_id) ?? [];
        }
        // No duplicates, exclude self
        const allReportUsers = [
          ...(managedByMe?.map((u: any) => u.id) ?? []),
          ...teamMembers
        ].filter((uid, i, arr) => uid && arr.indexOf(uid) === i && uid !== user.id);
        setReportUserIds([user.id, ...allReportUsers]); // Include self
      } else if (roles.includes("user")) {
        setReportUserIds([user.id]);
      } else {
        setReportUserIds([]);
      }
    };
    resolveReportUsers();
    // eslint-disable-next-line
  }, [user?.id, roles, userRow?.user_name, userTeamIds.join(".")]);

  // 2. Fetch tasks for the date filter
  const {
    data: taskData,
    isLoading
  } = useQuery({
    queryKey: ["task-report", fromDate, toDate, reportUserIds.join(",")],
    queryFn: async () => {
      if (!user?.id) return [];
      let filters: any = {
        fromDate: format(fromDate, "yyyy-MM-dd"),
        toDate: format(toDate, "yyyy-MM-dd"),
        limit: 1000
      };
      // For user: only assigned to self or created by self
      // For manager: only those assigned to any in reportUserIds
      if (reportUserIds.length === 1) {
        filters.assignedTo = reportUserIds[0];
      } else if (reportUserIds.length > 1) {
        // For manager/team_manager, fetch all and filter after
        // (no assignedTo set, will filter after fetch)
      }
      // For admin (reportUserIds.length === 0), do NOT set assignedTo
      // console.log the filters for debugging
      // Remove this log if not needed after patch
      // console.log("Fetching with filters:", filters);

      const { tasks } = await fetchTasksPaginated(filters);

      // For user: just own tasks
      if (reportUserIds.length === 1) {
        return tasks.filter(t => t.assigned_to === reportUserIds[0] || t.created_by === reportUserIds[0]);
      }
      // For manager/team, only count if assigned_to is in reportUserIds
      if (reportUserIds.length > 1) {
        return tasks.filter(t => reportUserIds.includes(t.assigned_to ?? ""));
      }
      // For admin (reportUserIds.length === 0), return all
      return tasks;
    }
  });

  // 3. Build reporting columns with all statuses dynamically
  const reportingColumns = [
    columns[0],
    columns[1],
    ...statusNames,
    columns[columns.length - 1]
  ];

  // 4. Group and calculate stats per assigned employee
  const report = React.useMemo<EmployeeReport[]>(() => {
    if (!taskData) return [];
    const userMap: Record<string, EmployeeReport> = {};
    taskData.forEach(task => {
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
    // Add completion ratio
    return Object.values(userMap).map(u => {
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
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Task Report</h1>
      <div className="bg-muted rounded p-4 mb-4">
        <Form {...form}>
          <form className="flex flex-col md:flex-row gap-4 items-center w-full md:justify-start">
            <FormField
              control={form.control}
              name="fromDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className="min-w-[140px] justify-start text-left font-normal"
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={date => date > toDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className="min-w-[140px] justify-start text-left font-normal"
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={date => date < fromDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {reportingColumns.map(col => (<TableHead key={col}>{col}</TableHead>))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || statusesLoading ? (
              <TableRow>
                <TableCell colSpan={reportingColumns.length}>Loading...</TableCell>
              </TableRow>
            ) : report.length === 0 ? (
              <TableRow>
                <TableCell colSpan={reportingColumns.length}>No data found.</TableCell>
              </TableRow>
            ) : (
              report.map((row: EmployeeReport) => (
                <TableRow key={row.systemId}>
                  {/* Employee Name + Email */}
                  <TableCell>
                    <span>{row.employeeName}</span>
                    <span className="text-muted-foreground text-xs block">
                      {row.employeeEmail}
                    </span>
                  </TableCell>
                  <TableCell>{row.totalAssigned}</TableCell>
                  {statusNames.map(status => (
                    <TableCell key={status}>{row[status] as number}</TableCell>
                  ))}
                  <TableCell>{row.completionRatio}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// src/pages/TaskReport.tsx is getting long. After you confirm the build is fixed, consider asking me to refactor this page into smaller components for maintainability!
