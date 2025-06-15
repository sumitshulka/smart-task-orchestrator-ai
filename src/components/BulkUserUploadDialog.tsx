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

  // Fetch all emails in the system when dialog opens
  const [existingEmails, setExistingEmails] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (open) {
      supabase.from("users").select("email").then(({ data, error }) => {
        if (!error && data) setExistingEmails(data.map(u => (u.email || "").toLowerCase()));
      });
    }
  }, [open]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const parseFile = async (file: File): Promise<any[]> => {
    const fileType = file.name.split(".").pop()?.toLowerCase();
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
              });
              reject("CSV parsing error");
              return;
            }
            parsedData = result.data as any[];
          } else if (fileType === "xlsx") {
            const workbook = XLSX.read(data, { type: "buffer" });
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
          });
          reject(error);
        }
      };

      reader.onerror = () => {
        toast({
          title: "File Reading Error",
          description: "There was an error reading the file.",
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

  // Add validation before uploading
  async function handleFile(file: File) {
    let parsedRows: any[] = [];
    try {
      parsedRows = await parseFile(file);
    } catch (e) {
      return; // error already handled in parseFile
    }

    // Email uniqueness check (within upload)
    const seen = new Set();
    const duplicateEmailsSelf: string[] = [];
    parsedRows.forEach(row => {
      const email = row.email && row.email.toLowerCase && row.email.toLowerCase();
      if (!email) return;
      if (seen.has(email)) {
        duplicateEmailsSelf.push(email);
      } else {
        seen.add(email);
      }
    });

    // Email uniqueness check (against system)
    const duplicateEmailsSystem: string[] = [];
    parsedRows.forEach(row => {
      const email = row.email && row.email.toLowerCase && row.email.toLowerCase();
      if (!email) return;
      if (existingEmails.includes(email)) {
        duplicateEmailsSystem.push(email);
      }
    });

    if (duplicateEmailsSelf.length > 0 || duplicateEmailsSystem.length > 0) {
      setErrorRows([...new Set([...duplicateEmailsSelf, ...duplicateEmailsSystem])]);
      toast({
        title: "Duplicate Emails Detected",
        description:
          (duplicateEmailsSelf.length > 0
            ? `The following emails are duplicated in your file: ${duplicateEmailsSelf.join(", ")}. `
            : "") +
          (duplicateEmailsSystem.length > 0
            ? `These emails already exist in the system: ${duplicateEmailsSystem.join(", ")}. `
            : "")
      });
      resetFileInput();
      return;
    }

    setErrorRows([]);

    setUploading(true);
    try {
      const response = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users: parsedRows }),
      });

      const data = await response.json();
      if (data.error) {
        toast({
          title: "Bulk upload failed",
          description: data.error,
        });
      } else {
        toast({
          title: "Bulk upload successful",
          description: "Users added successfully.",
        });
        onUsersUploaded?.();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Bulk upload failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setUploading(false);
      resetFileInput();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk User Upload</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file to add multiple users at once.
          </DialogDescription>
        </DialogHeader>
        {/* Download sample file button restored */}
        <div className="mb-2 flex justify-end">
          <DownloadSampleExcel />
        </div>
        <div className="grid gap-4 py-4">
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
        {errorRows.length > 0 && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded my-2 text-sm">
            Duplicate emails: {errorRows.join(", ")}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUserUploadDialog;
