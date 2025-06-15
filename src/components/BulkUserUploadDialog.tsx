import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import DownloadSampleExcel from "@/components/DownloadSampleExcel";
import BulkUserUploadPreviewEditableTable from "@/components/BulkUserUploadPreviewEditableTable";

interface BulkUserUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUsersUploaded?: () => void;
}

const BulkUserUploadDialog = (props: BulkUserUploadDialogProps) => {
  const { open, onOpenChange, onUsersUploaded } = props;
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errorRows, setErrorRows] = React.useState<string[]>([]);
  const [parsedUsers, setParsedUsers] = React.useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = React.useState<string[]>([]);
  const [readyToUpload, setReadyToUpload] = React.useState(false);

  // Fetch all emails in the system when dialog opens
  const [existingEmails, setExistingEmails] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (open) {
      supabase.from("users").select("email").then(({ data, error }) => {
        if (!error && data) setExistingEmails(data.map(u => (u.email || "").toLowerCase()));
      });
    }
  }, [open]);

  // Utility for validating a single row (extract this for reuse)
  function validateRow(row: any, existingEmails: string[], seen: Set<string>) {
    let status = "valid";
    let msg = "";
    const email = row.email && row.email.toLowerCase();
    const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
    if (!email) {
      status = "invalid";
      msg = "Missing email";
    } else if (!emailRegex.test(email)) {
      status = "invalid";
      msg = "Invalid email format";
    } else if (existingEmails.includes(email)) {
      status = "exists";
      msg = "Already exists in system";
    } else if (seen.has(email)) {
      status = "duplicate";
      msg = "Duplicate in file";
    }
    return { ...row, _status: status, _message: msg };
  }

  // Add the missing resetFileInput function
  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Update a row and revalidate it, then update setParsedUsers/reactive state
  const handleUpdateRow = (idx: number, newRow: any) => {
    const seen = new Set<string>();
    const lowerExisting = existingEmails.map(e => e.toLowerCase());
    const updated = parsedUsers.map((row, i) => {
      if (i === idx) {
        const validated = validateRow(newRow, lowerExisting, seen);
        if (validated.email) seen.add(validated.email.toLowerCase());
        return validated;
      }
      if (row.email) seen.add(row.email.toLowerCase());
      return validateRow(row, lowerExisting, seen);
    });
    setParsedUsers(updated);
    setReadyToUpload(updated.some(r => r._status === "valid"));
  };

  // FILE PARSE LOGIC PATCHED (ESP. XLSX)
  const parseFile = async (file: File): Promise<any[]> => {
    const fileType = file.name.split(".").pop()?.toLowerCase();
    toast({
      title: "Parsing file",
      description: `Reading your ${fileType?.toUpperCase()} file and validating format...`,
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = e.target.result;
        let parsedData: any[] = [];
        try {
          if (fileType === "csv") {
            const result = Papa.parse(data, { header: true, skipEmptyLines: true });
            if (result.errors.length > 0) {
              toast({
                title: "CSV Parsing Error",
                description: "There was an error parsing the CSV file. Please check the format.",
                variant: "destructive",
              });
              reject("CSV parsing error");
              return;
            }
            parsedData = result.data as any[];
          } else if (fileType === "xlsx") {
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // If the first row is headers, use them as keys
            if (parsedData.length > 0) {
              const headers = parsedData[0] as string[];
              parsedData = (parsedData as any[]).slice(1).map((row: any[]) => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  obj[header] = row[index];
                });
                return obj;
              });
            }
          } else {
            toast({
              title: "Unsupported File Type",
              description: "Only CSV and XLSX files are supported.",
              variant: "destructive",
            });
            reject("Unsupported file type");
            return;
          }
          resolve(parsedData);
        } catch (error) {
          console.error("File Parsing Error:", error);
          toast({
            title: "File Parsing Error",
            description: "There was an error parsing the file. Please check the format.",
            variant: "destructive",
          });
          reject(error);
        }
      };

      reader.onerror = () => {
        toast({
          title: "File Reading Error",
          description: "There was an error reading the file.",
          variant: "destructive",
        });
        reject("File reading error");
      };

      if (fileType === "xlsx") {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // Replace this with your actual Supabase project ref:
  const SUPABASE_FUNCTION_URL = "https://hzfwmftpyxjtdohxhcgb.functions.supabase.co/admin-bulk-upload";

  // Add validation before uploading
  async function handleFile(file: File) {
    setParsedUsers([]);
    setPreviewHeaders([]);
    setErrorRows([]);
    setReadyToUpload(false);

    let parsedRows: any[] = [];
    try {
      parsedRows = await parseFile(file);
      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        toast({ title: "No data", description: "The file appears empty." });
        resetFileInput();
        return;
      }
      const headers = Object.keys(parsedRows[0]);
      setPreviewHeaders(headers);
    } catch (e) {
      return;
    }

    const seen = new Set<string>();
    const lowerExisting = existingEmails.map(e => e.toLowerCase());
    const previewRows = parsedRows.map((row) => {
      const validated = validateRow(row, lowerExisting, seen);
      if (validated.email) seen.add(validated.email.toLowerCase());
      return validated;
    });

    setParsedUsers(previewRows);
    setReadyToUpload(previewRows.some(r => r._status === "valid"));
    toast({
      title: "File loaded",
      description: `Loaded ${previewRows.length} record${previewRows.length !== 1 ? "s" : ""}.`,
    });
  }

  // Only upload after user confirms
  const tryUpload = async () => {
    setUploading(true);
    const toUpload = parsedUsers.filter(row => row._status === "valid");
    if (toUpload.length === 0) {
      toast({ title: "Nothing to upload", description: "Fix errors before uploading.", variant: "destructive" });
      setUploading(false);
      return;
    }

    toast({
      title: "Uploading users",
      description: `Uploading ${toUpload.length} user${toUpload.length !== 1 ? "s" : ""} to the server...`,
    });

    try {
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users: toUpload }),
      });

      let serverResp: any = {};
      try {
        serverResp = await response.json();
      } catch (_) {
        serverResp = {};
      }

      let errorDescription: string | undefined;
      if (!response.ok) {
        errorDescription = serverResp?.error || `Upload failed with status ${response.status}`;
        if (response.status === 401) {
          errorDescription = "Unauthorized (status 401). Please check your Supabase function deployment and Service Role Key.";
        }
        toast({
          title: "Bulk upload failed",
          description: `Status ${response.status}: ${errorDescription}`,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      toast({
        title:
          serverResp.status === "partial"
            ? "Bulk upload partially successful"
            : "Bulk upload successful",
        description:
          serverResp.message ||
          `Successfully added ${serverResp.inserted} user${serverResp.inserted !== 1 ? "s" : ""}.` +
            (serverResp.skipped && serverResp.skipped > 0
              ? ` Skipped ${serverResp.skipped} duplicate${serverResp.skipped !== 1 ? "s" : ""}.`
              : ""),
      });
      setParsedUsers([]);
      setReadyToUpload(false);
      setPreviewHeaders([]);
      onUsersUploaded?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Bulk upload failed",
        description: error?.message ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      resetFileInput();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Bulk User Upload</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file to add multiple users. You can review and edit before uploading.
          </DialogDescription>
        </DialogHeader>
        {/* Download sample file button restored */}
        <div className="mb-2 flex justify-end">
          <DownloadSampleExcel />
        </div>
        <div className="grid gap-2 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="file" className="text-right">
              File
            </Label>
            <Input
              type="file"
              id="file"
              className="col-span-3"
              accept=".csv, .xlsx"
              disabled={uploading}
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>
        {parsedUsers && parsedUsers.length > 0 && (
          <div>
            <p className="text-sm mb-1">
              Review, fix errors, and confirm records for upload (only <span className="font-bold">"Valid"</span> records will be uploaded):
            </p>
            <BulkUserUploadPreviewEditableTable
              users={parsedUsers}
              headers={previewHeaders}
              onUpdateRow={handleUpdateRow}
            />
          </div>
        )}
        {errorRows.length > 0 && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded my-2 text-sm">
            Duplicate emails: {errorRows.join(", ")}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={uploading || !readyToUpload}
            onClick={tryUpload}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUserUploadDialog;
