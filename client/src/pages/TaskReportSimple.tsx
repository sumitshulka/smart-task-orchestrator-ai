import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchTasksPaginated } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

export default function TaskReport() {
  const [dateRange] = React.useState(defaultDateRange());
  const { users } = useUsersAndTeams();
  const { roles } = useCurrentUserRoleAndTeams();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["task-report", format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { tasks } = await fetchTasksPaginated({
        fromDate: format(dateRange.from, "yyyy-MM-dd"),
        toDate: format(dateRange.to, "yyyy-MM-dd"),
        limit: 1000,
      });
      return tasks;
    }
  });

  const employeeReport = React.useMemo(() => {
    if (!tasks) return [];
    
    const userMap: Record<string, any> = {};
    
    tasks.forEach(task => {
      const assignedId = task.assigned_to || "unassigned";
      const userInfo = users.find(u => u.id === task.assigned_to);
      const name = userInfo?.user_name || userInfo?.email || "Unassigned";
      const email = userInfo?.email || "N/A";
      
      if (!userMap[assignedId]) {
        userMap[assignedId] = {
          employeeName: name,
          employeeEmail: email,
          totalAssigned: 0,
          completed: 0,
          inProgress: 0,
          new: 0,
          completionRatio: "0%"
        };
      }
      
      userMap[assignedId].totalAssigned++;
      
      if (task.status.toLowerCase() === "completed") {
        userMap[assignedId].completed++;
      } else if (task.status.toLowerCase().includes("progress")) {
        userMap[assignedId].inProgress++;
      } else if (task.status.toLowerCase() === "new") {
        userMap[assignedId].new++;
      }
      
      // Calculate completion ratio
      const completed = userMap[assignedId].completed;
      const total = userMap[assignedId].totalAssigned;
      userMap[assignedId].completionRatio = total > 0 ? `${Math.round((completed / total) * 100)}%` : "0%";
    });
    
    return Object.values(userMap);
  }, [tasks, users]);

  if (isLoading) {
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
      
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Report for {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
        </p>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4">
          {employeeReport.length === 0 ? (
            <p className="text-gray-500">No tasks found for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Employee Name</th>
                    <th className="text-left py-2 px-3">Email</th>
                    <th className="text-left py-2 px-3">Total Assigned</th>
                    <th className="text-left py-2 px-3">Completed</th>
                    <th className="text-left py-2 px-3">In Progress</th>
                    <th className="text-left py-2 px-3">New</th>
                    <th className="text-left py-2 px-3">Completion Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeReport.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.employeeName}</td>
                      <td className="py-2 px-3 text-gray-600">{row.employeeEmail}</td>
                      <td className="py-2 px-3">{row.totalAssigned}</td>
                      <td className="py-2 px-3 text-green-600">{row.completed}</td>
                      <td className="py-2 px-3 text-blue-600">{row.inProgress}</td>
                      <td className="py-2 px-3 text-gray-600">{row.new}</td>
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