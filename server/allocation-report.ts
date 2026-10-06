export type AllocationReportUserInput = {
  id: string;
  email: string;
  user_name: string | null;
  is_active: boolean | null;
};

export type AllocationReportAssignmentInput = {
  project_id: string;
  project_name: string;
  project_code: string | null;
  project_status: string;
  project_start_date: Date | string | null;
  project_end_date: Date | string | null;
  project_actual_end_date: Date | string | null;
  user_id: string | null;
  member_user_type: string;
  allocation_percentage: number | null;
  joined_at: Date | string | null;
  left_at: Date | string | null;
};

export type AllocationReportAssignment = {
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

export type AllocationReportUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  assignments: AllocationReportAssignment[];
  totalAllocationPercentage: number;
  availableLoadPercentage: number;
  activeAllocationCount: number;
};

function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function earlierDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function buildAllocationsReport(
  users: AllocationReportUserInput[],
  sourceAssignments: AllocationReportAssignmentInput[],
  reportDate: string,
): AllocationReportUser[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const assignmentsByUser = new Map<string, AllocationReportAssignment[]>();

  for (const source of sourceAssignments) {
    if (!source.user_id || source.member_user_type === "client_contact" || !usersById.has(source.user_id)) continue;

    const projectStatus = String(source.project_status || "planning");
    const isClosedProject = ["completed", "cancelled"].includes(projectStatus.toLowerCase());
    const projectEnd = isClosedProject
      ? dateOnly(source.project_actual_end_date) ?? dateOnly(source.project_end_date)
      : dateOnly(source.project_end_date);
    const startDate = laterDate(dateOnly(source.project_start_date), dateOnly(source.joined_at));
    const endDate = earlierDate(projectEnd, dateOnly(source.left_at));
    const activeOnReportDate =
      !isClosedProject &&
      (!startDate || startDate <= reportDate) &&
      (!endDate || endDate >= reportDate);
    const allocationState: AllocationReportAssignment["allocationState"] =
      activeOnReportDate
        ? "Active"
        : startDate && startDate > reportDate
          ? "Upcoming"
          : "Ended";

    const assignment: AllocationReportAssignment = {
      projectId: source.project_id,
      projectName: source.project_name,
      projectCode: source.project_code,
      projectStatus,
      startDate,
      endDate,
      allocationPercentage: Number(source.allocation_percentage ?? 100),
      activeOnReportDate,
      allocationState,
    };
    const userAssignments = assignmentsByUser.get(source.user_id) ?? [];
    userAssignments.push(assignment);
    assignmentsByUser.set(source.user_id, userAssignments);
  }

  return users
    .map((user) => {
      const assignments = (assignmentsByUser.get(user.id) ?? [])
        .sort((a, b) => a.projectName.localeCompare(b.projectName));
      const activeAssignments = assignments.filter((assignment) => assignment.activeOnReportDate);
      const totalAllocationPercentage = activeAssignments.reduce(
        (total, assignment) => total + assignment.allocationPercentage,
        0,
      );

      return {
        id: user.id,
        name: user.user_name?.trim() || user.email,
        email: user.email,
        isActive: user.is_active !== false,
        assignments,
        totalAllocationPercentage,
        availableLoadPercentage: 100 - totalAllocationPercentage,
        activeAllocationCount: activeAssignments.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
