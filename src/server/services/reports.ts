import "server-only";

import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/money";

export type MonthlySalesRow = {
  /** YYYY-MM  (Bangkok timezone) */
  monthKey: string;
  /** ป พ.ศ. 4 หลัก */
  thaiYear: number;
  /** เลขเดือน 1–12 */
  month: number;
  /** label เช่น "ต.ค. 2568" */
  label: string;
  revenue: Decimal;
  costOfGoods: Decimal;
  grossProfit: Decimal;
  billCount: number;
};

/** รายงานยอดขาย+กำไรขั้นต้น 12 เดือนย้อนหลัง (Admin only) */
export async function getMonthlySalesReport(
  now: Date = new Date(),
): Promise<MonthlySalesRow[]> {
  // คำนวณช่วง 12 เดือนย้อนหลังในเวลากรุงเทพฯ
  const bangkokParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  const currentYear = parseInt(bangkokParts.year ?? "2025");
  const currentMonth = parseInt(bangkokParts.month ?? "01");

  // สร้างรายการ 12 เดือน (เก่า → ใหม่)
  const months: Array<{ key: string; year: number; month: number }> = [];
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ key, year: y, month: m });
  }

  const oldest = months[0];
  const since = new Date(
    `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01T00:00:00+07:00`,
  );

  // ดึง bill PAID ที่อยู่ในช่วง 12 เดือน พร้อม items (unitCost, quantity, lineTotal)
  const bills = await prisma.bill.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: since },
    },
    select: {
      paidAt: true,
      grandTotal: true,
      vatAmount: true,
      items: {
        select: { unitCost: true, quantity: true },
      },
    },
  });

  const bangkokMonthFormatter = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "short",
  });

  // สร้าง map เพื่อ aggregate
  const resultMap = new Map<
    string,
    {
      revenue: Decimal;
      costOfGoods: Decimal;
      billCount: number;
    }
  >(
    months.map(({ key }) => [
      key,
      { revenue: new Decimal(0), costOfGoods: new Decimal(0), billCount: 0 },
    ]),
  );

  for (const bill of bills) {
    if (!bill.paidAt) continue;

    const bkParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(bill.paidAt)
      .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});

    const mKey = `${bkParts.year}-${bkParts.month}`;
    const entry = resultMap.get(mKey);
    if (!entry) continue;

    // ยอดรายได้ (ไม่รวม VAT)
    const revenue = new Decimal(bill.grandTotal.toString()).minus(
      new Decimal(bill.vatAmount.toString()),
    );

    // ต้นทุนสินค้า
    const cost = bill.items.reduce(
      (sum, item) =>
        sum.plus(new Decimal(item.unitCost.toString()).times(item.quantity)),
      new Decimal(0),
    );

    entry.revenue = entry.revenue.plus(revenue);
    entry.costOfGoods = entry.costOfGoods.plus(cost);
    entry.billCount += 1;
  }

  return months.map(({ key, year, month }) => {
    const entry = resultMap.get(key) ?? {
      revenue: new Decimal(0),
      costOfGoods: new Decimal(0),
      billCount: 0,
    };
    // แปลงปี ค.ศ. → พ.ศ.
    const thaiYear = year + 543;
    const refDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
    const monthName = bangkokMonthFormatter.format(refDate);
    const label = `${monthName} ${thaiYear}`;

    return {
      monthKey: key,
      thaiYear,
      month,
      label,
      revenue: entry.revenue,
      costOfGoods: entry.costOfGoods,
      grossProfit: entry.revenue.minus(entry.costOfGoods),
      billCount: entry.billCount,
    };
  });
}

export function buildMonthlySalesReportCsv(rows: MonthlySalesRow[]): string {
  const headers = [
    "เดือน",
    "ปี พ.ศ.",
    "จำนวนบิล",
    "ยอดขายสุทธิ (บาท)",
    "ต้นทุนสินค้า (บาท)",
    "กำไรขั้นต้น (บาท)",
    "อัตรากำไร (%)",
  ];

  const escapeCsv = (val: string | number) =>
    `"${String(val).replaceAll('"', '""')}"`;

  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => {
      const margin = row.revenue.isZero()
        ? "0.00"
        : row.grossProfit
            .dividedBy(row.revenue)
            .times(100)
            .toFixed(2);

      return [
        escapeCsv(row.label),
        escapeCsv(row.thaiYear),
        escapeCsv(row.billCount),
        escapeCsv(row.revenue.toFixed(2)),
        escapeCsv(row.costOfGoods.toFixed(2)),
        escapeCsv(row.grossProfit.toFixed(2)),
        escapeCsv(margin),
      ].join(",");
    }),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}
