# KAIOAK TECH POS

เว็บแอปพลิเคชัน POS ภาษาไทยสำหรับร้าน KAIOAK TECH — ขายสินค้า งานซ่อม งานบริการ และเคลมสินค้า พร้อม workflow อนุมัติบิล สต๊อกระดับ Serial, ประกัน และค่าคอมมิชชั่น

> สถานะโปรเจกต์: **ทุก Phase (Phase 1 ถึง Phase 10) พัฒนาและทดสอบเสร็จสมบูรณ์ พร้อมขึ้นระบบ Production**

## แบรนด์และธีม

- **ชื่อร้าน:** KAIOAK TECH — แบรนด์แสดงจากข้อมูลร้านใน `/settings/shop` จึงเปลี่ยนได้โดยไม่ต้องแก้โค้ด
- **โลโก้:** ไฟล์เริ่มต้นอยู่ที่ `public/brand/kaioak-tech-mark.svg`; สามารถเปลี่ยนพาธโลโก้ได้ในหน้าตั้งค่าข้อมูลร้าน
- **โหมดสว่าง/มืด:** สลับได้จากปุ่มพระอาทิตย์/พระจันทร์ที่หัวแอป ระบบจำค่าที่เลือกใน `localStorage` และใช้ค่าจากระบบปฏิบัติการเมื่อยังไม่เคยเลือก
- **หน้าเข้าสู่ระบบ:** คง dark brand canvas เพื่อให้แบรนด์เด่นชัด ส่วนการ์ดฟอร์มปรับตามธีม
- **เอกสารพิมพ์:** A4, สลิป 80 มม. และป้ายบาร์โค้ดคงพื้นขาวเสมอ เพื่อความถูกต้องของเอกสาร

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- PostgreSQL 17 + Prisma ORM 7
- Auth.js (Credentials) + bcrypt
- Decimal.js สำหรับการเงินทุกจุด (ไม่ใช้ `number` คำนวณเงิน)
- Zod สำหรับ validation
- Vitest สำหรับ unit / integration test
- Docker Compose สำหรับ PostgreSQL ในเครื่อง

## ฟีเจอร์ที่พร้อมแล้ว

### Phase 1 — Foundation

- Prisma schema ครบ 25 ตาราง พร้อม enum, relation, index และ soft-delete fields
- Migration แรกพร้อม check constraint, trigram index สำหรับค้นหาชื่อ และ unique guard ของ Serial ที่ยัง active
- Seed ข้อมูล: Admin 1 คน, ช่าง 2 คน, สินค้า 20 รายการ (Serial 123 ชิ้น), ลูกค้า 5 คน, Supplier และ Bill Type
- Utility เงินบาทด้วย Decimal + unit test
- Docker Compose, environment validation และ scripts สำหรับฐานข้อมูล

### Phase 2 — Authentication + RBAC

- Login ด้วยอีเมล/รหัสผ่านผ่าน Auth.js Credentials และ bcrypt cost 12
- Session แบบ JWT cookie `httpOnly` พร้อม idle timeout 30 นาที และ absolute timeout 12 ชั่วโมง
- ตรวจ `isActive`, role และ `tokenVersion` กับฐานข้อมูลทุกครั้งที่เข้า route ที่ป้องกัน
- แยกสิทธิ์ `ADMIN` / `TECHNICIAN` ทั้งที่ proxy, layout, page และ server action
- จำกัด login ผิด 5 ครั้งต่อ 15 นาทีต่ออีเมล + IP โดยเก็บแบบ HMAC และใช้ PostgreSQL advisory lock
- หน้าจัดการผู้ใช้สำหรับ Admin: เพิ่ม แก้ไข เปลี่ยนบทบาท ตั้งรหัสผ่านใหม่ เปิด/ปิดใช้งาน
- หน้าเปลี่ยนรหัสผ่านของผู้ใช้เองที่ `/profile` ต้องยืนยันรหัสผ่านปัจจุบัน
- ป้องกันการปิดใช้งาน/ลดสิทธิ์ตัวเอง และป้องกันการปิดใช้งาน Admin คนสุดท้าย
- การเปลี่ยนบทบาท ปิดใช้งาน หรือตั้งรหัสผ่านใหม่ จะเพิ่ม `tokenVersion` และยกเลิก session เดิมทันที
- Audit log สำหรับ login สำเร็จ/ล้มเหลว/ถูกจำกัด และการจัดการผู้ใช้
- Security headers พื้นฐาน, safe redirect, validation ด้วย Zod และ UI ภาษาไทย responsive

### Phase 3 — Products + Inventory

- จัดการสินค้า หมวดหมู่ และผู้จัดจำหน่าย พร้อมเปิด/ปิดใช้งานและเก็บถาวรแบบไม่ลบประวัติ
- สร้าง SKU อัตโนมัติจากรหัสหมวดหมู่และลำดับถัดไป พร้อมตรวจรหัสซ้ำ
- รองรับบาร์โค้ดหลายรายการต่อสินค้า กำหนดบาร์โค้ดหลัก และตรวจ EAN-13 checksum / Code 128
- หน้าสินค้าแบบ barcode-first: สแกนแล้วกด Enter เพื่อเปิดสินค้าได้ทันที
- ใบรับสินค้า (Goods Receipt) แบบ immutable พร้อมรับเข้าแบบมี Serial และไม่มี Serial
- คำนวณต้นทุนเฉลี่ยถ่วงน้ำหนักจากใบรับและปรับสต๊อกเพิ่ม
- Stock ledger บันทึกทุกการเคลื่อนไหวพร้อมยอดคงเหลือ ณ เวลานั้น ผู้ทำรายการ และ audit log
- ปรับสต๊อกเข้า/ออกพร้อมเหตุผล; สินค้า Serial ต้องระบุ Serial ให้ครบและไม่ซ้ำทั้งระบบ
- รายงานสินค้าใกล้หมด จุดสั่งซื้อ และจำนวนที่แนะนำให้สั่งเพิ่ม
- นำเข้า/ส่งออก CSV แบบ all-or-nothing สูงสุด 500 แถว / 2 MB และไม่เปลี่ยนยอดสต๊อก
- พิมพ์ป้ายบาร์โค้ดขนาด 60 × 35 มม. บน A4 (สูงสุด 60 ดวง) ด้วย SVG จาก `bwip-js`
- แยกสิทธิ์เขียนข้อมูลสินค้า/สต๊อกเป็น Admin; Technician ดูสินค้าและสินค้าใกล้หมดได้โดยไม่เห็นต้นทุน

### Phase 4 — Customers

- หน้าค้นหาและรายชื่อลูกค้า รองรับชื่อ เบอร์โทร อีเมล และตัวกรองสถานะสำหรับ Admin
- เพิ่มลูกค้าใหม่ได้ทั้ง Admin และ Technician พร้อม validation ฝั่ง server
- โปรไฟล์ลูกค้าแสดงข้อมูลติดต่อ ที่อยู่ เลขผู้เสียภาษี หมายเหตุ และสถานะ
- Normalize เบอร์โทรไทยและป้องกันเบอร์ซ้ำ รวมถึงเบอร์ของลูกค้าที่เก็บถาวร
- Admin แก้ไข เก็บถาวร และกู้คืนลูกค้าได้โดยไม่ลบประวัติ
- Technician เห็นเฉพาะลูกค้าที่เปิดใช้งาน และไม่สามารถแก้ไขหรือเก็บถาวรได้
- ประวัติการซื้อ/บริการล่าสุดพร้อมยอดซื้อสะสม เชื่อมกับบิลจริงใน Phase 5
- Dashboard แสดงจำนวนลูกค้าและลูกค้าใหม่ใน 30 วัน
- Audit log สำหรับการสร้าง แก้ไข เก็บถาวร และกู้คืนลูกค้า

### Phase 5 — Bills + Approval + Stock

- บิล 4 ประเภท: ขายสินค้า (`SALE`), ซ่อม (`REPAIR`), บริการ (`SERVICE`) และเคลม (`WARRANTY_CLAIM`)
- หน้ารายการบิลพร้อม summary, ค้นหา และตัวกรองตามสถานะ/ประเภท/ช่าง
- ฟอร์มเปิดบิลแบบ barcode-first: สแกนซ้ำเพิ่มจำนวน, เลือก Serial, เพิ่มสินค้า/บริการ, ส่วนลดรายการและท้ายบิล
- เลขบิลอัตโนมัติ `INV/RPR/SVC/CLM-ปี พ.ศ.-ลำดับ 6 หลัก` โดยแยก sequence ตาม prefix และปี
- Workflow ครบ `DRAFT → PENDING_APPROVAL → APPROVED / REJECTED → PAID / VOIDED` พร้อมประวัติสถานะ
- ตรวจสต๊อกตอนส่งอนุมัติ แต่ตัดสต๊อกจริงเมื่อ Admin อนุมัติเท่านั้น
- Approve ผูก Serial, บันทึกต้นทุนเฉลี่ย, วันขาย และวันเริ่ม/สิ้นสุดประกันใน transaction เดียว
- Void บิลที่อนุมัติหรือชำระแล้วได้ พร้อมคืนสต๊อก Serial และสร้าง stock movement กลับรายการ
- บิลซ่อมบังคับอาการเสีย; บิลเคลมตรวจประวัติซื้อจริงและบังคับ override เมื่อไม่พบ/หมดประกัน
- Admin เท่านั้นที่อนุมัติ ตีกลับ รับชำระ และยกเลิก; Technician เห็นและแก้เฉพาะบิลของตัวเอง
- Dashboard แสดงบิลรออนุมัติและบิลล่าสุด; โปรไฟล์ลูกค้าแสดงประวัติบิลจริง
- Audit log และ status history สำหรับทุกการเปลี่ยนสถานะ

### Phase 6 — Commissions + Payouts

- กติกาค่าคอมมิชชั่นแบบเปอร์เซ็นต์ยอดขาย เปอร์เซ็นต์กำไร หรือจำนวนคงที่ต่อบิล
- กำหนดขอบเขตได้ตามช่าง ประเภทบิล และหมวดหมู่สินค้า พร้อมลำดับความสำคัญและช่วงวันที่มีผล
- เลือกกติกาเพียงข้อเดียวต่อบิลตอนอนุมัติ โดยเรียงตามความเฉพาะเจาะจงแล้วจึงใช้ priority และวันที่มีผลล่าสุด
- Snapshot กติกา ฐานคำนวณ ต้นทุน ราคา และผลคำนวณไว้กับรายการค่าคอมทุกครั้ง
- คำนวณจากยอดขายสุทธิก่อน VAT หลังหักส่วนลดทั้งหมด; กำไรใช้ต้นทุน snapshot ณ เวลาอนุมัติ
- Void บิลที่อนุมัติหรือชำระแล้วต้องกลับรายการค่าคอม; รายการเดิมถูกทำเครื่องหมาย `REVERSED` และสร้างรายการติดลบใหม่
- รอบจ่ายรวมรายการ `PENDING` ทั้งหมดถึงวันสิ้นสุดรอบ รวมยอดยกมาและยอดกลับรายการ; ห้ามปิดรอบเมื่อยอดสุทธิติดลบ
- หน้า `/commissions` สำหรับ Admin และ Technician พร้อมตัวกรอง/สรุป; Technician เห็นเฉพาะของตัวเอง
- หน้าจัดการกติกาและรอบจ่ายสำหรับ Admin, หน้ารายละเอียดรอบจ่าย และ CSV export สำหรับ Admin
- เงินใช้ Decimal ทุกจุด; อัตราเก็บ 4 ตำแหน่งและยอดจ่ายปัด 2 ตำแหน่ง
- Audit log สำหรับสร้าง/แก้ไข/เปิดปิดกติกา, earning, reversal และรอบจ่าย

### Phase 7 — Warranty Claims + Serial Lookup

- หน้า `/warranty` ค้นหาข้อมูลประกันจาก Serial Number
- แสดงวันเริ่ม/สิ้นสุดประกัน, สถานะประกัน (Active, Expiring Soon, Expired), ประวัติบิลซื้อจริง และประวัติการเคลม
- ป้องกันการเปิดบิลเคลมซ้ำซ้อน และระบบ Admin Override เมื่อหาประวัติบิลซื้อไม่พบ
- ตรวจสอบ Serial อัตโนมัติในขั้นตอนสร้างบิลเคลม

### Phase 8 — Dashboard & Reports

- Dashboard สรุปภาพรวมธุรกิจสำหรับ Admin: ยอดขายวันนี้/เดือนนี้, กำไรขั้นต้น, บิลรออนุมัติ, งานซ่อมค้าง
- Dashboard สำหรับ Technician: งานซ่อมของฉัน, บิลของฉัน, ค่าคอมมิชชั่นสะสม
- หน้ารายงานยอดขายรายเดือน `/reports` พร้อมสรุป 12 เดือน, กราฟเปรียบเทียบยอดขายและกำไรขั้นต้น (Bar Chart ซ้อน)
- คำนวณกำไรขั้นต้นจากบิลที่ชำระแล้ว (`PAID`) หักต้นทุนสินค้าจริงด้วย Decimal.js แม่นยำทุกจุด
- พิมพ์ใบเสร็จ/ใบกำกับภาษีทั้งขนาด A4 และ Thermal 80mm พร้อมการตั้งค่าข้อมูลร้าน (Shop Settings)

### Phase 9 — Audit Log, Pagination, Security & Deployment

- หน้า Audit Log กลางสำหรับ Admin (`/audit-logs`) พร้อมตัวกรองตามผู้กระทำ, Entity, Action และช่วงวันที่
- ระบบ Pagination แบบ URL-based รองรับการรักษา search parameters ในหน้ารายการบิล และหน้าความเคลื่อนไหวสต๊อก
- เสริมความปลอดภัยด้วย Content-Security-Policy (CSP) แบบเข้มงวด และ HSTS บน Production
- คู่มือการติดตั้งและขึ้นระบบบนสภาพแวดล้อม Production ([Deployment Runbook](docs/deployment-runbook.md))

## ความต้องการของระบบ

- Node.js 22 LTS หรือใหม่กว่า
- npm 10+
- Docker Desktop (สำหรับ PostgreSQL)

## เริ่มใช้งาน

1. ติดตั้ง dependencies

   ```bash
   npm install
   ```

2. สร้างไฟล์ environment และเติมค่า secret

   ```bash
   cp .env.example .env
   ```

   สร้าง password/secret แบบสุ่มได้ด้วย:

   ```bash
   openssl rand -base64 32
   openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24
   ```

   `DATABASE_URL` ต้องตรงกับ `POSTGRES_*` ที่ตั้งไว้ใน `.env`
   `AUTH_SECRET` ต้องยาวอย่างน้อย 32 ตัวอักษร และ `SEED_*` ใช้สำหรับสร้างผู้ใช้เริ่มต้นเท่านั้น

3. เริ่ม PostgreSQL

   ```bash
   docker compose up -d
   ```

4. สร้าง schema และ seed ข้อมูล

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. เริ่ม development server

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000) แล้วเข้าสู่ระบบด้วยบัญชีจาก `.env`

### บัญชีเริ่มต้น

Seed จะสร้างบัญชีตามอีเมลและรหัสผ่านใน `.env`:

- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — Admin
- `SEED_TECH1_EMAIL` / `SEED_TECH1_PASSWORD` — Technician 1
- `SEED_TECH2_EMAIL` / `SEED_TECH2_PASSWORD` — Technician 2

ระบบไม่ส่งอีเมลหรือรหัสผ่านอัตโนมัติ ผู้ดูแลต้องส่งข้อมูลให้ผู้ใช้ผ่านช่องทางที่ปลอดภัย

## สิทธิ์การใช้งาน

| Route | Admin | Technician |
|---|---|---|
| `/` (Dashboard) | ✅ | ✅ |
| `/profile` | ✅ | ✅ |
| `/settings/users*` | ✅ | ถูกพาไป `/forbidden` |
| `/customers`, `/customers/new` | ✅ | ✅ |
| `/customers/[id]` | ✅ | ✅ (เฉพาะ active) |
| `/customers/[id]/edit` | ✅ | ถูกพาไป `/forbidden` |
| `/bills`, `/bills/new` | ✅ | ✅ (เห็นเฉพาะบิลของตัวเอง) |
| `/bills/[id]` | ✅ | ✅ (เฉพาะบิลของตัวเอง) |
| `/bills/[id]/edit` | ✅ | ✅ (เฉพาะ Draft/Rejected ของตัวเอง) |
| Approve / Reject / Paid / Void | ✅ | ❌ |
| `/commissions` | ✅ | ✅ (เห็นเฉพาะของตัวเอง) |
| `/commissions/rules*` | ✅ | ถูกพาไป `/forbidden` |
| `/commissions/payouts` | ✅ | ถูกพาไป `/forbidden` |
| `/commissions/payouts/[id]` | ✅ | ✅ (เฉพาะรอบจ่ายของตัวเอง) |
| `/api/commissions/export` | ✅ | ถูกปฏิเสธ (403) |
| `/inventory` | ✅ | ✅ |
| `/inventory/products`, `/inventory/products/[id]` | ✅ | ✅ |
| `/inventory/products/new`, `/inventory/products/[id]/edit` | ✅ | ถูกพาไป `/forbidden` |
| `/inventory/products/[id]/label` | ✅ | ถูกพาไป `/forbidden` |
| `/inventory/low-stock` | ✅ | ✅ |
| `/inventory/receipts*` | ✅ | ถูกพาไป `/forbidden` |
| `/inventory/stock` | ✅ | ถูกพาไป `/forbidden` |
| `/inventory/import` | ✅ | ถูกพาไป `/forbidden` |
| `/inventory/categories*`, `/inventory/suppliers*` | ✅ | ถูกพาไป `/forbidden` |
| `/api/inventory/products/export` | ✅ | ถูกปฏิเสธ |
| `/forbidden` | ✅ | ✅ |

ทุก route และ Server Action ถูกตรวจที่ server; การซ่อนเมนูเป็นเพียงการปรับ UX ไม่ใช่ชั้นความปลอดภัย

## กติกาสินค้าและสต๊อก

- สินค้าและหมวดหมู่ที่ยังมีสินค้าใช้งานหรือมีสต๊อกอยู่จะเก็บถาวรไม่ได้
- ต้นทุนเฉลี่ยแก้ไขจากฟอร์มสินค้าไม่ได้; เปลี่ยนผ่านใบรับ/ปรับสต๊อก และ CSV เฉพาะสินค้าที่ยังไม่มีสต๊อก
- ใบรับสินค้าแก้ไขย้อนหลังไม่ได้ หากผิดพลาดให้ใช้การปรับสต๊อกพร้อมเหตุผล
- สินค้าที่ติดตาม Serial ต้องระบุจำนวน Serial ให้ตรงกับจำนวนรับเข้า/ปรับออก และ Serial ต้องไม่ซ้ำทั้งระบบ
- การปรับสต๊อกออกของสินค้า Serial จะเปลี่ยนสถานะ Serial เป็น `DISPOSED`
- การรับเข้า/ปรับสต๊อกทุกครั้งสร้าง `StockMovement` ใน transaction เดียวกับยอดคงเหลือ
- Technician เห็นจำนวนคงเหลือและข้อมูลสินค้า แต่ไม่เห็นต้นทุน มูลค่าสต๊อก หรือใบรับสินค้า
- Import CSV ตรวจทุกแถวก่อนบันทึก; ถ้ามีแถวผิดจะไม่บันทึกทั้งไฟล์
- ราคาขายเป็นราคารวม VAT ตามนโยบายร้าน; ระบบคำนวณ VAT พร้อมใช้งานแต่ปิดอยู่ตามค่าตั้งต้น

## กติกาลูกค้า

- เบอร์โทรบังคับและ unique ทั้งระบบ; รองรับมือถือ 10 หลัก, เบอร์บ้าน 9 หลัก และรูปแบบ `+66`
- เบอร์ถูก normalize เป็นตัวเลข national format เพื่อป้องกันลูกค้าซ้ำจากรูปแบบการพิมพ์ต่างกัน
- เบอร์ของลูกค้าที่เก็บถาวรยังคงจองอยู่ ต้องกู้คืนลูกค้าเดิมแทนการสร้างใหม่
- อีเมลไม่บังคับ ตรวจรูปแบบและจัดเก็บเป็นตัวพิมพ์เล็ก; เลขผู้เสียภาษีไม่บังคับและต้องมี 13 หลัก
- เก็บถาวรลูกค้าโดยตั้ง `isActive = false` และ `deletedAt`; ประวัติบิลไม่ถูกลบ
- Technician เห็นเฉพาะลูกค้าที่เปิดใช้งานและเพิ่มลูกค้าได้ แต่แก้ไข/เก็บถาวร/กู้คืนได้เฉพาะ Admin
- ประวัติการซื้อใน Phase 4 แสดงบิล `APPROVED`, `PAID`, `VOIDED`; ยอดซื้อสะสมไม่รวมบิลยกเลิก
- หน้ารายชื่อรองรับ Pagination แบบ URL-based

## กติกาบิลและเวิร์กโฟลว์

- แก้ไขบิลได้เฉพาะสถานะ `DRAFT` หรือ `REJECTED`; บิลที่รออนุมัติ/อนุมัติ/ชำระแล้วแก้ไม่ได้
- Technician เห็นและแก้เฉพาะบิลที่ตัวเองเป็นผู้รับผิดชอบ; Admin เห็นทุกบิล
- Admin สร้างบิลแทนช่างได้ และแก้ไขบิล Draft/Rejected ของช่างได้ (ยังรอยืนยันขอบเขตสิทธิ์นี้)
- Admin อนุมัติ/ตีกลับ/รับชำระ/ยกเลิกได้; Technician ทำได้เพียงส่งบิลของตัวเอง
- ตรวจสต๊อกและ Serial ตอน submit แต่ยังไม่ตัดสต๊อก; ตัดจริงตอน approve ภายใน transaction พร้อม row lock
- ถ้าสต๊อกหรือ Serial เปลี่ยนไประหว่างรออนุมัติ approve จะ rollback ทั้งหมดและแจ้งให้ตรวจสอบ
- Void บิล `APPROVED` หรือ `PAID` ได้ พร้อมคืนสต๊อกและ Serial; ต้องมีเหตุผล
- สินค้าที่ถูกเก็บถาวรจะทำให้ void ไม่ผ่านจนกว่าจะกู้คืนสินค้า
- บิลซ่อมต้องมีอาการเสียอย่างน้อย 3 ตัวอักษรก่อน submit
- บิลเคลมตรวจจากบิลซื้อจริงของลูกค้าคนเดียวกัน; ถ้าไม่พบหรือหมดประกัน Admin ต้องใส่เหตุผล override
- เงินคำนวณด้วย Decimal ที่ server; client เป็นเพียง preview; ราคาเป็นราคารวม VAT และ VAT ปิดตามค่าตั้งต้น
- Admin อนุมัติบิลที่ตัวเองสร้างได้ในเวอร์ชันนี้ (ยังรอการยืนยันนโยบาย four-eyes)
- Void บิลที่อนุมัติหรือชำระแล้วจะกลับรายการค่าคอมมิชชั่นด้วย; บิลที่ยกเลิกไม่มีสิทธิ์สร้าง earning ใหม่
- รายการบิลจำกัด 200 รายการและยังไม่มี pagination

## กติกาค่าคอมมิชชั่น

- Demo seed (`npm run db:seed`) สร้างกติกาตัวอย่าง 7 ข้อ (ดูหัวข้อย่อยด้านล่าง); base seed (`npm run db:seed:base`) ไม่สร้างกติกา และไม่ backfill บิลที่อนุมัติก่อนมีกติกา
- กติกาเลือกจากความเฉพาะเจาะจง: ช่าง (4) + ประเภทบิล (2) + หมวดหมู่ (1) จากนั้น priority มากกว่า, วันที่มีผลล่าสุด, วันสร้าง และ id
- กติกาต้องมีผล ณ เวลาอนุมัติ; กติกาที่ปิดใช้งานหรือยังไม่เริ่มมีผลจะไม่ถูกเลือก
- หนึ่งบิลได้หนึ่ง earning entry; กติกาที่ระบุหมวดหมู่จะถือว่าบิลเข้าเงื่อนไขเมื่อมีสินค้าในหมวดนั้น และปัจจุบันใช้ฐานทั้งบิล (รอยืนยัน)
- ฐานเปอร์เซ็นต์ยอดขาย = `netAmountBeforeVat` หลังหักส่วนลดทั้งหมด; ฐานกำไร = ฐานยอดขาย − ต้นทุน snapshot; กำไรติดลบให้ค่าคอมเป็น 0
- จำนวนคงที่ต่อบิลใช้ยอดที่กำหนดโดยตรง; อัตราเปอร์เซ็นต์ต้องอยู่ 0–100 และเก็บ 4 ตำแหน่ง
- earning เกิดเฉพาะตอน Admin อนุมัติภายใน transaction เดียวกับการตัดสต๊อก; การอนุมัติซ้ำไม่สร้าง entry ซ้ำ
- Void จะเปลี่ยน earning เดิมเป็น `REVERSED` และสร้าง entry ชนิด `REVERSAL` ยอดติดลบสถานะ `PENDING`; ไม่ลบประวัติและไม่แก้รอบจ่ายเดิม
- รอบจ่ายรวม entry `PENDING` ทั้งหมดที่มี `earnedAt <= periodEnd` รวมยอดค้างจากรอบก่อนและยอดติดลบ; `periodStart` ขยับไปวันของ entry เก่าสุดเมื่อจำเป็น
- ถ้ายอดสุทธิของรอบติดลบ ระบบไม่อนุญาตให้ปิดรอบ; ยอดศูนย์หรือบวกจะสร้าง payout สถานะ `PAID` ทันทีและปิด entry ที่รวมไว้
- เฉพาะ Admin สร้าง/แก้ไข/เปิดปิดกติกาและปิดรอบจ่าย; Technician เห็นเฉพาะ entry และ payout ของตัวเอง
- CSV export เฉพาะ Admin รองรับตัวกรองเดียวกับหน้า `/commissions`; ค่าติดลบยังคงเป็นตัวเลขและข้อความถูกป้องกัน formula injection

### กติกาตัวอย่างที่ demo seed สร้างให้

`npm run db:seed` สร้างกติกาต่อไปนี้ด้วย id คงที่ (`seed-commission-rule-*`) จึงรันซ้ำได้โดยไม่เกิดรายการซ้ำ และจะอัปเดตค่ากลับเป็นค่าเริ่มต้นของ seed ทุกครั้ง

| กติกา | ชนิด | ค่า | ขอบเขต | Specificity |
|---|---|---|---|---|
| ค่าคอมพื้นฐาน 2% จากยอดขาย | `PERCENT_REVENUE` | 2% | ทุกบิล | 0 |
| ค่าคอมงานบริการ 10% | `PERCENT_REVENUE` | 10% | ประเภทบิล `SERVICE` | 2 |
| ค่าคอมงานซ่อม 15% ของกำไร | `PERCENT_PROFIT` | 15% | ประเภทบิล `REPAIR` | 2 |
| ค่าคอมเคลมสินค้า 50 บาทต่อบิล | `FIXED_PER_BILL` | 50 บาท | ประเภทบิล `WARRANTY_CLAIM` | 2 |
| ค่าคอมช่างสมชาย - ขายสินค้า 3% | `PERCENT_REVENUE` | 3% | ช่างสมชาย + `SALE` | 6 |
| ค่าคอมช่างณัฐพล - งานซ่อม 20% ของกำไร | `PERCENT_PROFIT` | 20% | ช่างณัฐพล + `REPAIR` | 6 |
| ค่าคอมขายการ์ดจอ 15% ของกำไร | `PERCENT_PROFIT` | 15% | หมวดหมู่ `GPU` | 1 |

กติกาทั้งหมดมี `priority = 0` และเริ่มมีผลตั้งแต่วันที่ 1 มกราคมของปีที่รัน seed (เวลาไทย) จึงพร้อมใช้กับบิลที่อนุมัติหลังจากนั้น และถ้ามีกติกาที่ผู้ใช้สร้างใหม่กว่าด้วย specificity เท่ากัน กติกาของผู้ใช้จะชนะ tie-break ด้าน `effectiveFrom`

ตัวอย่างการเลือกกติกา (หนึ่งบิลใช้กติกาเดียว):

| สถานการณ์ | กติกาที่ถูกเลือก | ค่าคอม |
|---|---|---|
| บิล `SERVICE` ยอดก่อน VAT 1,000 บาท | งานบริการ 10% | 100.00 |
| บิล `SALE` ยอดก่อน VAT 10,000 บาท โดยช่างสมชาย | ช่างสมชาย + `SALE` 3% | 300.00 |
| บิล `SALE` ยอดก่อน VAT 10,000 บาท โดยช่างณัฐพล | พื้นฐาน 2% | 200.00 |
| บิล `SALE` ยอดก่อน VAT 10,000 บาท ต้นทุน 8,000 บาท โดยช่างณัฐพล และมีสินค้า `GPU` | การ์ดจอ 15% ของกำไร | 300.00 |
| บิล `REPAIR` กำไร 1,500 บาท โดยช่างสมชาย | งานซ่อม 15% | 225.00 |
| บิล `REPAIR` กำไร 1,500 บาท โดยช่างณัฐพล | ช่างณัฐพล + `REPAIR` 20% | 300.00 |
| บิล `WARRANTY_CLAIM` | เคลมสินค้า 50 บาท | 50.00 |

ตัวอย่างข้างต้นสมมติว่าฐานข้อมูลมีเฉพาะกติกาจาก seed; ถ้ามีกติกาอื่นอยู่ก่อน ผลจริงอาจต่างออกไปตาม specificity, priority และ `effectiveFrom`

ข้อควรระวัง: กติกาหมวดหมู่ `GPU` ใช้กำไรของ **ทั้งบิล** เมื่อบิลมีสินค้าในหมวดนั้นอย่างน้อยหนึ่งรายการ ไม่ได้คำนวณเฉพาะรายการการ์ดจอ และถ้าบิลเดียวกันตรงกับกติกาช่าง + ประเภทบิล (specificity 6) กติกานั้นจะชนะกติกาหมวดหมู่ (specificity 1)

## นโยบายความปลอดภัยของบัญชี

- รหัสผ่าน 12–64 ตัวอักษร, มีตัวอักษรอังกฤษและตัวเลขอย่างน้อยอย่างละ 1 ตัว, ไม่เกิน 72 ไบต์
- Login ผิดได้ 5 ครั้งต่อ 15 นาทีต่ออีเมล + IP; ครั้งที่ 6 จะถูกบล็อกชั่วคราว
- Session หมดอายุเมื่อไม่มีการใช้งาน 30 นาที และหมดอายุไม่เกิน 12 ชั่วโมงหลังเข้าสู่ระบบ
- ปิดใช้งานบัญชี เปลี่ยนบทบาท หรือตั้งรหัสผ่านใหม่ = session เดิมใช้ไม่ได้ทันที
- Admin ไม่สามารถปิดใช้งานหรือลดสิทธิ์ตัวเอง และระบบป้องกันการเหลือ Admin ที่ active เป็นศูนย์
- เปลี่ยนรหัสผ่านของตัวเองต้องยืนยันรหัสผ่านปัจจุบัน และจะออกจากระบบทุกอุปกรณ์
- Login, logout และการจัดการผู้ใช้ถูกบันทึกใน `AuditLog`
- CSP และ HSTS เสริมความปลอดภัยระดับองค์กรพร้อมใช้งาน

## Scripts

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | รัน production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit / integration tests |
| `npm run db:generate` | สร้าง Prisma Client |
| `npm run db:migrate` | สร้าง/ใช้ migration ใน development |
| `npm run db:seed` | Seed ข้อมูลตัวอย่าง (idempotent) |
| `npm run db:deploy` | ใช้ migration ใน production/CI |
| `npm run db:studio` | เปิด Prisma Studio |
| `npm run db:reset` | ล้าง DB และ migration แล้ว seed ใหม่ |

## การทดสอบ

ให้ PostgreSQL ทำงานก่อน แล้วรัน:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Integration test ใช้ฐานข้อมูล development ตาม `DATABASE_URL` และจะสร้าง/ลบผู้ใช้ สินค้า ลูกค้า ใบรับ บิล กติกาคอมมิชชั่น รอบจ่าย และความเคลื่อนไหวชั่วคราวด้วยตัวเอง ห้ามชี้ไปยังฐานข้อมูล production

ผลล่าสุด: **27 ไฟล์, 190 tests ผ่านทั้งหมด**, production build ผ่าน และ browser validation ผ่านทั้งโหมดสว่าง/มืดที่ความกว้าง 390px และ 1440px

### ทดสอบด้วยมือ

1. Login ด้วย Admin แล้วเปิด `/settings/users` สร้างผู้ใช้ใหม่และทดลองปิด/เปิดใช้งาน
2. Login ด้วย Technician แล้วเปิด `/settings/users` ต้องเห็นหน้า `/forbidden`
3. ใส่รหัสผ่านผิด 6 ครั้งจากอีเมลเดิม ต้องเห็นข้อความจำกัดการเข้าสู่ระบบ
4. เปลี่ยนรหัสผ่านที่ `/profile` ต้องถูกออกจากระบบ และ session ใน browser อื่นถูกยกเลิก
5. ให้ Admin ตั้งรหัสผ่านใหม่ให้ผู้ใช้ ต้องเห็นข้อความยืนยันและ session เดิมของผู้ใช้ถูกยกเลิก
6. Login ด้วย Admin เปิด `/inventory` และ `/inventory/products` สแกนบาร์โค้ดตัวอย่างแล้วกด Enter ต้องเปิดสินค้าที่ตรงกัน
7. สร้างหมวดหมู่ชั่วคราวและสินค้าใหม่โดยเว้น SKU ว่าง ระบบต้องสร้าง SKU ให้ พร้อมเพิ่มบาร์โค้ดที่สองและตั้งเป็นบาร์โค้ดหลัก
8. สร้างใบรับสินค้าที่ `/inventory/receipts/new` ทั้งสินค้า Serial และไม่ Serial ตรวจต้นทุนเฉลี่ยและยอดคงเหลือใน stock ledger
9. ปรับสต๊อกออกให้เหลือ 0 แล้วเก็บสินค้าถาวร; ต้องสำเร็จ และสินค้าที่มีสต๊อกต้องเก็บถาวรไม่ได้
10. นำเข้า CSV ที่มีแถวผิดหนึ่งแถว ต้องไม่มีสินค้าใดถูกบันทึก; ส่งออก CSV แล้วต้องเปิดใน Excel ได้และมี BOM
11. พิมพ์ป้ายบาร์โค้ดที่ `/inventory/products/[id]/label` ตรวจจำนวนดวงและหน้าตัวอย่างก่อนสั่งพิมพ์ A4
12. Login ด้วย Technician ต้องไม่เห็นเมนูรับสินค้า/สต๊อก/CSV และเปิด route เหล่านั้นตรง ๆ ต้องไป `/forbidden`
13. ตรวจ layout ที่ความกว้าง mobile 390px ว่าไม่มี horizontal overflow
14. เปิด `/customers` ค้นหาด้วย `สมชาย` และ `081-234-5678` ต้องพบลูกค้าเดียวกัน
15. สร้างลูกค้าด้วยเบอร์ซ้ำ ต้องเห็น validation ว่าเบอร์ถูกใช้งานแล้ว
16. สร้างลูกค้าใหม่ แก้ไข เก็บถาวร และกู้คืนด้วย Admin; ตรวจว่ารายการ archived แสดงหลังเก็บถาวร
17. Login Technician ต้องค้นหา/ดู/เพิ่มลูกค้าได้ แต่ไม่เห็นปุ่มแก้ไขหรือเก็บถาวร
18. Technician เปิด `/customers/[id]/edit` ต้องไป `/forbidden` และเปิดโปรไฟล์ archived ต้องได้ 404
19. ตรวจว่าโปรไฟล์ลูกค้าแสดงประวัติบิลจริงหลังสร้างบิลใน Phase 5 และยอดซื้อไม่รวมบิลยกเลิก
20. ตรวจ layout ลูกค้าที่ความกว้าง mobile 390px ว่าไม่มี horizontal overflow

### ทดสอบ Phase 5 — Bills

21. Login Admin เปิด `/bills` ตรวจ summary และ empty state
22. เปิดบิลใหม่ เลือกลูกค้าและช่าง สแกนบาร์โค้ดสินค้าไม่ติด Serial สองครั้ง ต้องเพิ่มจำนวนในรายการเดิม
23. สแกนสินค้าติด Serial เลือก Serial ให้ครบ เพิ่มค่าบริการและกรอกจำนวนเงิน ตรวจยอด preview แล้วบันทึก Draft
24. เปิดรายละเอียดบิล กดส่งขออนุมัติ ต้องเปลี่ยนเป็นรออนุมัติและสต๊อกยังไม่ลด
25. Admin กดอนุมัติ ต้องเห็นข้อความตัดสต๊อก; ตรวจสินค้าและ stock ledger ว่ายอดลดลงและ Serial เป็น `SOLD`
26. กดบันทึกชำระเงิน ต้องเปลี่ยนเป็นชำระแล้ว; กดยกเลิกบิลพร้อมเหตุผล ต้องคืนสต๊อกและ Serial
27. ตรวจว่าบิลที่ยกเลิกไม่มีปุ่ม action เหลือ และประวัติลูกค้าลิงก์กลับบิลได้
28. Login Technician สร้าง/ส่งบิลของตัวเอง ต้องไม่เห็นปุ่มอนุมัติ ตีกลับ รับชำระ หรือยกเลิก
29. Login Technician อีกคน เปิดบิลของ Technician คนแรกตรง ๆ ต้องได้ 404 ทั้ง detail และ edit
30. Admin ตีกลับบิลพร้อมเหตุผล; Technician เจ้าของแก้ไขและส่งใหม่ได้
31. สร้างบิลซ่อมโดยไม่อาการเสีย ต้องส่งไม่ผ่าน; กรอกอาการเสียแล้วจึงส่งได้
32. สร้างบิลเคลมจากสินค้าที่ลูกค้าซื้อจริง ต้องแสดงเลขบิลเดิม วันซื้อ และวันหมดประกัน
33. สร้างบิลเคลมที่ไม่มีประวัติซื้อ แล้วอนุมัติโดยไม่ใส่ override ต้องถูกปฏิเสธ
34. ตรวจ layout ที่ 390px, 768px และ 1440px ว่าไม่มี horizontal overflow ระดับหน้า และหน้าเปิดบิลไม่กระโดดลงไปที่ช่องสแกนบน mobile

### ทดสอบ Phase 6 — Commissions

35. Login Admin เปิด `/commissions` ต้องเห็นยอดรอจ่าย สรุป และลิงก์กติกา/รอบจ่าย/CSV
36. สร้างกติกาเปอร์เซ็นต์ยอดขาย 2% ระบุช่างและประเภทบิลบริการ แล้วปิด/เปิดใช้งานกติกา ตรวจว่าสถานะเปลี่ยนจริง
37. สร้างบิลบริการ 1,000 บาทให้ช่างคนนั้น ส่งและอนุมัติ ต้องเห็นการ์ดค่าคอม snapshot และยอด 20.00 บาท
38. บันทึกชำระเงิน เปิด `/commissions` ตรวจว่ารายการยังรอจ่ายและยอดสุทธิตรงกับบิล
39. สร้างรอบจ่ายให้ช่าง เลือกช่วงวันที่ครอบรายการ ต้องได้เลข `PAY-ปี พ.ศ.-ลำดับ` และรายการถูกปิดเป็นจ่ายแล้ว
40. กลับไปยกเลิกบิลที่จ่ายค่าคอมแล้ว ต้องเห็น earning เดิมเป็น `ถูกกลับรายการ` และมีรายการติดลบ `-20.00` รอจ่าย
41. ลองสร้างรอบจ่ายใหม่ขณะยอดสุทธิติดลบ ต้องถูกปฏิเสธ; สร้างค่าคอมใหม่ให้ยอดกลบแล้วจึงปิดรอบได้
42. ดาวน์โหลด CSV จาก `/api/commissions/export` ต้องมีเลขบิล ยอดบวก/ลบ และเปิดใน Excel ได้
43. Login Technician เจ้าของ ต้องเห็นเฉพาะค่าคอมและรอบจ่ายของตัวเอง; เปิดกติกาหรือรอบจ่ายหน้า Admin ต้องไป `/forbidden`
44. Login Technician อีกคน ต้องไม่เห็นรายการของช่างคนแรก และเปิด payout detail ตรง ๆ ต้องได้ 404
45. ตรวจ `/commissions` และฟอร์มกติกาที่ 390px ว่าไม่มี horizontal overflow ระดับหน้า

รายละเอียดผลทดสอบและข้อจำกัดอยู่ใน [Phase 6 Summary](docs/06-phase-6-summary.md), [Phase 5 Summary](docs/05-phase-5-summary.md), [Phase 4 Summary](docs/04-phase-4-summary.md) และ [Phase 3 Summary](docs/03-phase-3-summary.md)

## Environment Variables

| ตัวแปร | ใช้ใน |
|---|---|
| `DATABASE_URL` | Prisma runtime + migrations |
| `POSTGRES_*` | Docker Compose |
| `AUTH_SECRET` | เซ็น JWT และ HMAC ของ rate-limit key |
| `AUTH_URL` / `AUTH_TRUST_HOST` | Auth.js |
| `SEED_ADMIN_*`, `SEED_TECH1_*`, `SEED_TECH2_*` | Seed เท่านั้น |

ห้าม commit `.env`; ไฟล์จริงถูก ignore ไว้แล้ว และมีเฉพาะ `.env.example` ใน repository

## โครงสร้างหลัก

```text
prisma/
  schema.prisma
  migrations/
  seed.ts
src/
  app/                  # หน้าเว็บ App Router
  components/           # ui, layout, auth, users, customers, inventory, bills, commissions, forms
  lib/                  # db, money, labels, phone, csv, barcode, inventory/commission calculations
  server/
    auth/               # Auth.js guards, password, rate limit, session policy
    actions/            # Server Actions
    services/           # Business logic + transactions
    policies/           # RBAC / ownership (Phase ถัดไป)
    validators/         # Zod schemas
  generated/prisma/     # Prisma Client (generated, ไม่ commit)
tests/
  unit/
  integration/
  e2e/
docs/
```

## หลักการด้านข้อมูล

- เงินเก็บเป็น `Decimal(12,2)` และคำนวณด้วย Decimal.js; API ควรส่งค่าจำนวนเงินเป็น string
- `createdById` ถูกเก็บในทุกตารางธุรกิจเป็น audit reference โดยไม่ผูก FK เพื่อรักษาประวัติแม้ผู้ใช้ถูกปิดการใช้งาน
- ลูกค้า/สินค้าใช้ `deletedAt` และ `isActive`; ไม่ลบข้อมูลที่มีประวัติจริง
- Stock เปลี่ยนผ่าน `StockMovement` ใน transaction เท่านั้น; ห้ามแก้ยอดคงเหลือโดยตรง
- Serial หนึ่งชิ้นถูกผูกกับบิลที่ยัง active ได้ครั้งเดียวผ่าน partial unique index
- VAT เริ่มต้นปิด, ราคาเป็นแบบรวม VAT, อัตราเริ่มต้น 7% (ตามที่อนุมัติใน Phase 0)
- `User` ไม่ถูกลบเมื่อปิดใช้งาน เพื่อให้ audit และประวัติบิลยังอ้างอิงได้

## สถานะ Phase

- [x] Phase 0 — Design & ERD
- [x] Phase 1 — Setup, Prisma schema, migration, seed
- [x] Phase 2 — Auth + RBAC + User management (รออนุมัติอย่างเป็นทางการ)
- [x] Phase 3 — Products + Inventory (รออนุมัติอย่างเป็นทางการ)
- [x] Phase 4 — Customers (ผ่านการตรวจแล้ว)
- [x] Phase 5 — Bills + Approval + Stock deduction (ผ่านการตรวจแล้ว)
- [x] Phase 6 — Commissions (รอตรวจ)
- [x] Phase 7 — Warranty claims + Serial lookup
- [x] Phase 8 — Dashboard, reports, receipts
- [x] Phase 9 — Tests, security review, deployment docs
- [x] Phase 10 — Production launch readiness (backup, proxy hardening, mobile nav, DB maintenance)

## เอกสาร

- [Phase 0 — สรุปการออกแบบ](docs/00-phase-0-summary.md)
- [Phase 0 — ERD](docs/00-phase-0-erd.md)
- [Phase 1 — Setup และ Database](docs/01-phase-1-summary.md)
- [Phase 2 — Authentication และ RBAC](docs/02-phase-2-summary.md)
- [Phase 3 — Products และ Inventory](docs/03-phase-3-summary.md)
- [Phase 4 — Customers](docs/04-phase-4-summary.md)
- [Phase 5 — Bills, Approval และ Stock](docs/05-phase-5-summary.md)
- [Phase 6 — Commissions และ Payouts](docs/06-phase-6-summary.md)
- [Phase 7 — Warranty และ Claims](docs/07-phase-7-summary.md)
- [Phase 8 — Dashboard และ Reports](docs/08-phase-8-summary.md)
- [Phase 9 — Audit Log, Pagination และ Security](docs/09-phase-9-summary.md)
- [Phase 10 — Production Launch Readiness](docs/10-phase-10-summary.md)
- [คู่มือการติดตั้งและขึ้นระบบ (Deployment Runbook)](docs/deployment-runbook.md)
