import * as XLSX from "xlsx";
import type { AllocationReportUser } from "./allocation-report";

export type AllocationsReportSnapshot = {
  reportDate: string;
  timeZone: string;
  users: AllocationReportUser[];
};

export function createAllocationsWorkbook(report: AllocationsReportSnapshot): Buffer {
  const workbook = XLSX.utils.book_new();
  const summaryRows: (string | number)[][] = [
    ["Allocations Report"],
    ["As of", report.reportDate, "Time zone", report.timeZone],
    [],
    ["User", "Email", "Account status", "Projects", "Active projects", "Total allocation (%)", "Available load (%)"],
    ...report.users.map((user) => [
      user.name,
      user.email,
      user.isActive ? "Active" : "Inactive",
      user.assignments.length,
      user.activeAllocationCount,
      user.totalAllocationPercentage,
      user.availableLoadPercentage,
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 28 },
    { wch: 34 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "User Summary");

  const allocationRows: (string | number)[][] = [
    ["Allocations Report — Project Allocations"],
    ["As of", report.reportDate, "Time zone", report.timeZone],
    [],
    [
      "User",
      "Email",
      "Project",
      "Project code",
      "Start date",
      "End date",
      "Project allocation (%)",
      "Assignment status",
      "Project status",
      "Total allocation (%)",
      "Available load (%)",
    ],
    ...report.users.flatMap((user) => {
      if (user.assignments.length === 0) {
        return [[
          user.name,
          user.email,
          "No project allocations",
          "",
          "",
          "",
          "",
          "",
          "",
          user.totalAllocationPercentage,
          user.availableLoadPercentage,
        ]];
      }
      return user.assignments.map((assignment) => [
        user.name,
        user.email,
        assignment.projectName,
        assignment.projectCode ?? "",
        assignment.startDate ?? "",
        assignment.endDate ?? "",
        assignment.allocationPercentage,
        assignment.allocationState,
        assignment.projectStatus,
        user.totalAllocationPercentage,
        user.availableLoadPercentage,
      ]);
    }),
  ];
  const allocationSheet = XLSX.utils.aoa_to_sheet(allocationRows);
  allocationSheet["!cols"] = [
    { wch: 28 },
    { wch: 34 },
    { wch: 36 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, allocationSheet, "Project Allocations");

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function createAllocationsPdf(report: AllocationsReportSnapshot): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const columns = [
      { label: "User", width: 145 },
      { label: "Project", width: 205 },
      { label: "Start date", width: 72 },
      { label: "End date", width: 72 },
      { label: "Project %", width: 68 },
      { label: "Assignment status", width: 78 },
      { label: "Total %", width: 67 },
      { label: "Available load", width: 62 },
    ];
    const tableWidth = columns.reduce((total, column) => total + column.width, 0);
    const left = 36;
    let y = 36;
    let rowIndex = 0;

    const drawPageHeading = () => {
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a")
        .text("Allocations Report", left, y, { width: tableWidth });
      y += 23;
      doc.font("Helvetica").fontSize(8).fillColor("#475569")
        .text(`As of ${displayDate(report.reportDate)} (${report.timeZone})`, left, y, { width: tableWidth });
      y += 19;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#1e293b");
      doc.save().fillColor("#e2e8f0").rect(left, y, tableWidth, 22).fill().restore();
      let x = left;
      columns.forEach((column) => {
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#1e293b")
          .text(column.label, x + 5, y + 7, { width: column.width - 10, lineBreak: false });
        x += column.width;
      });
      y += 22;
    };

    drawPageHeading();

    const rows = report.users.flatMap((user) => {
      const userSummary = `${user.name}\n${user.email}\nProjects (${user.assignments.length})`;
      if (user.assignments.length === 0) {
        return [[
          userSummary,
          "No project allocations",
          "—",
          "—",
          "—",
          "—",
          `${user.totalAllocationPercentage}%`,
          `${user.availableLoadPercentage}%`,
        ]];
      }
      return user.assignments.map((assignment) => [
        userSummary,
        `${assignment.projectName}${assignment.projectCode ? ` (${assignment.projectCode})` : ""}\n${assignment.projectStatus.replace(/_/g, " ")}`,
        displayDate(assignment.startDate),
        displayDate(assignment.endDate),
        `${assignment.allocationPercentage}%`,
        assignment.allocationState,
        `${user.totalAllocationPercentage}%`,
        `${user.availableLoadPercentage}%`,
      ]);
    });

    for (const values of rows) {
      doc.font("Helvetica").fontSize(7);
      const rowHeight = Math.max(
        24,
        ...values.map((value, index) => doc.heightOfString(String(value), { width: columns[index].width - 10 })),
      ) + 8;

      if (y + rowHeight > doc.page.height - 36) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 36 });
        y = 36;
        drawPageHeading();
      }

      doc.save()
        .fillColor(rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc")
        .rect(left, y, tableWidth, rowHeight)
        .fill()
        .restore();
      let x = left;
      values.forEach((value, index) => {
        doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(7)
          .fillColor("#1e293b")
          .text(String(value), x + 5, y + 4, {
            width: columns[index].width - 10,
            height: rowHeight - 6,
            ellipsis: true,
          });
        x += columns[index].width;
      });
      doc.moveTo(left, y + rowHeight)
        .lineTo(left + tableWidth, y + rowHeight)
        .strokeColor("#e2e8f0")
        .stroke();
      y += rowHeight;
      rowIndex += 1;
    }

    doc.end();
  });
}
