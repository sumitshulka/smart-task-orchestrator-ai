
import React from "react";
import Papa from "papaparse";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaskReportExportButtonProps = {
  disabled: boolean;
  report: any[];
  statusNames: string[];
};

export default function TaskReportExportButton({ disabled, report, statusNames }: TaskReportExportButtonProps) {
  const handleExportCSV = React.useCallback(() => {
    const exportHeaders = [
      "Employee Name",
      "Employee Email",
      "Total Tasks Assigned",
      ...statusNames,
      "Completion Ratio"
    ];
    const dataRows = report.map(row => {
      const statusCounts: Record<string, number|string> = {};
      statusNames.forEach(status => {
        statusCounts[status] = row[status] ?? 0;
      });
      return {
        "Employee Name": row.employeeName,
        "Employee Email": row.employeeEmail,
        "Total Tasks Assigned": row.totalAssigned,
        ...statusCounts,
        "Completion Ratio": row.completionRatio
      };
    });

    const csv = Papa.unparse({ fields: exportHeaders, data: dataRows });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `task_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [report, statusNames]);
  
  return (
    <Button
      type="button"
      variant="outline"
      className="flex items-center gap-2"
      onClick={handleExportCSV}
      disabled={disabled}
    >
      <Download className="w-4 h-4" />
      Export CSV
    </Button>
  );
}
