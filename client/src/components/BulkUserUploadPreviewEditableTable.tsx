
import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Info, Check, CircleX } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

function StatusCell({ status }: { status?: string }) {
  if (!status) return <span>--</span>;
  switch (status) {
    case "valid":
      return (
        <span className="flex items-center gap-1 text-green-600">
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
      return <span>--</span>;
  }
}

/** Editable fields are only string columns not beginning with _ */
const isEditable = (header: string) => !header.startsWith("_");

const BulkUserUploadPreviewEditableTable: React.FC<BulkUserUploadPreviewEditableTableProps> = ({
  users, headers, onUpdateRow,
}) => {
  if (!users || users.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="w-full overflow-x-auto max-h-[370px] overflow-y-auto border rounded-lg bg-white ring-1 ring-border/40">
        <Table className="min-w-[700px] w-max border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/80 sticky top-0 z-20">
              {headers.map((h) => (
                <TableHead
                  key={h}
                  className="py-2 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground bg-muted/80 sticky top-0 whitespace-nowrap min-w-[120px] max-w-[240px]"
                  style={{ background: "inherit" }}
                >
                  {h.replace(/_/g, " ")}
                </TableHead>
              ))}
              <TableHead className="py-2 px-4 text-xs uppercase bg-muted/80 sticky top-0 min-w-[90px]">Status</TableHead>
              <TableHead className="py-2 px-4 text-xs uppercase bg-muted/80 sticky top-0 min-w-[140px]">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((row, rowIdx) => (
              <TableRow
                key={rowIdx}
                className={cn(
                  row._status === "invalid" ? "bg-red-50 ring-1 ring-red-200" : rowIdx % 2 === 0 ? "bg-background" : "bg-muted/30",
                  "transition-colors"
                )}
              >
                {headers.map((h, cellIdx) => {
                  const cellError = row._status === "invalid" && (!row[h] && isEditable(h));
                  return (
                    <TableCell
                      key={h}
                      className={cn(
                        "px-4 py-1 border-b border-border whitespace-nowrap align-middle",
                        cellError ? "bg-red-50 border-red-300" : "bg-white"
                      )}
                    >
                      {isEditable(h) ? (
                        <Input
                          className={cn(
                            "bg-white rounded border w-full min-w-[120px] max-w-[220px]",
                            cellError ? "border-red-500" : "focus:border-primary"
                          )}
                          value={row[h] ?? ""}
                          aria-label={h}
                          aria-invalid={!!cellError}
                          onChange={e => {
                            onUpdateRow(rowIdx, { ...row, [h]: e.target.value });
                          }}
                          placeholder={h}
                        />
                      ) : (
                        <span className="truncate block">{row[h] ?? <span className="text-muted-foreground">--</span>}</span>
                      )}
                      {cellError && cellIdx === 0 && !!row._message && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Info size={16} className="text-red-500" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs font-normal">
                              {row._message}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="px-4 py-1 border-b border-border align-middle">
                  <StatusCell status={row._status} />
                </TableCell>
                <TableCell className="px-4 py-1 border-b border-border align-middle min-w-[140px]">
                  {!!row._message ? (
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Info
                              size={16}
                              className={row._status === "invalid" ? "text-red-500" : "text-yellow-500"}
                            />
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
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default BulkUserUploadPreviewEditableTable;
