
import React from "react";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";

type TaskOverdueTableProps = {
  reportingColumns: string[];
  report: any[];
  isLoading: boolean;
};

export default function TaskOverdueTable({
  reportingColumns, report, isLoading
}: TaskOverdueTableProps) {
  return (
    <div className="rounded border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {reportingColumns.map(col => (
              <TableHead
                key={col}
                className="bg-gray-100 font-bold text-black"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={reportingColumns.length}>Loading...</TableCell>
            </TableRow>
          ) : report.length === 0 ? (
            <TableRow>
              <TableCell colSpan={reportingColumns.length}>No overdue tasks found.</TableCell>
            </TableRow>
          ) : (
            report.map((row: any) => (
              <TableRow key={row.systemId}>
                <TableCell>
                  <span>{row.employeeName}</span>
                  <span className="text-muted-foreground text-xs block">
                    {row.employeeEmail}
                  </span>
                </TableCell>
                <TableCell className="text-center">{row["0-15"]}</TableCell>
                <TableCell className="text-center">{row["15-30"]}</TableCell>
                <TableCell className="text-center">{row["30-45"]}</TableCell>
                <TableCell className="text-center">{row["45-60"]}</TableCell>
                <TableCell className="text-center">{row[">60"]}</TableCell>
                <TableCell className="text-center font-semibold">{row.totalOverdue}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
