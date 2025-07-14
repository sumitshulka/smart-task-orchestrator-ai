
import React from "react";
import { Button } from "@/components/ui/button";
import { utils, writeFile } from "xlsx";
import { Download } from "lucide-react";

const SAMPLE_ROWS = [
  {
    "Employee ID": "250600001",
    "Employee Name": "Alice Kumar",
    "Department": "Engineering",
    "Manager": "",
    "Email": "alice@org.com",
    "Phone": "7001123456",
  },
  {
    "Employee ID": "",
    "Employee Name": "Bob Gupta",
    "Department": "Marketing",
    "Manager": "250600001",
    "Email": "bob@org.com",
    "Phone": "7001987654",
  },
  {
    "Employee ID": "",
    "Employee Name": "Carol Sinha",
    "Department": "HR",
    "Manager": "",
    "Email": "carol@org.com",
    "Phone": "7001234567",
  }
];

export default function DownloadSampleExcel() {
  const handleDownload = () => {
    const ws = utils.json_to_sheet(SAMPLE_ROWS, { header: [
      "Employee ID",
      "Employee Name",
      "Department",
      "Manager",
      "Email",
      "Phone"
    ]});
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "SampleUsers");
    writeFile(wb, "BulkUserSample.xlsx");
  };

  return (
    <Button variant="outline" onClick={handleDownload} className="flex items-center gap-2">
      <Download className="w-4 h-4" />
      Download Sample File
    </Button>
  );
}
