
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Info, Check, CircleX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

const statusDisplay = (status?: string) => {
  switch (status) {
    case "valid":
      return (
        <span className="flex items-center gap-1 text-green-700">
          <Check size={16} className="text-green-600" />
          Valid
        </span>
      );
    case "duplicate":
      return (
        <span className="flex items-center gap-1 text-yellow-700">
          <Info size={16} className="text-yellow-500" />
          Duplicate
        </span>
      );
    case "exists":
      return (
        <span className="flex items-center gap-1 text-yellow-700">
          <Info size={16} className="text-yellow-500" />
          Already Exists
        </span>
      );
    case "invalid":
      return (
        <span className="flex items-center gap-1 text-red-700">
          <CircleX size={16} className="text-red-600" />
          Invalid
        </span>
      );
    default:
      return "--";
  }
};

export const BulkUserUploadPreviewEditableTable: React.FC<BulkUserUploadPreviewEditableTableProps> = ({
  users,
  headers,
  onUpdateRow,
}) => {
  if (!users || users.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto max-h-96 border rounded-lg shadow-sm relative">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/80 sticky top-0 z-10">
              {headers.map((h) => (
                <TableHead
                  key={h}
                  className={cn(
                    "py-3 px-4 font-semibold border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/80",
                    "whitespace-nowrap"
                  )}
                >
                  {h}
                </TableHead>
              ))}
              <TableHead className="py-3 px-4 border-b border-border text-xs uppercase tracking-wider bg-muted/80">
                Status
              </TableHead>
              <TableHead className="py-3 px-4 border-b border-border text-xs uppercase tracking-wider bg-muted/80">
                Message
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((row, idx) => {
              const status = row._status;
              const rowClass = cn(
                idx % 2 === 0 ? "bg-background" : "bg-muted/40",
                "transition-colors",
                status === "invalid"
                  ? "outline outline-2 outline-red-300"
                  : status === "duplicate" || status === "exists"
                  ? "outline outline-2 outline-yellow-200"
                  : status === "valid"
                  ? "outline outline-1 outline-green-200"
                  : ""
              );
              return (
                <TableRow
                  key={idx}
                  className={cn(rowClass, "hover:bg-accent group")}
                >
                  {headers.map((h) => {
                    const error =
                      row._status === "invalid" &&
                      (!row[h] || row[h] === "");
                    return (
                      <TableCell
                        key={h}
                        className={cn(
                          "px-4 py-2 align-middle border-b border-border relative",
                          "min-w-[140px] max-w-[180px]",
                          error
                            ? "bg-red-50"
                            : "",
                          "focus-within:outline focus-within:outline-2 focus-within:outline-primary"
                        )}
                      >
                        {(h === "email" ||
                          h.toLowerCase().includes("name") ||
                          h === "department") ? (
                          <Input
                            className={cn(
                              "rounded-md bg-white transition border",
                              error
                                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                                : "focus:border-primary focus:ring-primary"
                            )}
                            size={8}
                            value={row[h] ?? ""}
                            onChange={(e) => {
                              onUpdateRow(idx, { ...row, [h]: e.target.value });
                            }}
                            placeholder={`Enter ${h}`}
                            aria-invalid={!!error}
                            aria-label={h}
                          />
                        ) : (
                          <span className="text-foreground">
                            {row[h] ?? <span className="text-muted-foreground">--</span>}
                          </span>
                        )}
                        {/* Error/info tooltip inline */}
                        {!!row._message && h === headers[0] && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Info size={16} className={status === 'invalid' ? "text-red-500" : "text-yellow-500"} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                {row._message}
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  {/* Status cell */}
                  <TableCell className="px-4 py-2 align-middle border-b border-border whitespace-nowrap">
                    {statusDisplay(row._status)}
                  </TableCell>
                  {/* Message cell: icon + tooltip for errors */}
                  <TableCell className="px-4 py-2 align-middle border-b border-border">
                    {!!row._message ? (
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Info size={16} className={row._status === "invalid" ? "text-red-500" : "text-yellow-500"} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {row._message}
                          </TooltipContent>
                        </Tooltip>
                        <span className={row._status === "invalid" ? "text-red-600" : "text-yellow-700"}>
                          {row._message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default BulkUserUploadPreviewEditableTable;

