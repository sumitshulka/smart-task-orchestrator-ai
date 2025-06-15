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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  // Refined scroll approach: 
  // We want the scroll *inside* the modal boundaries.
  // So we enforce the outer container to fit modal, and table min-width for content.
  return (
    <TooltipProvider delayDuration={150}>
      {/* RESPONSIVE SCROLLABLE CONTAINER */}
      <div
        className="
          w-full 
          max-w-full
          overflow-x-auto          /* <-- outer horizontal scroll if needed */
          overflow-y-auto
          border rounded-xl shadow-inner bg-white ring-1 ring-border/40
          mt-2 mb-2
        "
        style={{
          // Make sure we never overflow modal (650px = dialog default)
          maxHeight: 360,
          // if modal max-w is 650px, we keep slightly less, let dialog padding provide rest
          maxWidth: '100%',
          minWidth: 0,
        }}
        tabIndex={-1}
      >
        <table
          className="
            border-collapse 
            min-w-[900px]           /* Table itself has minimum width for full columns */
            w-full                  /* Table will always fill container horizontally */
            bg-white
          "
        >
          <thead>
            <tr className="bg-muted/80 sticky top-0 z-10">
              {headers.map((h) => (
                <th
                  key={h}
                  className="py-3 px-4 font-semibold border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/80 whitespace-nowrap"
                  style={{ background: "inherit" }}
                >
                  {h.replace(/_/g, " ")}
                </th>
              ))}
              <th className="py-3 px-4 border-b border-border text-xs uppercase tracking-wider bg-muted/80 whitespace-nowrap">
                Status
              </th>
              <th className="py-3 px-4 border-b border-border text-xs uppercase tracking-wider bg-muted/80 whitespace-nowrap">
                Message
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((row, idx) => {
              const status = row._status;
              const rowIsInvalid = status === "invalid";
              const rowClass = cn(
                idx % 2 === 0
                  ? "bg-background"
                  : "bg-muted/40",
                rowIsInvalid
                  ? "bg-red-50/80 ring-1 ring-red-200"
                  : "",
                "transition-colors",
                "group"
              );
              return (
                <tr
                  key={idx}
                  className={cn(rowClass, "hover:bg-accent")}
                >
                  {headers.map((h, cellIdx) => {
                    const error =
                      row._status === "invalid" &&
                      (!row[h] || row[h] === "");
                    const cellWithError =
                      error || (row._status === "invalid" && row._message && cellIdx === 0);
                    return (
                      <td
                        key={h}
                        className={cn(
                          "px-4 py-2 align-middle border-b border-border relative whitespace-nowrap",
                          "transition-all",
                          cellWithError
                            ? "bg-red-50 border-red-300"
                            : "bg-white border-border",
                          "focus-within:outline focus-within:outline-2 focus-within:outline-primary"
                        )}
                        // Let the content drive width. No forced col widths.
                      >
                        {(h === "email" ||
                          h.toLowerCase().includes("name") ||
                          h === "department") ? (
                          <Input
                            className={cn(
                              "rounded-md bg-white transition border",
                              cellWithError
                                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                                : "focus:border-primary focus:ring-primary",
                              "w-full min-w-[140px] max-w-[220px]"
                            )}
                            value={row[h] ?? ""}
                            onChange={(e) => {
                              onUpdateRow(idx, { ...row, [h]: e.target.value });
                            }}
                            placeholder={`Enter ${h}`}
                            aria-invalid={!!cellWithError}
                            aria-label={h}
                          />
                        ) : (
                          <span className="truncate block overflow-hidden text-foreground">
                            {row[h] ?? (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </span>
                        )}
                        {cellWithError && cellIdx === 0 && !!row._message && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Info
                                    size={16}
                                    className="text-red-500"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs font-normal"
                              >
                                {row._message}
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 align-middle border-b border-border whitespace-nowrap">
                    {statusDisplay(row._status)}
                  </td>
                  <td className="px-4 py-2 align-middle border-b border-border whitespace-nowrap">
                    {!!row._message ? (
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Info
                                size={16}
                                className={row._status === "invalid"
                                  ? "text-red-500"
                                  : "text-yellow-500"}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {row._message}
                          </TooltipContent>
                        </Tooltip>
                        <span
                          className={
                            row._status === "invalid"
                              ? "text-red-600"
                              : "text-yellow-700"
                          }
                        >
                          {row._message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
};

export default BulkUserUploadPreviewEditableTable;

// File length warning: This file is quite long (~250+ lines). After verifying your scrollable table works, consider asking to refactor this file into smaller components for easier maintenance.
