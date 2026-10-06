import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { AlertTriangle, BriefcaseBusiness, Search, Users, UserRoundCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type AllocationAssignment = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  projectStatus: string;
  startDate: string | null;
  endDate: string | null;
  allocationPercentage: number;
  activeOnReportDate: boolean;
  allocationState: "Active" | "Upcoming" | "Ended";
};

type AllocationUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  assignments: AllocationAssignment[];
  totalAllocationPercentage: number;
  availableLoadPercentage: number;
  activeAllocationCount: number;
};

type AllocationsReportData = {
  reportDate: string;
  timeZone: string;
  users: AllocationUser[];
};

function displayDate(value: string | null) {
  return value ? format(parseISO(value), "d MMM yyyy") : "—";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export default function AllocationsReport() {
  const [search, setSearch] = useState("");
  const [allocationFilter, setAllocationFilter] = useState("all");
  const { data, isLoading, isError, refetch } = useQuery<AllocationsReportData>({
    queryKey: ["/api/reports/allocations"],
    queryFn: () => apiClient.get("/reports/allocations"),
  });

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      const matchesSearch = !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.assignments.some((assignment) => assignment.projectName.toLowerCase().includes(query) ||
          assignment.projectCode?.toLowerCase().includes(query));
      const matchesFilter = allocationFilter === "all" ||
        (allocationFilter === "available" && user.availableLoadPercentage > 0) ||
        (allocationFilter === "overallocated" && user.availableLoadPercentage < 0);
      return matchesSearch && matchesFilter;
    });
  }, [data?.users, search, allocationFilter]);

  const summary = useMemo(() => {
    const users = data?.users ?? [];
    return {
      totalUsers: users.length,
      allocatedUsers: users.filter((user) => user.activeAllocationCount > 0).length,
      activeAssignments: users.reduce((total, user) => total + user.activeAllocationCount, 0),
      overallocatedUsers: users.filter((user) => user.totalAllocationPercentage > 100).length,
    };
  }, [data?.users]);

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
            Project Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
            Allocations Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide project assignments and remaining user capacity.
          </p>
        </div>
        {data && (
          <div className="rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">As of </span>
            <span className="font-medium">{format(parseISO(data.reportDate), "d MMM yyyy")}</span>
            <span className="ml-2 text-xs text-muted-foreground">{data.timeZone}</span>
          </div>
        )}
      </header>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <h2 className="font-medium">Could not load the allocations report</h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your access and try again.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Users} label="Organization users" value={summary.totalUsers} loading={isLoading} />
            <SummaryCard icon={UserRoundCheck} label="Allocated today" value={summary.allocatedUsers} detail="users with an active project assignment" loading={isLoading} />
            <SummaryCard icon={BriefcaseBusiness} label="Active assignments" value={summary.activeAssignments} detail="project allocations in effect today" loading={isLoading} />
            <SummaryCard icon={AlertTriangle} label="Overallocated users" value={summary.overallocatedUsers} detail="total allocation above 100%" tone={summary.overallocatedUsers > 0 ? "warning" : undefined} loading={isLoading} />
          </section>

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">People and project allocations</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Available load is 100% minus allocations active on the report date. Negative values indicate over-allocation.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search people or projects"
                    className="pl-9"
                    aria-label="Search people or projects"
                  />
                </div>
                <Select value={allocationFilter} onValueChange={setAllocationFilter}>
                  <SelectTrigger className="sm:w-48" aria-label="Filter allocation report">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="available">Has available load</SelectItem>
                    <SelectItem value="overallocated">Overallocated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />)}
                </div>
              ) : visibleUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {data?.users.length ? "No users match your search or filter." : "No organization users were found."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Start date</TableHead>
                      <TableHead>End date</TableHead>
                      <TableHead className="text-right">Allocation</TableHead>
                      <TableHead className="text-right">Assignment status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUsers.map((user) => {
                      const isOverallocated = user.availableLoadPercentage < 0;
                      return (
                        <UserAllocationRows
                          key={user.id}
                          user={user}
                          isOverallocated={isOverallocated}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {!isLoading && data && visibleUsers.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing {visibleUsers.length} of {data.users.length} users
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  loading,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  detail?: string;
  tone?: "warning";
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`rounded-lg p-2 ${tone === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">
            {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle" /> : value}
          </p>
          {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function UserAllocationRows({
  user,
  isOverallocated,
}: {
  user: AllocationUser;
  isOverallocated: boolean;
}) {
  const assignments = user.assignments.length > 0 ? user.assignments : [null];
  const allocatedBar = Math.min(Math.max(user.totalAllocationPercentage, 0), 100);

  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={5} className="py-3">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{user.name}</span>
                  {!user.isActive && <Badge variant="outline" className="text-[10px]">Inactive user</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
              <div className="min-w-32">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total allocation</span>
                  <span className={`font-semibold ${isOverallocated ? "text-red-600 dark:text-red-400" : ""}`}>
                    {user.totalAllocationPercentage}%
                  </span>
                </div>
                <Progress
                  value={allocatedBar}
                  className={`mt-1 h-1.5 ${isOverallocated ? "[&>div]:bg-red-500" : "[&>div]:bg-indigo-500"}`}
                  aria-label={`Total allocation ${user.totalAllocationPercentage}%`}
                />
              </div>
              <div className="min-w-28 text-right">
                <p className="text-[11px] text-muted-foreground">Available load</p>
                <p className={`text-sm font-semibold ${isOverallocated ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {user.availableLoadPercentage}%
                  {isOverallocated && <span className="ml-1 text-[10px] font-medium">over</span>}
                </p>
              </div>
            </div>
          </div>
        </TableCell>
      </TableRow>
      {assignments.map((assignment, index) => assignment ? (
        <TableRow key={`${user.id}-${assignment.projectId}-${index}`}>
          <TableCell className="min-w-48 pl-8">
            <div className="font-medium">{assignment.projectName}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {assignment.projectCode ? `${assignment.projectCode} · ` : ""}
              {assignment.projectStatus.replace(/_/g, " ")}
            </div>
          </TableCell>
          <TableCell className="whitespace-nowrap text-sm">{displayDate(assignment.startDate)}</TableCell>
          <TableCell className="whitespace-nowrap text-sm">{displayDate(assignment.endDate)}</TableCell>
          <TableCell className="text-right font-medium">{assignment.allocationPercentage}%</TableCell>
          <TableCell className="text-right">
            <Badge variant={assignment.allocationState === "Active" ? "secondary" : "outline"} className="capitalize">
              {assignment.allocationState}
            </Badge>
          </TableCell>
        </TableRow>
      ) : (
        <TableRow key={`${user.id}-no-allocation`}>
          <TableCell colSpan={5} className="py-3 pl-8 text-sm text-muted-foreground">
            No project allocations recorded.
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
