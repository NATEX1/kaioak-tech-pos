# Phase 1 — Setup, Database และ Seed

> สถานะ: **เสร็จสิ้น รอตรวจ** — ยังไม่เริ่ม Phase 2

## 1. สิ่งที่ทำเสร็จ

- สร้างโปรเจกต์ Next.js 16.4.2 (App Router) + React 19 + TypeScript
- ตั้งค่า Tailwind CSS 4 และ shadcn/ui (Base Nova preset) พร้อม компонентыพื้นฐาน
- ตั้งค่า PostgreSQL 17 ผ่าน Docker Compose
- ติดตั้ง Prisma ORM 7.10.1 + `@prisma/adapter-pg`
- ออกแบบและ implement Prisma schema **25 ตาราง**
- สร้าง migration แรก พร้อม check constraint, trigram search index และ partial unique indexes
- Seed ข้อมูลจริงลงฐานข้อมูล:
  - Admin 1 คน
  - Technician 2 คน
  - สินค้า 20 รายการ (Track Serial 13 รายการ)
  - ProductSerial 123 ชิ้น
  - ลูกค้า 5 คน
  - Supplier 2 ราย
  - BillType 4 ประเภท
  - AppSetting 1 แถว
- Seed ข้อมูลสต๊อกเริ่มต้นผ่าน `StockMovement` type `ADJUSTMENT` (ไม่แก้ยอดโดยไม่มี ledger)
- หน้า `/` แสดงสถานะ Foundation ภาษาไทย รองรับ mobile/tablet
- เพิ่ม Vitest และ unit test สำหรับเงิน Decimal
- เขียน README วิธีติดตั้ง/รัน และเอกสาร Phase 0/1

## 2. โครงสร้างฐานข้อมูล

ตารางหลักตามโดเมน:

| โดเมน | ตาราง |
|---|---|
| Identity/Audit | `User`, `AuditLog`, `RateLimitBucket` |
| Customer | `Customer` |
| Catalog | `Category`, `Product`, `ProductBarcode`, `ProductSerial`, `Supplier` |
| Inventory | `GoodsReceipt`, `GoodsReceiptItem`, `StockMovement` |
| Billing | `BillType`, `DocumentSequence`, `Bill`, `BillItem`, `BillItemSerial`, `BillRepairDetail`, `BillWarrantyClaim`, `BillStatusHistory` |
| Commission | `CommissionRule`, `CommissionEntry`, `CommissionPayout`, `CommissionPayoutItem` |
| Settings | `AppSetting` |

ทุกตารางมี `createdAt`, `updatedAt`, `createdById` ตาม requirement
`createdById` เป็น audit scalar reference โดยไม่ผูก FK เพื่อให้ประวัติคงอยู่แม้ผู้ใช้ถูก deactivate และหลีกเลี่ยง cascade ที่ไม่พึงประสงค์

### Constraint / index สำคัญ

- Unique: email, phone, SKU, barcode, serialNumber, billNumber, receiptNo, billType code/prefix, sequence key, payoutNo
- `Product.stockQty >= 0` และ check constraint สำหรับจำนวนเงิน/ส่วนลด/VAT
- `BillItemSerial` unique ต่อ Serial เฉพาะรายการที่ยังไม่ถูก release
- ProductBarcode มี primary barcode ได้หนึ่งรายการต่อสินค้า
- GIN trigram index สำหรับค้นหาชื่อลูกค้า/สินค้า
- Index ตาม phone, status, technician, customer, createdAt, warrantyEndAt และ commission queries

### เงินและ VAT

- ฟิลด์เงินทั้งหมดใช้ `Decimal(12,2)`
- `vatRate` ใช้ `Decimal(5,2)`; ค่าเริ่มต้น 7%
- VAT เริ่มต้นปิด และ snapshot ระดับบิล
- ราคาเป็นแบบ VAT-inclusive ตามที่อนุมัติใน Phase 0
- Utility `src/lib/money.ts` ใช้ Decimal.js และ HALF_UP

## 3. Seed และข้อมูลตั้งต้น

- บัญชีเริ่มต้นอ่านค่าจาก `.env`: `SEED_ADMIN_*`, `SEED_TECH1_*`, `SEED_TECH2_*`
- รหัสผ่าน hash ด้วย bcrypt cost 12
- รหัสผ่านจริงไม่ถูก hardcode และ `.env` ถูก ignore
- Seed เป็น idempotent: รันซ้ำแล้วไม่เพิ่ม stock หรือ Serial ซ้ำ
- Serial ตัวอย่างรูปแบบ `SN-<SKU>-0001` ขึ้นไป
- บาร์โค้ดตัวอย่างเป็น CODE128 จำนวน 13 หลัก
- ข้อมูลร้านใน `AppSetting` เป็นข้อมูลตัวอย่าง สามารถแก้ใน Phase 8

### บัญชีสำหรับทดสอบใน Phase 2

- Admin: ค่า `SEED_ADMIN_EMAIL`
- Technician 1: ค่า `SEED_TECH1_EMAIL`
- Technician 2: ค่า `SEED_TECH2_EMAIL`

รหัสผ่านอยู่ใน `.env` ฝั่งเครื่อง development เท่านั้น

## 4. วิธีตรวจสอบ

```bash
# 1) ตรวจสถานะ migration
npx prisma migrate status

# 2) ตรวจ schema
npx prisma validate

# 3) ตรวจ type / lint / test / build
npm run typecheck
npm run lint
npm test
npm run build

# 4) ตรวจข้อมูล seed
docker compose exec -T db psql -U compos -d compos \
  -c 'SELECT role, count(*) FROM "User" GROUP BY role;' \
  -c 'SELECT count(*) FROM "Product";' \
  -c 'SELECT count(*) FROM "Customer";' \
  -c 'SELECT count(*) FROM "ProductSerial";' \
  -c 'SELECT count(*) FROM "StockMovement";'
```

ผลที่ตรวจแล้วในเครื่องนี้:

- `prisma migrate status` → up to date
- `prisma validate` → valid
- TypeScript → ผ่าน
- ESLint → ผ่าน
- Vitest → 3/3 ผ่าน
- Production build → ผ่าน
- หน้า `/` ตอบ HTTP 200
- Seed count → users 3, products 20, customers 5, serials 123
- Rerun seed → count เท่าเดิม (idempotent)

## 5. หมายเหตุทางเทคนิค / จุดที่ปรับจาก Phase 0

1. **Next.js 16** เปลี่ยนชื่อ Middleware เป็น `proxy.ts`; Phase 2 จะใช้ Proxy + server-side guards
2. **Prisma 7** ใช้ `prisma7.config.ts`, generator `prisma-client` และ generated client ที่ `src/generated/prisma` (ถูก ignore ไม่ commit)
3. เพิ่มตารางที่ ERD ระบุใน Phase 0: `BillRepairDetail`, `BillWarrantyClaim`, `BillItemSerial`, `GoodsReceiptItem`, `CommissionPayoutItem`, `DocumentSequence`, `AppSetting`, `RateLimitBucket`
4. shadcn/ui เวอร์ชันล่าสุดใช้ Base UI (`@base-ui/react`) แทน Radix แต่ยังเป็น shadcn/ui ตาม requirement
5. ยังไม่ได้เพิ่ม FK ให้ `createdById`; เก็บเป็น scalar audit reference ตามเหตุผลด้านบน

## 6. สิ่งที่ยังค้าง / เริ่มใน Phase ถัดไป

- Auth.js Credentials, session timeout, RBAC และ server guards (Phase 2)
- หน้า Login/Logout และหน้าจัดการผู้ใช้ (Phase 2)
- Login rate limit ด้วย `RateLimitBucket` (Phase 2)
- หน้าและ business logic ของสินค้า, ลูกค้า, บิล, คอมมิชชั่น และรายงาน (Phase 3–8)
- แก้ `favicon`/brand assets และรายละเอียด UI จริงใน phase ที่เกี่ยวข้อง
- npm audit พบ high vulnerabilities ใน tooling (`eslint-config-next` และ `shadcn` CLI) ซึ่งไม่ใช่ runtime path หลัก; จะตรวจ/อัปเดตใน Phase 9 security review
- README ฉบับ deployment สมบูรณ์จะทำใน Phase 9; ตอนนี้มีคำสั่ง local setup แล้ว

**หยุดรอตรวจ Phase 1 ก่อนเริ่ม Phase 2**
