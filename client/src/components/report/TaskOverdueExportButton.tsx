
import React from "react";
import Papa from "papaparse";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaskOverdueExportButtonProps = {
  disabled: boolean;
  report: any[];
};

export default function TaskOverdueExportButton({ disabled, report }: TaskOverdueExportButtonProps) {
  const handleExportCSV = React.useCallback(() => {
    const exportHeaders = [
      "Employee Name",
      "Employee Email",
      "0-15 Days",
      "15-30 Days", 
      "30-45 Days",
      "45-60 Days",
      ">60 Days",
      "Total Overdue"
    ];
    
    const dataRows = report.map(row => ({
      "Employee Name": row.employeeName,
      "Employee Email": row.employeeEmail,
      "0-15 Days": row["0-15"],
      "15-30 Days": row["15-30"],
      "30-45 Days": row["30-45"],
      "45-60 Days": row["45-60"],
      ">60 Days": row[">60"],
      "Total Overdue": row.totalOverdue
    }));

    const csv = Papa.unparse({ fields: exportHeaders, data: dataRows });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `task_overdue_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [report]);
  
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
