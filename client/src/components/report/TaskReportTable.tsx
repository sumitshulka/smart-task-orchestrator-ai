
import React from "react";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";

type TaskReportTableProps = {
  reportingColumns: string[];
  statusNames: string[];
  report: any[];
  isLoading: boolean;
  statusesLoading: boolean;
};

export default function TaskReportTable({
  reportingColumns, statusNames, report, isLoading, statusesLoading
}: TaskReportTableProps) {
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
          {isLoading || statusesLoading ? (
            <TableRow>
              <TableCell colSpan={reportingColumns.length}>Loading...</TableCell>
            </TableRow>
          ) : report.length === 0 ? (
            <TableRow>
              <TableCell colSpan={reportingColumns.length}>No data found.</TableCell>
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
  );
}
