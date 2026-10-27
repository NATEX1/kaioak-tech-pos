import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Barcode, ClipboardList, Store } from "lucide-react";

import { SuccessAlert } from "@/components/forms/form-feedback";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import { getGoodsReceiptById } from "@/server/services/goods-receipts";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดใบรับสินค้า",
};

export default async function GoodsReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const [receipt, query] = await Promise.all([
    getGoodsReceiptById({ id: actor.id, role: actor.role }, id),
    searchParams,
  ]);

  if (!receipt) {
    notFound();
  }

  const totalUnits = receipt.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/receipts"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการรับสินค้า
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <ClipboardList aria-hidden />
            ใบรับสินค้า
          </Badge>
          <span className="text-xs text-muted-foreground">
            บันทึกเมื่อ {formatThaiDateTime(receipt.createdAt)}
          </span>
        </div>
        <h2 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
          {receipt.receiptNo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatThaiDate(receipt.receivedAt)} · {receipt.supplier.name}
        </p>
      </div>

      {query.created ? (
        <SuccessAlert title="บันทึกใบรับสินค้าแล้ว">
          สต๊อก ต้นทุนเฉลี่ย และ stock ledger ถูกอัปเดตเรียบร้อย
          ไม่สามารถแก้ไขใบรับนี้ย้อนหลังได้
        </SuccessAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">รายการสินค้า</p>
            <p className="mt-1 text-xl font-semibold">
              {receipt.items.length.toLocaleString("th-TH")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">จำนวนรวม</p>
            <p className="mt-1 text-xl font-semibold">
              {totalUnits.toLocaleString("th-TH")} ชิ้น
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">ต้นทุนรวม</p>
            <p className="mt-1 text-xl font-semibold">
              {formatTHB(receipt.totalCost.toString())}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>รายการที่รับเข้า</CardTitle>
            <CardDescription>
              ต้นทุนต่อหน่วยที่ใช้คำนวณต้นทุนถัวเฉลี่ย
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="min-w-160">
                <TableHeader>
                  <TableRow>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                    <TableHead className="text-right">รวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/inventory/products/${item.product.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {item.product.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {item.product.sku}
                        </p>
                        {item.serials.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.serials.map((serial) => (
                              <span
                                key={serial.id}
                                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                <Barcode className="size-2.5" aria-hidden />
                                {serial.serialNumber}
                              </span>
                            ))}
                          </div>
                        ) : item.product.trackSerial ? (
                          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                            ไม่พบ Serial ในรายการนี้
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatTHB(item.unitCost.toString())}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatTHB(item.lineTotal.toString())}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>ผู้จัดจำหน่าย</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Store
                  className="mt-0.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{receipt.supplier.name}</p>
                  {receipt.supplier.contactName ? (
                    <p className="text-xs text-muted-foreground">
                      ผู้ติดต่อ {receipt.supplier.contactName}
                    </p>
                  ) : null}
                  {receipt.supplier.phone ? (
                    <p className="text-xs text-muted-foreground">
                      {receipt.supplier.phone}
                    </p>
                  ) : null}
                  {receipt.supplier.email ? (
                    <p className="text-xs text-muted-foreground">
                      {receipt.supplier.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>หมายเหตุ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {receipt.note || "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>หลักการบันทึก</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>
                ใบรับนี้แก้ไขไม่ได้ ระบบบันทึก stock movement แบบ GOODS_RECEIPT
                พร้อมยอดคงเหลือหลังทำรายการ และคำนวณต้นทุนถัวเฉลี่ยถ่วงน้ำหนัก
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
