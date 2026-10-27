# Phase 4 — Customers

> สถานะ: **เสร็จสิ้นและผ่านการตรวจแล้ว** — Phase 2 และ Phase 3 ยังรออนุมัติอย่างเป็นทางการ; Phase 5 ต่อยอดบิลจริงจาก Phase นี้แล้ว

## 1. สรุปสิ่งที่ทำเสร็จ

- เพิ่มหน้าค้นหาและรายชื่อลูกค้าสำหรับ Admin และ Technician
- เพิ่มโปรไฟล์ลูกค้า: เบอร์โทร อีเมล ที่อยู่ เลขผู้เสียภาษี หมายเหตุ และสถานะการใช้งาน
- เพิ่มการสร้างลูกค้าใหม่จาก UI พร้อม validation ฝั่ง server
- เพิ่มการแก้ไข เก็บถาวร และกู้คืนลูกค้าเฉพาะ Admin
- Normalize เบอร์โทรไทยเป็นรูปแบบเดียว และป้องกันเบอร์ซ้ำทั้งลูกค้าที่ใช้งานและที่เก็บถาวร
- เพิ่มประวัติการซื้อ/บริการล่าสุด 20 รายการ พร้อมยอดซื้อสะสมจากบิลที่อนุมัติหรือชำระแล้ว
- เพิ่มสรุปจำนวนลูกค้าใน Dashboard และเมนูลูกค้าใน app shell
- เพิ่ม audit log สำหรับการสร้าง แก้ไข เก็บถาวร และกู้คืน
- เพิ่ม unit/integration tests และตรวจ browser flow จริงทั้ง Admin และ Technician

Phase 4 ไม่ต้องมี migration ใหม่ เพราะตาราง `Customer` ถูกสร้างไว้ตั้งแต่ Phase 1 แล้ว

## 2. Route และ UI

| Route | หน้าที่ |
|---|---|
| `/customers` | ค้นหาชื่อ/เบอร์โทร/อีเมล กรองสถานะ (Admin) และแสดงรายชื่อ |
| `/customers/new` | เพิ่มลูกค้าใหม่ (Admin และ Technician) |
| `/customers/[id]` | โปรไฟล์ ข้อมูลติดต่อ ยอดซื้อ และประวัติการซื้อ/บริการ |
| `/customers/[id]/edit` | แก้ไขข้อมูลลูกค้า (Admin) |

UI หลักเป็นภาษาไทย รองรับ desktop/tablet/mobile ตารางใช้ horizontal scroll ภายใน container บนจอแคบ และ search form เปลี่ยนเป็นแนวตั้งบน mobile

## 3. กติกาข้อมูลลูกค้า

- `name` บังคับ 2–200 ตัวอักษร
- `phone` บังคับและ unique ทั้งระบบ
  - รองรับเบอร์มือถือ 10 หลัก และเบอร์บ้าน 9 หลัก
  - รองรับช่องว่าง ขีดกลาง วงเล็บ และ `+66`
  - จัดเก็บเป็นตัวเลข national format เช่น `0812345678` หรือ `021234567`
  - เบอร์ที่เก็บถาวรยังคงจองอยู่; ต้องกู้คืนลูกค้าเดิมแทนการสร้างซ้ำ
- `email` ไม่บังคับ, ตรวจรูปแบบ และจัดเก็บเป็นตัวพิมพ์เล็ก
- `taxId` ไม่บังคับ; ตัดขีดกลาง/ช่องว่างและต้องเหลือ 13 หลัก
- `address` และ `note` ไม่บังคับ ความยาวไม่เกิน 2,000 ตัวอักษร
- การเก็บถาวรตั้ง `isActive = false` และ `deletedAt`; ไม่ลบข้อมูลจริง
- การกู้คืนตั้ง `isActive = true` และ `deletedAt = null`
- ประวัติบิลไม่หายเมื่อเก็บถาวรหรือแก้ไขข้อมูล
- Technician เห็นเฉพาะลูกค้าที่ยังเปิดใช้งาน; Admin เห็นทั้ง active, archived และทั้งหมด

## 4. ค้นหาและประวัติ

### ค้นหา

- ค้นหาชื่อและอีเมลแบบไม่สนตัวพิมพ์เล็ก/ใหญ่
- ค้นหาเบอร์โทรแบบบางส่วนได้ และ normalize คำค้นที่มีขีดกลาง/ช่องว่าง
- รองรับ `+66` สำหรับคำค้นเบอร์แบบเต็ม
- จำกัดผลลัพธ์ 200 รายการ และเรียงจากลูกค้าที่สร้างล่าสุด
- Admin กรองได้: เปิดใช้งาน / เก็บถาวร / ทั้งหมด

### ประวัติ

- แสดงบิลสถานะ `APPROVED`, `PAID`, `VOIDED` ล่าสุด 20 รายการ
- ยอดซื้อสะสมและจำนวนประวัติที่เสร็จสิ้นนับเฉพาะ `APPROVED` และ `PAID`
- ไม่นำบิล `VOIDED` มารวมในยอดซื้อสะสม
- วันที่ซื้อล่าสุดเลือกจาก `paidAt`, `approvedAt` หรือ `createdAt` ตามลำดับ
- Phase นี้ยังไม่มีข้อมูลบิลจาก seed; หน้าจอจึงแสดง empty state และพร้อมต่อกับ Phase 5

## 5. RBAC

| ความสามารถ | Admin | Technician |
|---|---|---|
| ดู/ค้นหารายชื่อลูกค้า | ✅ | ✅ (เฉพาะ active) |
| ดูโปรไฟล์และประวัติ | ✅ | ✅ (เฉพาะ active) |
| เพิ่มลูกค้า | ✅ | ✅ |
| แก้ไขลูกค้า | ✅ | ❌ |
| เก็บถาวร/กู้คืน | ✅ | ❌ |
| กรองลูกค้า archived | ✅ | ❌ |
| เปิดโปรไฟล์ลูกค้า archived | ✅ | ❌ (404) |

การป้องกันมีหลายชั้น:

- Page guard: `requireUser()` หรือ `requireAdmin()`
- Server Actions ตรวจสิทธิ์ก่อนประมวลผล
- Service layer เรียก `assertCustomerAdmin()` ซ้ำสำหรับ writes ที่เป็นสิทธิ์ Admin
- UI ซ่อนปุ่ม/ตัวกรองตาม role เพื่อ UX เท่านั้น

## 6. Audit Log

Phase 4 เพิ่ม action:

- `CUSTOMER_CREATED`
- `CUSTOMER_UPDATED`
- `CUSTOMER_ARCHIVED`
- `CUSTOMER_RESTORED`

Audit เก็บ actor, entity, before/after snapshot ของชื่อ เบอร์โทร อีเมล ที่อยู่ เลขผู้เสียภาษี หมายเหตุ และสถานะ พร้อมเขียนใน transaction เดียวกับข้อมูลลูกค้า

## 7. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/(app)/customers/page.tsx` | รายชื่อ ค้นหา summary และตัวกรอง |
| `src/app/(app)/customers/new/page.tsx` | หน้าเพิ่มลูกค้า |
| `src/app/(app)/customers/[id]/page.tsx` | โปรไฟล์ สรุปยอดซื้อ และประวัติ |
| `src/app/(app)/customers/[id]/edit/page.tsx` | หน้าแก้ไขลูกค้า |
| `src/components/customers/customer-form.tsx` | ฟอร์มสร้าง/แก้ไข |
| `src/components/customers/customer-status-form.tsx` | เก็บถาวร/กู้คืน |
| `src/server/services/customers.ts` | business logic, search, history, archive |
| `src/server/services/customer-error.ts` | domain error และ unique-phone mapping |
| `src/server/actions/customers.ts` | Server Actions และ redirect/error mapping |
| `src/server/validators/customers.ts` | Zod schemas |
| `src/lib/phone.ts` | normalize/format/search เบอร์โทรไทย |
| `src/lib/bill-labels.ts` | label และสีสถานะบิลสำหรับประวัติ |
| `src/components/layout/app-nav.tsx` | เมนูลูกค้าและ phase label |
| `src/app/(app)/page.tsx` | Dashboard summary และ Phase 4 module |

## 8. Tests และผลตรวจสอบ

รันเมื่อเสร็จ Phase 4:

```text
npm run typecheck  → ผ่าน
npm run lint       → ผ่าน
npm test           → 13 ไฟล์, 78 tests ผ่านทั้งหมด
npm run build      → ผ่าน
```

ชุดทดสอบใหม่:

- `tests/unit/customer-phone.test.ts` — normalize/format/search เบอร์มือถือและเบอร์บ้าน, validation ของฟอร์ม, email/tax ID
- `tests/integration/customer-service.test.ts` — create ด้วย Technician, duplicate phone, search, อ่านข้อมูล, Admin update/archive/restore, audit, archived visibility, ประวัติบิลและยอดซื้อ

Browser flow ด้วย Chrome headless: **42 checks ผ่านทั้งหมด**

- Admin login, Dashboard และเมนูลูกค้า
- ค้นหาด้วยชื่อและเบอร์โทรที่จัดรูปแบบ
- เปิดโปรไฟล์ลูกค้า seed และเห็น empty history
- ตรวจ duplicate phone จาก server action จริง
- สร้าง/แก้ไข/เก็บถาวร/กู้คืนลูกค้าผ่าน UI
- ตรวจ redirect ไป archived filter หลังเก็บถาวร
- Technician ดูรายการ/โปรไฟล์และสร้างลูกค้าได้
- Technician ไม่เห็นตัวกรอง archived, ปุ่มแก้ไข หรือปุ่มเก็บถาวร
- Technician เปิดหน้า edit ตรง ๆ แล้วไป `/forbidden`
- Technician เปิดโปรไฟล์ archived ตรง ๆ แล้วได้ 404 และไม่เห็นในรายการ
- Mobile 390px ไม่มี horizontal overflow
- ไม่มี console error หรือ page exception

ข้อมูลทดสอบถูกลบหลังตรวจ และฐานข้อมูลกลับมามีลูกค้า seed 5 ราย, ไม่มี audit log ของลูกค้าทดสอบ

## 9. วิธีทดสอบด้วยมือ

ให้ PostgreSQL และ dev server ทำงานก่อน:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

1. Login Admin เปิด `/customers` ตรวจรายชื่อ seed 5 คนและ summary
2. ค้นหาด้วย `สมชาย` และ `081-234-5678` ต้องพบลูกค้าเดียวกัน
3. เปิด `/customers/new` กรอกเบอร์ `081-234-5678` ต้องถูก reject ว่าเบอร์ถูกใช้งานแล้ว
4. เปลี่ยนเป็นเบอร์ใหม่และสร้างลูกค้า ต้องพาไปโปรไฟล์พร้อมข้อความสำเร็จ
5. แก้ไขชื่อ/ที่อยู่/เลขผู้เสียภาษี และตรวจว่าแสดงผลถูกต้อง
6. กดเก็บลูกค้าถาวร ต้องยืนยันและพาไปรายการ archived
7. เปิดโปรไฟล์ archived และกดกู้คืน ต้องกลับมาใช้งานได้
8. Login Technician ตรวจว่าค้นหา/ดู/เพิ่มลูกค้าได้ แต่ไม่มีปุ่มแก้ไขหรือเก็บถาวร
9. เปิด `/customers/[id]/edit` ด้วย Technician ต้องไป `/forbidden`
10. เปิดโปรไฟล์ลูกค้า archived ด้วย Technician ต้องได้ 404
11. ย่อหน้าจอ 390px ตรวจว่าไม่มี horizontal overflow

## 10. ข้อจำกัดและงานที่ยังไม่ทำ

- ยังไม่มี pagination; รายชื่อจำกัด 200 ราย และประวัติบิล 20 รายการล่าสุด
- ยังไม่มีระบบรวมลูกค้าซ้ำ (merge) หรือประวัติการแก้ไขแบบ timeline
- ยังไม่มี CSV import/export สำหรับลูกค้า
- ยังไม่มีหน้าดู audit log สำหรับผู้ใช้
- ตรวจเฉพาะรูปแบบเลขผู้เสียภาษี 13 หลัก ยังไม่ตรวจ checksum
- รองรับเฉพาะเบอร์โทรไทย ไม่มีเบอร์ต่างประเทศหรือเบอร์ต่อ
- ยังไม่มีรูปโปรไฟล์ ที่อยู่หลายแห่ง หรือช่องทางติดต่ออื่น
- ประวัติการซื้อจะสมบูรณ์เมื่อ Phase 5 สร้างบิลจริง; ประวัติประกัน/เคลมจะต่อใน Phase 7
- ปุ่มเปิดบิลใหม่จากโปรไฟล์ลูกค้าจะเพิ่มใน Phase 5
- `npm audit` ยังพบ high vulnerabilities ใน development tooling (9 รายการ) — defer ไป Phase 9
- CSP/HSTS แบบเต็มยัง defer ไป Phase 9
- Phase 2 และ Phase 3 ยังรออนุมัติอย่างเป็นทางการ

## 11. ก่อนเริ่ม Phase 5 — Bills

Phase 5 ต้องใช้:

- `Customer` ที่ active สำหรับเลือกในบิล และตรวจ not archived ที่ server
- รูปแบบ service/action/validation และ audit จาก Phase 2–4
- `BillType` prefixes `INV`, `RPR`, `SVC`, `CLM`
- workflow `DRAFT → PENDING_APPROVAL → APPROVED / REJECTED → PAID / VOIDED`
- การตัดสต๊อกเมื่ออนุมัติและคืนสต๊อกเมื่อยกเลิก
- หน้ารายละเอียดลูกค้าที่มีอยู่ เพื่อแสดงประวัติบิลจริงและลิงก์ไปยังบิล
- การตัดสินใจว่า Admin อนุมัติบิลของตัวเองได้หรือไม่

**หยุดรอตรวจ Phase 4 ก่อนเริ่ม Phase 5**
