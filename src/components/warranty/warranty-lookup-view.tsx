"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Package,
  ScanBarcode,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatThaiDate } from "@/lib/labels";
import { formatThaiPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { lookupSerialWarrantyAction } from "@/server/actions/warranty";
import type { SerialWarrantyLookupResult } from "@/server/services/warranty";

type WarrantyLookupViewProps = {
  initialSerial?: string;
  initialResult?: SerialWarrantyLookupResult | null;
  isAdmin: boolean;
};

export function WarrantyLookupView({
  initialSerial = "",
  initialResult = null,
  isAdmin,
}: WarrantyLookupViewProps) {
  const router = useRouter();
  const [serialQuery, setSerialQuery] = useState(initialSerial);
  const [result, setResult] = useState<SerialWarrantyLookupResult | null>(
    initialResult,
  );
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  function handleSearch(queryToSearch?: string) {
    const q = (queryToSearch ?? serialQuery).trim();
    if (!q) return;

    startTransition(async () => {
      const res = await lookupSerialWarrantyAction(q);
      setResult(res);
      router.replace(`/warranty?serial=${encodeURIComponent(q)}`, {
        scroll: false,
      });
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <h2 className="text-xl font-bold tracking-tight">
            ตรวจสอบประกันและประวัติการซื้อ
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          ค้นหาย้อนหลังจาก Serial Number หรือสแกนบาร์โค้ด
          เพื่อตรวจสถานะประกันและเปิดบิลเคลมได้ทันที
        </p>
      </div>

      {/* Search Bar */}
      <Card className="border-primary/20 shadow-sm">
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <ScanBarcode
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={inputRef}
                value={serialQuery}
                onChange={(e) => setSerialQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ยิงบาร์โค้ด หรือพิมพ์ Serial Number (เช่น SN-123456)..."
                className="pl-9 text-base md:text-sm font-mono"
              />
            </div>
            <Button type="submit" disabled={isPending} className="gap-2 shrink-0">
              <Search className="size-4" aria-hidden />
              {isPending ? "กำลังค้นหา..." : "ตรวจสอบประกัน"}
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              💡 สแกนด้วยเครื่องยิงบาร์โค้ดแล้วกด Enter ได้ทันที
            </span>
            {serialQuery && (
              <button
                type="button"
                onClick={() => {
                  setSerialQuery("");
                  setResult(null);
                  router.replace("/warranty", { scroll: false });
                  inputRef.current?.focus();
                }}
                className="hover:underline text-primary"
              >
                ล้างข้อมูล
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Result */}
      {result ? (
        result.found ? (
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Status Banner */}
            <div
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
                result.status === "IN_WARRANTY" &&
                  "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200",
                result.status === "OUT_OF_WARRANTY" &&
                  "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200",
                result.status === "IN_STOCK" &&
                  "border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200",
                result.status === "NO_WARRANTY" &&
                  "border-slate-200 bg-slate-50/70 text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
              )}
            >
              <div className="flex items-start gap-3">
                {result.status === "IN_WARRANTY" && (
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
                )}
                {result.status === "OUT_OF_WARRANTY" && (
                  <ShieldAlert className="size-6 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                )}
                {result.status === "IN_STOCK" && (
                  <Package className="size-6 text-sky-600 dark:text-sky-300 shrink-0 mt-0.5" />
                )}
                {result.status === "NO_WARRANTY" && (
                  <ShieldQuestion className="size-6 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg font-mono">
                      {result.serialNumber}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        result.status === "IN_WARRANTY" &&
                          "border-emerald-300 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200",
                        result.status === "OUT_OF_WARRANTY" &&
                          "border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200",
                        result.status === "IN_STOCK" &&
                          "border-sky-300 dark:border-sky-800 bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200",
                      )}
                    >
                      {result.status === "IN_WARRANTY" && "อยู่ในประกัน"}
                      {result.status === "OUT_OF_WARRANTY" && "หมดประกันแล้ว"}
                      {result.status === "IN_STOCK" && "ยังไม่ถูกขาย (อยู่ในสต๊อก)"}
                      {result.status === "NO_WARRANTY" && "ไม่มีข้อมูลประกัน"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    {result.status === "IN_WARRANTY" &&
                      `สินค้ายังอยู่ในระยะเวลารับประกัน (เหลืออีก ${result.warranty?.daysRemaining ?? 0} วัน · สิ้นสุด ${result.warranty?.warrantyEndsAt ? formatThaiDate(result.warranty.warrantyEndsAt) : "-"})`}
                    {result.status === "OUT_OF_WARRANTY" &&
                      `สินค้าหมดระยะเวลารับประกันแล้วเมื่อ ${result.warranty?.warrantyEndsAt ? formatThaiDate(result.warranty.warrantyEndsAt) : "-"} (หมดไปแล้ว ${result.warranty?.daysExpired ?? 0} วัน)`}
                    {result.status === "IN_STOCK" &&
                      "สินค้ารายการนี้ยังอยู่ในสต๊อกของร้าน ยังไม่มีการเปิดบิลขายให้ลูกค้า"}
                    {result.status === "NO_WARRANTY" &&
                      "สินค้ารายการนี้ไม่ได้เปิดการรับประกัน หรือไม่มีข้อมูลวันหมดประกัน"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {result.customer && result.product ? (
                  <Link
                    href={`/bills/new?billTypeCode=WARRANTY_CLAIM&customerId=${result.customer.id}&productId=${result.product.id}&serialNumber=${encodeURIComponent(result.serialNumber)}`}
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "gap-2 font-medium shadow-sm",
                    )}
                  >
                    เปิดบิลเคลมสินค้านี้
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Product Information */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-primary" aria-hidden />
                    <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                  {result.product ? (
                    <>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          ชื่อสินค้า:
                        </span>
                        <div className="font-semibold text-base mt-0.5">
                          <Link
                            href={`/inventory/products/${result.product.id}`}
                            className="hover:underline text-primary flex items-center gap-1.5"
                          >
                            {result.product.name}
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            SKU:
                          </span>
                          <p className="font-mono">{result.product.sku}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            ระยะเวลารับประกัน:
                          </span>
                          <p className="font-medium">
                            {result.product.warrantyMonths > 0
                              ? `${result.product.warrantyMonths} เดือน`
                              : "ไม่มีประกัน"}
                          </p>
                        </div>
                      </div>
                      {(result.product.brand || result.product.model) && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                          <div>
                            <span className="text-xs text-muted-foreground">
                              แบรนด์:
                            </span>
                            <p>{result.product.brand || "—"}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              รุ่น:
                            </span>
                            <p>{result.product.model || "—"}</p>
                          </div>
                        </div>
                      )}
                      {isAdmin && result.serial?.unitCost && (
                        <div className="pt-1 border-t">
                          <span className="text-xs text-muted-foreground">
                            ต้นทุนต่อหน่วย (เฉพาะ Admin):
                          </span>
                          <p className="font-mono">฿{result.serial.unitCost}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">ไม่พบข้อมูลสินค้า</p>
                  )}
                </CardContent>
              </Card>

              {/* Purchase / Customer Information */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-primary" aria-hidden />
                    <CardTitle className="text-base">
                      ข้อมูลผู้ซื้อและบิลเดิม
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                  {result.restricted ? (
                    <div className="py-6 text-center text-muted-foreground">
                      <ShieldAlert className="mx-auto mb-2 size-8 text-amber-500 dark:text-amber-400" />
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        ประวัติการซื้อถูกจำกัดสิทธิ์
                      </p>
                      <p className="mt-1 text-xs">
                        Serial นี้ถูกขายในบิลของช่างคนอื่น
                        ระบบจึงไม่แสดงข้อมูลลูกค้าและเลขที่บิลเดิม
                        กรุณาให้ Admin ตรวจสอบหรือเปิดเคลมแทน
                      </p>
                    </div>
                  ) : result.customer && result.originalBill ? (
                    <>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          ลูกค้าผู้ซื้อ:
                        </span>
                        <div className="font-semibold text-base mt-0.5">
                          <Link
                            href={`/customers/${result.customer.id}`}
                            className="hover:underline text-primary flex items-center gap-1.5"
                          >
                            {result.customer.name}
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          เบอร์โทร: {formatThaiPhone(result.customer.phone)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            เลขที่บิลขาย:
                          </span>
                          <p className="font-mono font-medium">
                            <Link
                              href={`/bills/${result.originalBill.id}`}
                              className="hover:underline text-primary"
                            >
                              {result.originalBill.billNumber}
                            </Link>
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            วันที่ซื้อ:
                          </span>
                          <p className="font-medium">
                            {formatThaiDate(result.originalBill.date)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            วันเริ่มประกัน:
                          </span>
                          <p>
                            {result.warranty?.warrantyStartAt
                              ? formatThaiDate(result.warranty.warrantyStartAt)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            วันสิ้นสุดประกัน:
                          </span>
                          <p className="font-medium">
                            {result.warranty?.warrantyEndsAt
                              ? formatThaiDate(result.warranty.warrantyEndsAt)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground">
                      <Clock className="size-8 mx-auto mb-2 opacity-40" />
                      <p>ยังไม่มีประวัติการขายให้กับลูกค้า</p>
                      <p className="text-xs mt-1">
                        สินค้ายังอยู่ในสต๊อกร้าน หรือยังไม่ได้ตัดสต๊อกผ่านบิลขาย
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Claim History Table */}
            {result.claimHistory.length > 0 && (
              <Card>
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-primary" aria-hidden />
                    <CardTitle className="text-base">
                      ประวัติการเคลมสินค้านี้ ({result.claimHistory.length}{" "}
                      รายการ)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลขที่บิลเคลม</TableHead>
                        <TableHead>วันที่เคลม</TableHead>
                        <TableHead>สถานะบิล</TableHead>
                        <TableHead>ผลการตรวจประกัน</TableHead>
                        <TableHead>เหตุผล Override (ถ้ามี)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.claimHistory.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            <Link
                              href={`/bills/${claim.billId}`}
                              className="text-primary hover:underline"
                            >
                              {claim.billNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatThaiDate(claim.claimedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {claim.billStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {claim.checkResult ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {claim.adminOverrideReason ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Not Found */
          <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-950 dark:bg-rose-950/20">
            <CardContent className="py-8 text-center space-y-3">
              <ShieldAlert className="size-10 text-rose-500 dark:text-rose-400 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg text-rose-950 dark:text-rose-200">
                  ไม่พบข้อมูล Serial:{" "}
                  <span className="font-mono">{result.serialNumber}</span>
                </h3>
                <p className="text-sm text-rose-800 dark:text-rose-300 mt-1 max-w-md mx-auto">
                  ไม่พบหมายเลข Serial นี้ในฐานข้อมูลของร้าน
                  กรุณาตรวจสอบการสะกดหรือยิงบาร์โค้ดใหม่อีกครั้ง
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                หากเป็นสินค้าที่ลูกค้าซื้อจากที่อื่น หรือไม่พบประวัติ
                การส่งเคลมจะต้องได้รับการอนุมัติเป็นกรณีพิเศษจาก Admin
              </p>
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
