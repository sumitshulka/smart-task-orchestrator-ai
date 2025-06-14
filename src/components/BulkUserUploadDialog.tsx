import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { utils, read } from "xlsx";
import { Table, TableHeader, TableRow, TableCell, TableHead, TableBody } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

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

  // Existing employees cache and email cache
  const [existingEmployeeIds, setExistingEmployeeIds] = useState<Set<string>>(new Set());
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());

  // Reference for mapping employeeId to user uuid (id)
  const [empIdToUserId, setEmpIdToUserId] = useState<Record<string, string>>({});
  // For mapping roles
  const [roleNameToId, setRoleNameToId] = useState<Record<string, string>>({});

  // Fetch needed system data only once dialog is open, so we're not doing extra API calls
  useEffect(() => {
    if (!open) return;
    async function fetchExisting() {
      const { data: users, error } = await supabase.from("users").select("id, email, user_name, department, phone");
      if (users) {
        const empMap: Record<string, string> = {};
        const idSet = new Set<string>(), emailSet = new Set<string>();
        users.forEach(u => {
          // Try to match Employee ID by id (assuming it's "id" in the table)
          if (u.id) {
            empMap[u.id] = u.id;
            idSet.add(u.id);
          }
          if (u.email) emailSet.add(u.email.toLowerCase());
        });
        setEmpIdToUserId(empMap);
        setExistingEmployeeIds(idSet);
        setExistingEmails(emailSet);
      }
      // Fetch roles
      const { data: roles } = await supabase.from("roles").select("id, name");
      if (roles) {
        const rMap: Record<string, string> = {};
        roles.forEach(r => {
          if (r.name) rMap[r.name] = r.id;
        });
        setRoleNameToId(rMap);
      }
    }
    fetchExisting();
  }, [open]);

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
          _rowIndex: idx + 2,
          _errors: {},
          _action: "create"
        }));
        const validatedRows = validateRows(
          rows,
          existingEmployeeIds,
          existingEmails
        );
        setParsedRows(validatedRows);
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

  // --- UTILITY: generate random password for Auth user creation, if not in Excel
  function genRandomPassword(length = 12) {
    // quick and simple
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    return Array.from({ length }).map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function handleConfirm() {
    if (!roleNameToId["manager"] || !roleNameToId["user"]) {
      toast({ title: "Error", description: "Roles not found in system. Please set up 'manager' and 'user' roles in database first." });
      return;
    }
    setLoading(true);

    try {
      // Fetch the currently existing users and keep an up-to-date map
      const { data: allUsers } = await supabase.from("users").select("id, email, user_name, department, phone");
      const emailToId = new Map<string, string>();
      const empIdToUserObj = new Map<string, any>();
      if (allUsers) {
        allUsers.forEach((u: any) => {
          if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
          if (u.id) empIdToUserObj.set(u.id, u);
        });
      }
      // We need to process the parsedRows
      let processed = 0;
      let newUsersInserted = 0;
      let updated = 0;
      let rolesAssigned = 0;

      for (const row of parsedRows) {
        if (row._action === "ignore") continue;

        const emailLower = row["Email"]?.toLowerCase();
        const userFields: any = {
          user_name: row["Employee Name"],
          department: row["Department"],
          phone: row["Phone"],
          email: row["Email"],
          manager: row["Manager"] || null,
          // Optionally organization/created_by can be set here if desired
        };

        let userId: string | undefined = undefined;

        // --- CHECK IF AUTH USER EXISTS ---
        // Try to get by email
        if (emailToId.has(emailLower)) {
          userId = emailToId.get(emailLower);
        } else if (row["Employee ID"] && empIdToUserObj.has(row["Employee ID"])) {
          userId = row["Employee ID"];
        }

        // CREATE NEW AUTH USER if needed
        if (row._action === "create") {
          let newUuid: string | undefined = undefined;
          // If user does not exist, create in Auth first
          if (!userId) {
            // Create Auth user!
            const randomPass = genRandomPassword(16);
            const { data: created, error: authError } = await supabase.auth.admin.createUser({
              email: row["Email"],
              password: randomPass,
              user_metadata: {
                full_name: row["Employee Name"],
                department: row["Department"],
                phone: row["Phone"],
                manager: row["Manager"],
              },
            });

            if (authError || !created?.user?.id) {
              toast({
                title: "Failed to create Auth account",
                description: `Row ${row._rowIndex}: ${authError?.message || "Unknown error"}`,
              });
              continue;
            }
            newUuid = created.user.id;
            userId = newUuid;
            // After creating Auth user, also insert profile row
            const publicUser = {
              id: newUuid,
              email: row["Email"],
              user_name: row["Employee Name"],
              department: row["Department"],
              phone: row["Phone"],
              manager: row["Manager"],
              // organization and created_by can be updated here if needed
            };
            const { error: dbError } = await supabase.from("users").insert([publicUser]);
            if (dbError) {
              toast({
                title: "Failed to store user profile",
                description: `Row ${row._rowIndex}: ${dbError.message}`,
              });
              continue;
            }
            newUsersInserted++;
          } else {
            toast({
              title: "Duplicate detected",
              description: `Employee ${row["Employee Name"]}: already exists, skipping create.`
            });
            continue;
          }
        }

        // UPDATE
        if (row._action === "update" && userId) {
          const { error: updErr } = await supabase.from("users").update(userFields).eq("id", userId);
          if (updErr) {
            toast({ title: "User not updated", description: `Row ${row._rowIndex}: ${updErr.message}` });
            continue;
          }
          updated++;
        }

        // -- ROLES LOGIC --
        // Everyone gets "user" unless they're a manager (see below)
        const roleUserId = roleNameToId["user"];
        const roleManagerId = roleNameToId["manager"];

        // STEP 1: Assign "user" role to all (unless manager)
        if (userId) {
          // Remove existing roles for this user to ensure correctness (or upsert)
          // First, ensure the "user" role
          await supabase
            .from("user_roles")
            .upsert([
              { user_id: userId, role_id: roleUserId }
            ], { onConflict: "user_id,role_id" });
          rolesAssigned++;
        }

        // STEP 2: If this user is referenced as a Manager by another row, assign manager role to them
        // We'll do a double-pass after all users created, but for simple case, whenever a user's Employee ID is listed in someone's "Manager", assign manager role.

        // We'll find all Employee IDs listed as managers in the Excel file
        const managerEmployeeIds = parsedRows
          .map(r => r["Manager"])
          .filter(mid => mid && typeof mid === "string" && mid !== "")
          .filter((mid, i, arr) => arr.indexOf(mid) === i); // unique

        for (const mgrEmpId of managerEmployeeIds) {
          let mgrUserId: string | undefined = undefined;
          // First try to find that manager's DB id
          if (empIdToUserObj.has(mgrEmpId)) {
            mgrUserId = mgrEmpId;
          } else if (
            emailToId.has(parsedRows.find(r => r["Employee ID"] === mgrEmpId)?.Email?.toLowerCase() || "")
          ) {
            mgrUserId = emailToId.get(parsedRows.find(r => r["Employee ID"] === mgrEmpId)?.Email?.toLowerCase() || "");
          }
          if (mgrUserId && roleNameToId["manager"]) {
            // Upsert "manager" role for this user
            await supabase
              .from("user_roles")
              .upsert([
                { user_id: mgrUserId, role_id: roleNameToId["manager"] }
              ], { onConflict: "user_id,role_id" });
            rolesAssigned++;
          }
        }

      }
      toast({
        title: "Successfully uploaded users",
        description: `${newUsersInserted} created, ${updated} updated, ${rolesAssigned} roles assigned.`
      });
      closeDialog();

    } catch (err: any) {
      toast({ title: "Bulk upload failed", description: err?.message || "" });
    } finally {
      setLoading(false);
    }
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
            <ScrollArea className="border rounded max-h-[400px] w-full mb-2">
              <EditableTable rows={parsedRows} setRows={handleUpdateRows} />
            </ScrollArea>
            <div className="text-xs text-muted-foreground mb-1">
              <span className="text-green-600">Green</span>: Valid rows, <span className="text-red-600">Red</span>: Errors. Select "Update" to overwrite existing users, or "Ignore" to skip.
            </div>
            <DialogFooter>
              <Button disabled={hasErrors || loading} onClick={handleConfirm}>
                {loading ? "Uploading..." : "Confirm and Upload"}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={loading}>
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
