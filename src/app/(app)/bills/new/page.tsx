import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Info,
  ScanBarcode,
} from "lucide-react";

import {
  BillForm,
  type BillFormInitial,
} from "@/components/bills/bill-form";
import { requireUser } from "@/server/auth/session";
import { getBillFormOptions } from "@/server/services/billing-options";

export const instant = false;

export const metadata: Metadata = {
  title: "เปิดบิลใหม่",
};

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    billTypeCode?: string;
    productId?: string;
    serialNumber?: string;
  }>;
}) {
  const actor = await requireUser();
  const [options, query] = await Promise.all([
    getBillFormOptions({
      id: actor.id,
      role: actor.role,
    }),
    searchParams,
  ]);
  const requestedCustomerId = query.customerId?.trim();
  const initialCustomerId = options.customers.some(
    (customer) => customer.id === requestedCustomerId,
  )
    ? requestedCustomerId
    : undefined;

  const requestedTypeCode = query.billTypeCode?.trim();
  const matchedType = requestedTypeCode
    ? options.billTypes.find((type) => type.code === requestedTypeCode)
    : undefined;
  const initialBillTypeId = matchedType?.id ?? options.billTypes[0]?.id;

  const initialClaim =
    query.productId || query.serialNumber
      ? {
          productId: query.productId?.trim(),
          serialNumber: query.serialNumber?.trim(),
        }
      : undefined;

  const noCustomers = options.customers.length === 0;
  const noProducts = options.products.length === 0;
  const noTechnicians =
    actor.role === "ADMIN" && options.technicians.length === 0;

  const initial: BillFormInitial = {
    billTypeId: initialBillTypeId,
    customerId: initialCustomerId,
    claim: initialClaim,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/bills"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายการบิล
        </Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">เปิดบิลใหม่</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              สแกนบาร์โค้ด เพิ่มสินค้า/บริการ แล้วบันทึกเป็นร่างเพื่อส่งขออนุมัติ
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ScanBarcode className="size-4 text-primary" aria-hidden />
            เริ่มจากบาร์โค้ด
          </div>
        </div>
      </div>

      {noCustomers || noProducts || noTechnicians ? (
        <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            ข้อมูลพื้นฐานยังไม่ครบ
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
            {noCustomers ? (
              <li>
                ยังไม่มีลูกค้าที่เปิดใช้งาน —{" "}
                <Link href="/customers/new" className="font-semibold underline">
                  เพิ่มลูกค้าใหม่
                </Link>
              </li>
            ) : null}
            {noProducts ? (
              <li>
                ยังไม่มีสินค้าที่เปิดใช้งาน —{" "}
                <Link
                  href="/inventory/products/new"
                  className="font-semibold underline"
                >
                  เพิ่มสินค้า
                </Link>
              </li>
            ) : null}
            {noTechnicians ? (
              <li>
                ยังไม่มีช่างเทคนิคที่เปิดใช้งาน —{" "}
                <Link
                  href="/settings/users"
                  className="font-semibold underline"
                >
                  จัดการผู้ใช้
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card px-4 py-3 shadow-xs">
        <p className="flex items-center gap-2 text-xs font-medium">
          <Info className="size-4 text-primary" aria-hidden />
          ขั้นตอนการทำงาน
        </p>
        <ol className="mt-2 grid gap-2 text-[11px] leading-5 text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
          <li>
            <span className="font-medium text-foreground">1. ร่าง</span> —
            บันทึกรายการและข้อมูลลูกค้าได้ตลอด
          </li>
          <li>
            <span className="font-medium text-foreground">
              2. ส่งขออนุมัติ
            </span>{" "}
            — ระบบตรวจสต๊อกและ Serial ก่อนส่ง
          </li>
          <li>
            <span className="font-medium text-foreground">3. อนุมัติ</span> —
            ผู้ดูแลระบบอนุมัติแล้วจึงตัดสต๊อกจริง
          </li>
          <li>
            <span className="font-medium text-foreground">4. ชำระเงิน</span> —
            ผู้ดูแลระบบบันทึกวิธีชำระและปิดงาน
          </li>
        </ol>
      </div>

      <BillForm
        mode="create"
        billTypes={options.billTypes}
        customers={options.customers}
        technicians={options.technicians}
        products={options.products}
        settings={options.settings}
        isAdmin={actor.role === "ADMIN"}
        currentUserId={actor.id}
        currentUserName={actor.name}
        initial={initial}
      />
    </div>
  );
}
