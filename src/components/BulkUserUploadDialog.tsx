import React, { useRef, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { utils, read } from "xlsx";
import { Table, TableHeader, TableRow, TableCell, TableHead, TableBody } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type RowData = {
  "Employee ID": string;
  "Employee Name": string;
  "Department": string;
  "Manager": string;
  "Email": string;
  "Phone": string;
  _rowIndex: number;
  _errors: Record<string, string>;
  _action: "create" | "update" | "ignore";
};

const REQUIRED_COLUMNS = [
  "Employee ID",
  "Employee Name",
  "Department",
  "Manager",
  "Email",
  "Phone",
];

function validateRows(rows: RowData[], existingEmployeeIds: Set<string>, existingEmails: Set<string>): RowData[] {
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  return rows.map((row, idx) => {
    const errors: Record<string, string> = {};
    if (!row["Employee Name"]) errors["Employee Name"] = "Required";
    if (!row["Department"]) errors["Department"] = "Required";
    if (!row["Email"]) errors["Email"] = "Required";
    if (!row["Phone"]) errors["Phone"] = "Required";
    if (row["Employee ID"]) {
      if (seenIds.has(row["Employee ID"])) errors["Employee ID"] = "Duplicate in file";
      if (existingEmployeeIds.has(row["Employee ID"])) errors["Employee ID"] = "Exists in system";
      seenIds.add(row["Employee ID"]);
    }
    if (row["Email"]) {
      if (seenEmails.has(row["Email"].toLowerCase())) errors["Email"] = "Duplicate in file";
      if (existingEmails.has(row["Email"].toLowerCase())) errors["Email"] = "Exists in system";
      seenEmails.add(row["Email"].toLowerCase());
    }
    let action: "create" | "update" | "ignore" = "create";
    if (errors["Employee ID"] === "Exists in system" || errors["Email"] === "Exists in system") {
      action = "ignore";
    }
    return {
      ...row,
      _errors: errors,
      _action: action,
    };
  });
}

const excelCellClass = "border px-2 py-1 text-sm min-w-[120px] text-left " +
  "focus:outline-none focus:ring focus:ring-accent bg-background";

function EditableTable({ rows, setRows }: { rows: RowData[], setRows: (rows: RowData[]) => void }) {
  function handleCellChange(rowIdx: number, field: keyof RowData, value: string) {
    const newRows = [...rows];
    newRows[rowIdx] = { ...newRows[rowIdx], [field]: value };
    setRows(newRows);
  }

  function handleActionChange(rowIdx: number, action: "create" | "update" | "ignore") {
    const newRows = [...rows];
    newRows[rowIdx]._action = action;
    setRows(newRows);
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full">
        <thead>
          <tr>
            {REQUIRED_COLUMNS.map(col => (
              <th key={col} className="border px-2 py-2 bg-muted text-left">{col}</th>
            ))}
            <th className="border px-2 py-2 bg-muted text-left">Action</th>
            <th className="border px-2 py-2 bg-muted text-left">Errors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={Object.values(row._errors).length ? "bg-red-50" : "bg-green-50"}>
              {REQUIRED_COLUMNS.map((col) => (
                <td key={col} className={excelCellClass + (row._errors[col] ? " border-red-400" : "")}>
                  <input
                    type="text"
                    value={row[col] || ""}
                    onChange={e => handleCellChange(i, col as keyof RowData, e.target.value)}
                    className={excelCellClass + (row._errors[col] ? " border-red-400" : "")}
                  />
                </td>
              ))}
              <td className={excelCellClass}>
                {row._errors["Employee ID"] === "Exists in system" || row._errors["Email"] === "Exists in system" ? (
                  <select
                    value={row._action}
                    onChange={e => handleActionChange(i, e.target.value as "update" | "ignore")}
                    className="border px-1 py-1 rounded text-sm"
                  >
                    <option value="update">Update</option>
                    <option value="ignore">Ignore</option>
                  </select>
                ) : (
                  <span className="text-green-600">Create</span>
                )}
              </td>
              <td className={excelCellClass + " max-w-[200px]"}>
                <div className="text-xs text-red-500 space-y-0.5">
                  {Object.entries(row._errors).map(([col, msg]) => <div key={col}>{col}: {msg}</div>)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BulkUserUploadDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock values for now - TODO: Replace with real lookup from database
  const existingEmployeeIds = new Set<string>();
  const existingEmails = new Set<string>();

  function closeDialog() {
    setOpen(false);
    setParsedRows([]);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = utils.sheet_to_json(ws, { header: 0 });
        const headers = Object.keys(json[0] || {});
        if (!REQUIRED_COLUMNS.every(c => headers.includes(c))) {
          toast({ title: "Invalid file structure", description: `File must have columns: ${REQUIRED_COLUMNS.join(", ")}` });
          setLoading(false);
          return;
        }
        let rows: RowData[] = json.map((r, idx) => ({
          ...r,
          _rowIndex: idx + 2, // Excel index for error
          _errors: {},
          _action: "create"
        }));
        rows = validateRows(rows, existingEmployeeIds, existingEmails);
        setParsedRows(rows);
        setLoading(false);
      } catch (err: any) {
        toast({ title: "Failed to parse file", description: err.message || "Could not read Excel" });
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }

  function handleUpdateRows(rows: RowData[]) {
    setParsedRows(validateRows(rows, existingEmployeeIds, existingEmails));
  }

  const hasErrors = parsedRows.some(row => Object.values(row._errors).length > 0);

  function handleConfirm() {
    const creating = parsedRows.filter(r => r._action === "create");
    const updating = parsedRows.filter(r => r._action === "update");
    const ignoring = parsedRows.filter(r => r._action === "ignore");
    toast({
      title: "Data ready for upload",
      description: `${creating.length} new, ${updating.length} update, ${ignoring.length} ignored.`,
    });
    closeDialog();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-2">
          <Upload className="w-4 h-4" /> Bulk Upload Users
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Users via Excel</DialogTitle>
        </DialogHeader>
        <div className="mb-2">
          <Input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleFileChange} disabled={loading} />
        </div>
        {parsedRows.length > 0 && (
          <>
            {/* Add scroll area with max height for the editable table */}
            <ScrollArea className="border rounded max-h-[400px] w-full mb-2">
              <EditableTable rows={parsedRows} setRows={handleUpdateRows} />
            </ScrollArea>
            <div className="text-xs text-muted-foreground mb-1">
              <span className="text-green-600">Green</span>: Valid rows, <span className="text-red-600">Red</span>: Errors. Select "Update" to overwrite existing users, or "Ignore" to skip.
            </div>
            <DialogFooter>
              <Button disabled={hasErrors} onClick={handleConfirm}>
                Confirm and Upload
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkUserUploadDialog;
