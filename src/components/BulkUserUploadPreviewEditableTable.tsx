
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PreviewRow {
  [key: string]: any;
  _status?: string;
  _message?: string;
}

interface BulkUserUploadPreviewEditableTableProps {
  users: PreviewRow[];
  headers: string[];
  onUpdateRow: (idx: number, newRow: PreviewRow) => void;
}

const statusColor = (status?: string) => {
  if (!status) return "";
  if (status === "valid") return "bg-green-50";
  if (status === "duplicate" || status === "exists") return "bg-yellow-50 text-yellow-900";
  if (status === "invalid") return "bg-red-50 text-red-800";
  return "";
};

const BulkUserUploadPreviewEditableTable: React.FC<BulkUserUploadPreviewEditableTableProps> = ({
  users,
  headers,
  onUpdateRow,
}) => {
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
                <TableCell key={h}>
                  {/* Only allow editing for specific fields */}
                  {h === "email" || h.toLowerCase().includes("name") || h === "department" ? (
                    <Input
                      className={row._status === "invalid" && (!row[h] || row[h] === "") ? "border-destructive" : ""}
                      size={8}
                      value={row[h] ?? ""}
                      onChange={e => {
                        onUpdateRow(idx, { ...row, [h]: e.target.value });
                      }}
                      placeholder={`Enter ${h}`}
                    />
                  ) : (
                    row[h] ?? "--"
                  )}
                </TableCell>
              ))}
              <TableCell className="whitespace-nowrap">
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

export default BulkUserUploadPreviewEditableTable;
