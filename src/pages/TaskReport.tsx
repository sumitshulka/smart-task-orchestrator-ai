
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormLabel,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

type Filters = {
  fromDate: Date;
  toDate: Date;
};

const columns = [
  "Employee ID",
  "Employee Name",
  "Total Tasks Created",
  "Assigned",
  "Pending",
  "In Progress",
  "Completed",
  "Completion Ratio"
];

const statusKeys = ["assigned", "pending", "In Progress", "completed"];

const getStatus = (status: string) => {
  // Normalize status for comparison, fallback
  if (!status) return "pending";
  if (["assigned", "pending", "In Progress", "completed"].includes(status)) return status;
  if (status.toLowerCase() === "in progress") return "In Progress";
  return status;
};

function defaultFilterDates() {
  const now = new Date();
  return {
    fromDate: startOfMonth(now),
    toDate: endOfMonth(now)
  };
}

// Add EmployeeReport type for strict typing
type EmployeeReport = {
  employeeId: string;
  employeeName: string;
  totalCreated: number;
  assigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  completionRatio?: string;
};

export default function TaskReport() {
  const form = useForm<Filters>({
    defaultValues: defaultFilterDates(),
  });

  const fromDate = form.watch("fromDate");
  const toDate = form.watch("toDate");

  const {
    data: taskData,
    isLoading
  } = useQuery({
    queryKey: ["task-report", fromDate, toDate],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(fromDate, "yyyy-MM-dd"),
        toDate: format(toDate, "yyyy-MM-dd"),
        limit: 1000 // Adjust if needed
      });
      return tasks;
    }
  });

  // Group and calculate stats per employee
  const report = React.useMemo<EmployeeReport[]>(() => {
    if (!taskData) return [];
    // Get unique users
    const userMap: Record<string, EmployeeReport> = {};
    taskData.forEach(task => {
      if (!task.created_by) return;
      const uid = task.created_by;
      if (!userMap[uid]) {
        userMap[uid] = {
          employeeId: uid,
          employeeName: task.assigned_user?.user_name || task.assigned_user?.email || "N/A",
          totalCreated: 0,
          assigned: 0,
          pending: 0,
          inProgress: 0,
          completed: 0
        };
      }
      userMap[uid].totalCreated += 1;
      const status = getStatus(task.status);
      if (status === "assigned") userMap[uid].assigned += 1;
      else if (status === "pending") userMap[uid].pending += 1;
      else if (status === "In Progress") userMap[uid].inProgress += 1;
      else if (status === "completed") userMap[uid].completed += 1;
    });
    // Calculate completion ratio
    return Object.values(userMap).map((u) => ({
      ...u,
      completionRatio:
        u.totalCreated > 0
          ? ((u.completed / u.totalCreated) * 100).toFixed(2) + "%"
          : "-"
    })) as EmployeeReport[];
  }, [taskData]);

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
              {columns.map(col => (<TableHead key={col}>{col}</TableHead>))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length}>Loading...</TableCell>
              </TableRow>
            ) : report.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>No data found.</TableCell>
              </TableRow>
            ) : (
              report.map((row: EmployeeReport) => (
                <TableRow key={row.employeeId}>
                  <TableCell>{row.employeeId}</TableCell>
                  <TableCell>{row.employeeName}</TableCell>
                  <TableCell>{row.totalCreated}</TableCell>
                  <TableCell>{row.assigned}</TableCell>
                  <TableCell>{row.pending}</TableCell>
                  <TableCell>{row.inProgress}</TableCell>
                  <TableCell>{row.completed}</TableCell>
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
