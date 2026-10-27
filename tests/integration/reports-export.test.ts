import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money";
import {
  buildMonthlySalesReportCsv,
  type MonthlySalesRow,
} from "@/server/services/reports";

describe("Monthly sales report CSV", () => {
  it("builds valid CSV with BOM and required Thai headers", () => {
    const mockRows: MonthlySalesRow[] = [
      {
        monthKey: "2026-10",
        thaiYear: 2569,
        month: 10,
        label: "ต.ค. 2569",
        revenue: new Decimal("150000.00"),
        costOfGoods: new Decimal("100000.00"),
        grossProfit: new Decimal("50000.00"),
        billCount: 15,
      },
    ];

    const csv = buildMonthlySalesReportCsv(mockRows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("เดือน");
    expect(csv).toContain("ยอดขายสุทธิ (บาท)");
    expect(csv).toContain("กำไรขั้นต้น (บาท)");
    expect(csv).toContain("ต.ค. 2569");
    expect(csv).toContain("150000.00");
    expect(csv).toContain("33.33"); // margin %
  });

  it("handles empty/zero revenue rows gracefully", () => {
    const mockRows: MonthlySalesRow[] = [
      {
        monthKey: "2026-09",
        thaiYear: 2569,
        month: 9,
        label: "ก.ย. 2569",
        revenue: new Decimal("0.00"),
        costOfGoods: new Decimal("0.00"),
        grossProfit: new Decimal("0.00"),
        billCount: 0,
      },
    ];

    const csv = buildMonthlySalesReportCsv(mockRows);
    expect(csv).toContain("ก.ย. 2569");
    expect(csv).toContain("0.00");
  });
});
