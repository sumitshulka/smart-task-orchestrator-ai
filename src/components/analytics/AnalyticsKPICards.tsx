
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, AlertTriangle, ListChecks } from "lucide-react";

type AnalyticsKPICardsProps = {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeUsers: number;
};

export default function AnalyticsKPICards({
  totalTasks,
  completedTasks,
  overdueTasks,
  activeUsers,
}: AnalyticsKPICardsProps) {
  const cards = [
    {
      label: "Total Tasks",
      value: totalTasks,
      icon: ListChecks,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Completed Tasks",
      value: completedTasks,
      icon: CheckCircle,
      color: "bg-green-100 text-green-600",
    },
    {
      label: "Overdue Tasks",
      value: overdueTasks,
      icon: AlertTriangle,
      color: "bg-red-100 text-red-600",
    },
    {
      label: "Active Users",
      value: activeUsers,
      icon: Users,
      color: "bg-purple-100 text-purple-600",
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((kpi) => (
        <Card key={kpi.label} className="flex-1 shadow-sm border-0">
          <CardContent className="flex items-center gap-4 py-6">
            <span className={`rounded-full p-3 ${kpi.color}`}>
              <kpi.icon className="w-7 h-7" />
            </span>
            <div>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-muted-foreground text-xs">{kpi.label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
