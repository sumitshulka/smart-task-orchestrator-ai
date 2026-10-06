import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { AlertTriangle, BriefcaseBusiness, ChevronRight, Download, Search, Users, UserRoundCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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

  const toggleUser = (userId: string) => {
    setExpandedUsers((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const downloadReport = async (format: "pdf" | "xlsx") => {
    if (!data) return;
    setDownloading(format);
    setDownloadError(null);
    try {
      const asOf = encodeURIComponent(data.reportDate);
      await apiClient.download(
        `/reports/allocations.${format}?asOf=${asOf}`,
        `allocations-report-${data.reportDate}.${format}`,
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download the report.");
    } finally {
      setDownloading(null);
    }
  };

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
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="rounded-lg border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">As of </span>
              <span className="font-medium">{format(parseISO(data.reportDate), "d MMM yyyy")}</span>
              <span className="ml-2 text-xs text-muted-foreground">{data.timeZone}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => void downloadReport("pdf")}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading === "pdf" ? "Preparing PDF…" : "Download PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => void downloadReport("xlsx")}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading === "xlsx" ? "Preparing Excel…" : "Download Excel"}
            </Button>
          </div>
        )}
      </header>

      {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}

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
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon={Users} label="All users" value={summary.totalUsers} detail="Organization roster" tone="blue" loading={isLoading} />
            <SummaryCard icon={UserRoundCheck} label="Assigned today" value={summary.allocatedUsers} detail="People with active work" tone="green" loading={isLoading} />
            <SummaryCard icon={BriefcaseBusiness} label="Active assignments" value={summary.activeAssignments} detail="In effect today" tone="violet" loading={isLoading} />
            <SummaryCard icon={AlertTriangle} label="Overallocated" value={summary.overallocatedUsers} detail="Above 100% allocation" tone="amber" loading={isLoading} />
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
                      <TableHead>Assigned project</TableHead>
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
                          isExpanded={expandedUsers.has(user.id)}
                          onToggle={() => toggleUser(user.id)}
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
  tone: "blue" | "green" | "violet" | "amber";
  loading: boolean;
}) {
  const tones = {
    blue: {
      card: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/35",
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-300",
    },
    green: {
      card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300",
    },
    violet: {
      card: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35",
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300",
    },
    amber: {
      card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35",
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300",
    },
  }[tone];

  return (
    <Card className={tones.card}>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className={`shrink-0 rounded-lg p-2 ${tones.icon}`}>
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
  isExpanded,
  onToggle,
}: {
  user: AllocationUser;
  isOverallocated: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasAssignments = user.assignments.length > 0;

  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={5} className="p-0">
          <button
            type="button"
            onClick={onToggle}
            disabled={!hasAssignments}
            aria-expanded={hasAssignments ? isExpanded : undefined}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${user.name} project allocations`}
            className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-default md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              {hasAssignments ? (
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  aria-hidden="true"
                />
              ) : <span className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{user.name}</span>
                  {!user.isActive && <Badge variant="outline" className="text-[10px]">Inactive user</Badge>}
                  <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                    Projects ({user.assignments.length})
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-7 md:justify-end">
              <div>
                <p className="text-[11px] text-muted-foreground">Total allocation</p>
                <p className={`text-sm font-semibold ${isOverallocated ? "text-red-600 dark:text-red-400" : ""}`}>
                  {user.totalAllocationPercentage}%
                </p>
              </div>
              <div className="min-w-24 text-left md:text-right">
                <p className="text-[11px] text-muted-foreground">Available load</p>
                <p className={`text-sm font-semibold ${isOverallocated ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {user.availableLoadPercentage}%
                  {isOverallocated && <span className="ml-1 text-[10px] font-medium">over</span>}
                </p>
              </div>
            </div>
          </button>
        </TableCell>
      </TableRow>
      {isExpanded && user.assignments.map((assignment, index) => (
        <TableRow key={`${user.id}-${assignment.projectId}-${index}`}>
          <TableCell className="min-w-48 pl-10">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium">{assignment.projectName}</span>
              {assignment.projectCode && <span className="text-xs text-muted-foreground">{assignment.projectCode}</span>}
              <span className="text-xs capitalize text-muted-foreground">{assignment.projectStatus.replace(/_/g, " ")}</span>
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
      ))}
    </>
  );
}
