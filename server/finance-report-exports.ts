export type FinanceProfitabilityExport = {
  projectName: string;
  rangeLabel: string;
  currency: string;
  months: string[];
  revenue: number[];
  revenueTotal: number;
  expenses: Array<{ label: string; amounts: number[]; total: number }>;
  includeSalary: boolean;
  salaryAmounts: number[];
  expenseTotals: number[];
  expenseTotal: number;
  profitability: number[];
  profitabilityTotal: number;
  revenueDetails: Array<{ date: string; milestone: string; description: string; amount: number; status: string }>;
};

export async function createFinanceProfitabilityPdf(report: FinanceProfitabilityExport): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageMonths = 6;
    const pages = Math.max(1, Math.ceil(report.months.length / pageMonths));
    for (let page = 0; page < pages; page++) {
      if (page > 0) doc.addPage();
      const offset = page * pageMonths;
      const months = report.months.slice(offset, offset + pageMonths);
      const left = 30;
      const width = 782;
      const labelWidth = 170;
      const totalWidth = 86;
      const periodWidth = months.length ? (width - labelWidth - totalWidth) / months.length : 0;
      let y = 30;
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Project Profitability Report", left, y);
      y += 23;
      doc.font("Helvetica").fontSize(9).fillColor("#475569")
        .text(`${report.projectName} · ${report.rangeLabel} · ${report.currency}`, left, y, { width });
      y += 22;
      if (pages > 1) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#475569")
          .text(`Period columns ${offset + 1}–${offset + months.length} of ${report.months.length}`, left, y);
        y += 16;
      }

      const drawSection = (title: string, rows: Array<{ label: string; values: number[]; total: number }>) => {
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(title, left, y);
        y += 17;
        const header = ["Line item", ...months, pages > 1 ? "Page total" : "Period total"];
        const widths = [labelWidth, ...months.map(() => periodWidth), totalWidth];
        let x = left;
        header.forEach((cell, index) => {
          doc.save().fillColor("#e2e8f0").rect(x, y, widths[index], 22).fill().restore();
          doc.font("Helvetica-Bold").fontSize(7).fillColor("#1e293b")
            .text(cell, x + 4, y + 6, { width: widths[index] - 8, align: index === 0 ? "left" : "right", ellipsis: true });
          x += widths[index];
        });
        y += 22;
        rows.forEach((row, rowIndex) => {
          if (rowIndex % 2 === 1) doc.save().fillColor("#f8fafc").rect(left, y, width, 21).fill().restore();
          const cells = [row.label, ...row.values.map((value) => value.toFixed(2)), row.total.toFixed(2)];
          x = left;
          cells.forEach((cell, index) => {
            doc.font(index === 0 ? "Helvetica" : "Helvetica").fontSize(7).fillColor("#0f172a")
              .text(cell, x + 4, y + 6, { width: widths[index] - 8, align: index === 0 ? "left" : "right", ellipsis: true });
            x += widths[index];
          });
          y += 21;
        });
        y += 10;
      };

      drawSection("Revenue", [
        { label: "Recognized revenue", values: months.map((_, i) => report.revenue[offset + i] ?? 0), total: months.reduce((sum, _, i) => sum + (report.revenue[offset + i] ?? 0), 0) },
      ]);
      const expenseRows = report.expenses.map((row) => ({
        label: row.label,
        values: months.map((_, i) => row.amounts[offset + i] ?? 0),
        total: months.reduce((sum, _, i) => sum + (row.amounts[offset + i] ?? 0), 0),
      }));
      if (report.includeSalary) expenseRows.push({
        label: "Resource salary",
        values: months.map((_, i) => report.salaryAmounts[offset + i] ?? 0),
        total: months.reduce((sum, _, i) => sum + (report.salaryAmounts[offset + i] ?? 0), 0),
      });
      drawSection("Expenses", expenseRows);
      drawSection("Project profitability", [
        { label: "Total revenue", values: months.map((_, i) => report.revenue[offset + i] ?? 0), total: months.reduce((sum, _, i) => sum + (report.revenue[offset + i] ?? 0), 0) },
        { label: "Total expenses", values: months.map((_, i) => report.expenseTotals[offset + i] ?? 0), total: months.reduce((sum, _, i) => sum + (report.expenseTotals[offset + i] ?? 0), 0) },
        { label: "Net profitability", values: months.map((_, i) => report.profitability[offset + i] ?? 0), total: months.reduce((sum, _, i) => sum + (report.profitability[offset + i] ?? 0), 0) },
      ]);
      if (y > 550) {
        doc.font("Helvetica").fontSize(7).fillColor("#b91c1c")
          .text("Some expense rows may continue beyond the printable page area; use the Excel download for the complete matrix.", left, 565, { width });
      }
    }

    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Selected Period Totals", 30, 30);
    doc.font("Helvetica").fontSize(9).fillColor("#475569")
      .text(`${report.projectName} · ${report.rangeLabel} · ${report.currency}`, 30, 55);
    const totals = [
      ["Total revenue", report.revenueTotal],
      ["Total expenses", report.expenseTotal],
      ["Net profitability", report.profitabilityTotal],
    ] as const;
    let totalY = 100;
    for (const [label, value] of totals) {
      doc.save().fillColor("#f1f5f9").rect(30, totalY, 360, 40).fill().restore();
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(label, 42, totalY + 13);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
        .text(`${report.currency} ${value.toFixed(2)}`, 230, totalY + 13, { width: 150, align: "right" });
      totalY += 52;
    }

    if (report.revenueDetails.length) {
      doc.addPage();
      const left = 30;
      const widths = [72, 120, 320, 90, 90];
      const headers = ["Date", "Milestone", "Description", "Amount", "Status"];
      let y = 30;
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text("Revenue accrual details", left, y);
      y += 28;
      const drawHeader = () => {
        let x = left;
        headers.forEach((header, i) => {
          doc.save().fillColor("#e2e8f0").rect(x, y, widths[i], 22).fill().restore();
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#1e293b").text(header, x + 4, y + 6, { width: widths[i] - 8, ellipsis: true });
          x += widths[i];
        });
        y += 22;
      };
      drawHeader();
      for (const item of report.revenueDetails) {
        if (y > 550) { doc.addPage(); y = 30; drawHeader(); }
        let x = left;
        const values = [item.date, item.milestone, item.description, item.amount.toFixed(2), item.status];
        values.forEach((value, i) => {
          doc.font("Helvetica").fontSize(7).fillColor("#0f172a")
            .text(value, x + 4, y + 5, { width: widths[i] - 8, height: 30, ellipsis: true });
          x += widths[i];
        });
        y += 24;
      }
    }
    doc.end();
  });
}
