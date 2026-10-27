import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Barcode,
  Boxes,
  CircleAlert,
  ClipboardList,
  History,
  PackageCheck,
  Pencil,
  Printer,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import { ErrorAlert, SuccessAlert } from "@/components/forms/form-feedback";
import {
  AddBarcodeForm,
  RemoveBarcodeForm,
  SetPrimaryBarcodeForm,
} from "@/components/inventory/barcode-manager";
import { ProductStatusForm } from "@/components/inventory/product-status-form";
import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { isLowStock } from "@/lib/inventory-calculations";
import {
  inventoryStockLabel,
  productBarcodeTypeLabel,
  serialStatusLabel,
  stockMovementTypeLabel,
} from "@/lib/inventory-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/labels";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getProductReceiptHistory } from "@/server/services/goods-receipts";
import { getProductById } from "@/server/services/products";
import {
  getProductSerials,
  getProductStockMovements,
} from "@/server/services/stock";

export const instant = false;

export const metadata: Metadata = {
  title: "รายละเอียดสินค้า",
};

type ProductPageSearchParams = {
  created?: string | string[];
  updated?: string | string[];
  archived?: string | string[];
  restored?: string | string[];
  barcode?: string | string[];
  stock?: string | string[];
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ProductPageSearchParams>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const product = await getProductById({ id: actor.id, role: actor.role }, id);

  if (!product) {
    notFound();
  }

  const isAdmin = actor.role === "ADMIN";
  const [movements, serials, receiptHistory, query] = await Promise.all([
    getProductStockMovements(product.id, 30),
    getProductSerials(product.id, 100),
    isAdmin
      ? getProductReceiptHistory(product.id)
      : Promise.resolve([]),
    searchParams,
  ]);

  const low = isLowStock(product.stockQty, product.reorderLevel);
  const archived = Boolean(product.deletedAt);
  const primaryBarcode =
    product.barcodes.find((barcode) => barcode.isPrimary) ?? product.barcodes[0];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/inventory/products"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการสินค้า
        </Link>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {product.category.code} · {product.category.name}
              </Badge>
              {product.trackSerial ? (
                <Badge variant="outline">ติดตาม Serial</Badge>
              ) : null}
              {low && !archived ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                >
                  <TriangleAlert aria-hidden />
                  ต่ำกว่าจุดสั่งซื้อ
                </Badge>
              ) : null}
              {archived ? (
                <Badge variant="destructive">เก็บถาวร</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                >
                  เปิดใช้งาน
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {product.name}
            </h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {product.sku}
              {product.brand || product.model
                ? ` · ${[product.brand, product.model].filter(Boolean).join(" / ")}`
                : ""}
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/inventory/products/${product.id}/edit`}
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              >
                <Pencil aria-hidden />
                แก้ไข
              </Link>
              {primaryBarcode ? (
                <Link
                  href={`/inventory/products/${product.id}/label?barcodeId=${primaryBarcode.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                >
                  <Printer aria-hidden />
                  พิมพ์ป้าย
                </Link>
              ) : null}
              <Link
                href="/inventory/receipts/new"
                className={cn(buttonVariants(), "h-9")}
              >
                <ClipboardList aria-hidden />
                รับสินค้าเข้า
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {query.created ? (
        <SuccessAlert title="สร้างสินค้าแล้ว">
          ข้อมูลสินค้าถูกบันทึกแล้ว หากยังไม่มีสต๊อก
          กรุณารับสินค้าเข้าผ่านใบรับสินค้า
        </SuccessAlert>
      ) : null}
      {query.updated ? (
        <SuccessAlert title="บันทึกการแก้ไขแล้ว">
          ข้อมูลหลักของสินค้าถูกอัปเดตแล้ว
        </SuccessAlert>
      ) : null}
      {query.archived ? (
        <SuccessAlert title="เก็บสินค้าถาวรแล้ว">
          ประวัติสินค้าและความเคลื่อนไหวยังคงอยู่ และสามารถกู้คืนได้ภายหลัง
        </SuccessAlert>
      ) : null}
      {query.restored ? (
        <SuccessAlert title="กู้คืนสินค้าแล้ว">
          สินค้ากลับมาแสดงในรายการที่เปิดใช้งาน
        </SuccessAlert>
      ) : null}
      {query.barcode === "added" ? (
        <SuccessAlert title="เพิ่มบาร์โค้ดแล้ว">บาร์โค้ดพร้อมใช้งาน</SuccessAlert>
      ) : null}
      {query.barcode === "removed" ? (
        <SuccessAlert title="ลบบาร์โค้ดแล้ว">
          หากลบบาร์โค้ดหลัก ระบบจะเลื่อนบาร์โค้ดที่เหลือขึ้นเป็นหลักให้
        </SuccessAlert>
      ) : null}
      {query.barcode === "primary" ? (
        <SuccessAlert title="เปลี่ยนบาร์โค้ดหลักแล้ว">
          หน้าสแกนและป้ายสินค้าจะใช้บาร์โค้ดนี้เป็นค่าเริ่มต้น
        </SuccessAlert>
      ) : null}
      {query.stock === "adjusted" ? (
        <SuccessAlert title="ปรับสต๊อกแล้ว">
          ระบบบันทึกความเคลื่อนไหวและผู้ทำรายการไว้ในประวัติ
        </SuccessAlert>
      ) : null}

      {archived ? (
        <ErrorAlert title="สินค้านี้ถูกเก็บถาวร">
          ยังดูประวัติได้ แต่จะไม่แสดงในรายการขายหรือใบรับสินค้าใหม่
        </ErrorAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">คงเหลือ</p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold",
                low && "text-amber-700 dark:text-amber-300",
              )}
            >
              {inventoryStockLabel(product.stockQty)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              จุดสั่งซื้อ {product.reorderLevel} ชิ้น
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">ราคาขาย</p>
            <p className="mt-1 text-xl font-semibold">
              {formatTHB(product.salePrice.toString())}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ราคาต่อหน่วย
            </p>
          </CardContent>
        </Card>
        {isAdmin ? (
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">ต้นทุนเฉลี่ย</p>
              <p className="mt-1 text-xl font-semibold">
                {formatTHB(product.costPrice.toString())}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                มูลค่าสต๊อก{" "}
                {formatTHB(
                  product.costPrice.times(product.stockQty).toString(),
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">ประกันสินค้า</p>
              <p className="mt-1 text-xl font-semibold">
                {product.warrantyMonths > 0
                  ? `${product.warrantyMonths} เดือน`
                  : "ไม่ระบุ"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                นับจากวันที่ขาย
              </p>
            </CardContent>
          </Card>
        )}
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Serial ในระบบ</p>
            <p className="mt-1 text-xl font-semibold">
              {product._count.serials.toLocaleString("th-TH")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {product.trackSerial ? "ติดตามรายเครื่อง" : "ไม่ติดตาม Serial"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>ข้อมูลสินค้า</CardTitle>
              <CardDescription>
                ข้อมูลเรือธงของสินค้าและเงื่อนไขประกัน
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">แบรนด์</p>
                <p className="mt-1 text-sm font-medium">
                  {product.brand || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">รุ่น</p>
                <p className="mt-1 text-sm font-medium">
                  {product.model || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  ผู้จัดจำหน่ายหลัก
                </p>
                <p className="mt-1 text-sm font-medium">
                  {product.defaultSupplier?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ประกัน</p>
                <p className="mt-1 text-sm font-medium">
                  {product.warrantyMonths > 0
                    ? `${product.warrantyMonths} เดือน`
                    : "ไม่ระบุ"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">รายละเอียด</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {product.description || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">สร้างเมื่อ</p>
                <p className="mt-1 text-sm">
                  {formatThaiDateTime(product.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">แก้ไขล่าสุด</p>
                <p className="mt-1 text-sm">
                  {formatThaiDateTime(product.updatedAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card id="barcodes">
            <CardHeader className="border-b">
              <CardTitle>บาร์โค้ด</CardTitle>
              <CardDescription>
                ใช้ได้หลายบาร์โค้ด แต่มีบาร์โค้ดหลักเพียงรายการเดียว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.barcodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีบาร์โค้ดสำหรับสินค้านี้
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>บาร์โค้ด</TableHead>
                        <TableHead>ชนิด</TableHead>
                        <TableHead>สถานะ</TableHead>
                        {isAdmin ? (
                          <TableHead className="text-right">จัดการ</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.barcodes.map((barcode) => (
                        <TableRow key={barcode.id}>
                          <TableCell className="font-mono text-sm">
                            {barcode.barcode}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {productBarcodeTypeLabel(barcode.type)}
                          </TableCell>
                          <TableCell>
                            {barcode.isPrimary ? (
                              <Badge variant="outline">
                                <ShieldCheck aria-hidden />
                                หลัก
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                สำรอง
                              </span>
                            )}
                          </TableCell>
                          {isAdmin ? (
                            <TableCell>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <Link
                                  href={`/inventory/products/${product.id}/label?barcodeId=${barcode.id}`}
                                  className={cn(
                                    buttonVariants({
                                      variant: "ghost",
                                      size: "sm",
                                    }),
                                  )}
                                >
                                  <Printer aria-hidden />
                                  ป้าย
                                </Link>
                                {!barcode.isPrimary ? (
                                  <SetPrimaryBarcodeForm
                                    productId={product.id}
                                    barcodeId={barcode.id}
                                  />
                                ) : null}
                                <RemoveBarcodeForm
                                  productId={product.id}
                                  barcodeId={barcode.id}
                                  barcode={barcode.barcode}
                                />
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {isAdmin ? <AddBarcodeForm productId={product.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>ความเคลื่อนไหวสต๊อก</CardTitle>
                  <CardDescription>
                    บันทึกทุกการรับเข้า ปรับยอด และการขายในอนาคต
                  </CardDescription>
                </div>
                {isAdmin ? (
                  <Link
                    href="/inventory/stock"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    ดูทั้งหมด
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {movements.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีการเคลื่อนไหว
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">เปลี่ยนแปลง</TableHead>
                        <TableHead className="text-right">คงเหลือ</TableHead>
                        {isAdmin ? (
                          <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatThaiDateTime(movement.createdAt)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {stockMovementTypeLabel(movement.type)}
                            </span>
                            {movement.goodsReceiptItem && isAdmin ? (
                              <Link
                                href={`/inventory/receipts/${movement.goodsReceiptItem.goodsReceipt.id}`}
                                className="ml-1 text-[10px] font-medium text-primary hover:underline"
                              >
                                {movement.goodsReceiptItem.goodsReceipt.receiptNo}
                              </Link>
                            ) : null}
                            {movement.note ? (
                              <p className="mt-0.5 max-w-56 truncate text-[10px] text-muted-foreground">
                                {movement.note}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              movement.quantityDelta > 0
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-rose-700 dark:text-rose-300",
                            )}
                          >
                            {movement.quantityDelta > 0 ? "+" : ""}
                            {movement.quantityDelta}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {movement.balanceAfter}
                          </TableCell>
                          {isAdmin ? (
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {movement.unitCost
                                ? formatTHB(movement.unitCost.toString())
                                : "—"}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Serial Number</CardTitle>
              <CardDescription>
                {product.trackSerial
                  ? "รายการเครื่องที่ผูกกับสินค้านี้ ล่าสุด 100 รายการ"
                  : "สินค้านี้ไม่ได้เปิดการติดตาม Serial"}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {serials.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มี Serial ในระบบ
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>รับเข้า</TableHead>
                        {isAdmin ? (
                          <TableHead className="text-right">ต้นทุน</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serials.map((serial) => (
                        <TableRow key={serial.id}>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/warranty?serial=${encodeURIComponent(serial.serialNumber)}`}
                              className="text-primary hover:underline font-semibold"
                              title="คลิกเพื่อตรวจสอบประวัติการซื้อและประกัน"
                            >
                              {serial.serialNumber}
                            </Link>
                            {serial.goodsReceiptItem && isAdmin ? (
                              <Link
                                href={`/inventory/receipts/${serial.goodsReceiptItem.goodsReceipt.id}`}
                                className="ml-2 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                              >
                                {serial.goodsReceiptItem.goodsReceipt.receiptNo}
                              </Link>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                serial.status === "IN_STOCK" &&
                                  "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
                                serial.status === "DISPOSED" &&
                                  "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
                              )}
                            >
                              {serialStatusLabel(serial.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatThaiDate(serial.createdAt)}
                          </TableCell>
                          {isAdmin ? (
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {serial.unitCost
                                ? formatTHB(serial.unitCost.toString())
                                : "—"}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>ประวัติรับสินค้า</CardTitle>
                <CardDescription>
                  ใบรับสินค้าที่มีรายการนี้ ล่าสุด 20 ใบ
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {receiptHistory.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    ยังไม่มีประวัติการรับสินค้า
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>เลขที่</TableHead>
                          <TableHead>วันที่</TableHead>
                          <TableHead>ผู้จัดจำหน่าย</TableHead>
                          <TableHead className="text-right">จำนวน</TableHead>
                          <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                          <TableHead className="text-right">รวม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptHistory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Link
                                href={`/inventory/receipts/${item.goodsReceipt.id}`}
                                className="font-mono text-xs font-medium text-primary hover:underline"
                              >
                                {item.goodsReceipt.receiptNo}
                              </Link>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatThaiDate(item.goodsReceipt.receivedAt)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.goodsReceipt.supplier.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatTHB(item.unitCost.toString())}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatTHB(item.lineTotal.toString())}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-5">
          {isAdmin && !archived ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>ปรับสต๊อก</CardTitle>
                <CardDescription>
                  ใช้เมื่อยอดนับจริงไม่ตรงกับระบบ ต้องระบุเหตุผลทุกครั้ง
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StockAdjustmentForm
                  productId={product.id}
                  trackSerial={product.trackSerial}
                  stockQty={product.stockQty}
                  costPrice={product.costPrice.toFixed(2)}
                />
              </CardContent>
            </Card>
          ) : null}

          {isAdmin ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>สถานะสินค้า</CardTitle>
                <CardDescription>
                  เก็บถาวรได้เมื่อไม่มีสินค้าในสต๊อก
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductStatusForm
                  productId={product.id}
                  active={!archived}
                  stockQty={product.stockQty}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>สรุปสำหรับช่าง</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-muted-foreground" aria-hidden />
                <span>คงเหลือ {inventoryStockLabel(product.stockQty)}</span>
              </div>
              <div className="flex items-center gap-2">
                <PackageCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  {product.trackSerial
                    ? "ต้องเลือก Serial ตอนขาย"
                    : "ไม่ต้องระบุ Serial"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  ประกัน{" "}
                  {product.warrantyMonths > 0
                    ? `${product.warrantyMonths} เดือน`
                    : "ไม่ระบุ"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <WalletCards
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <span>ราคาขาย {formatTHB(product.salePrice.toString())}</span>
              </div>
              {primaryBarcode ? (
                <div className="flex items-center gap-2">
                  <Barcode className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-xs">
                    {primaryBarcode.barcode}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>ประวัติและความรับผิดชอบ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <p>
                  ทุกการแก้ไขสินค้า รับเข้า และปรับสต๊อก
                  ถูกบันทึกใน audit log พร้อมผู้ทำรายการ
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CircleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <p>
                  ห้ามแก้ไขใบรับสินค้าย้อนหลัง หากผิดพลาดให้ใช้การปรับสต๊อกพร้อมเหตุผล
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
