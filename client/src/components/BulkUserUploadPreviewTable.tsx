
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PreviewRow {
  [key: string]: any;
  _status?: string;
  _message?: string;
}

interface BulkUserUploadPreviewTableProps {
  users: PreviewRow[];
  headers: string[];
}

const statusColor = (status?: string) => {
  if (!status) return "";
  if (status === "valid") return "bg-green-50";
  if (status === "duplicate" || status === "exists") return "bg-yellow-50 text-yellow-900";
  if (status === "invalid") return "bg-red-50 text-red-800";
  return "";
};

const BulkUserUploadPreviewTable: React.FC<BulkUserUploadPreviewTableProps> = ({ users, headers }) => {
  if (!users || users.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded border max-h-80 mb-3">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((row, idx) => (
            <TableRow key={idx} className={statusColor(row._status)}>
              {headers.map((h) => (
                <TableCell key={h}>{row[h] ?? "--"}</TableCell>
              ))}
              <TableCell>
                {row._status === "valid"
                  ? "Valid"
                  : row._status === "duplicate"
                  ? "Duplicate"
                  : row._status === "exists"
                  ? "Already Exists"
                  : row._status === "invalid"
                  ? "Invalid"
                  : "--"}
              </TableCell>
              <TableCell>{row._message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default BulkUserUploadPreviewTable;

