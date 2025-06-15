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

  // Controls to add subtle shadow on the table head when scrolling vertically
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const onScroll = () => setScrolled(wrapper.scrollTop > 0);
    wrapper.addEventListener("scroll", onScroll);
    return () => wrapper.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={tableWrapperRef}
        className={cn(
          // Container: always fits the parent modal, never overflows
          "relative border rounded-xl shadow-inner bg-white",
          "w-full max-w-full",         // never exceeds modal
          "max-h-[360px]",             // vertical scroll cap
          "overflow-x-auto overflow-y-auto", // <--- core fix!
          "mt-2 mb-2",
          "ring-1 ring-border/40"
        )}
        style={{
          minWidth: 0,                  // allow child to shrink if needed
          maxWidth: "100%",             // restrict width to parent/modal
        }}
        tabIndex={-1}
      >
        <Table className="w-full border-collapse table-fixed">
          <TableHeader>
            <TableRow
              className={cn(
                "bg-muted/80 sticky top-0 z-10",
                scrolled ? "shadow-md shadow-muted/30" : ""
              )}
            >
              {headers.map((h) => (
                <TableHead
                  key={h}
                  className={cn(
                    "py-3 px-4 font-semibold border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/80",
                    "whitespace-nowrap"
                  )}
                  style={{ background: "inherit" }}
                >
                  {h.replace(/_/g, " ")}
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
              const rowIsInvalid = status === "invalid";
              // For row-level error highlighting
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
                <TableRow
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
                      <TableCell
                        key={h}
                        className={cn(
                          "px-4 py-2 align-middle border-b border-border relative",
                          // ↓↓↓ Remove min-w, max-w that cause overflow, let cell fit content!
                          "truncate",
                          "transition-all",
                          cellWithError
                            ? "bg-red-50 border-red-300"
                            : "bg-white border-border",
                          "focus-within:outline focus-within:outline-2 focus-within:outline-primary"
                        )}
                        style={{
                          minWidth: 0,
                          maxWidth: 240, // Let columns shrink but not overflow
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {(h === "email" ||
                          h.toLowerCase().includes("name") ||
                          h === "department") ? (
                          <Input
                            className={cn(
                              "rounded-md bg-white transition border",
                              cellWithError
                                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                                : "focus:border-primary focus:ring-primary"
                            )}
                            size={8}
                            value={row[h] ?? ""}
                            onChange={(e) => {
                              onUpdateRow(idx, { ...row, [h]: e.target.value });
                            }}
                            placeholder={`Enter ${h}`}
                            aria-invalid={!!cellWithError}
                            aria-label={h}
                            style={{ minWidth: 0, maxWidth: 210 }}
                          />
                        ) : (
                          <span className="truncate block overflow-hidden text-foreground">
                            {row[h] ?? (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </span>
                        )}
                        {/* Error/info icon inline (left of input) */}
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
                      </TableCell>
                    );
                  })}
                  {/* Status cell */}
                  <TableCell
                    className="px-4 py-2 align-middle border-b border-border whitespace-nowrap"
                  >
                    {statusDisplay(row._status)}
                  </TableCell>
                  {/* Message cell: icon + tooltip for errors */}
                  <TableCell className="px-4 py-2 align-middle border-b border-border">
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
