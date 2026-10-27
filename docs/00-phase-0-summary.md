# Phase 0 — สรุปความเข้าใจและข้อเสนอสถาปัตยกรรม

> สถานะ: **รออนุมัติ** — ยังไม่เริ่มสร้างโค้ดหรือ migration
> เอกสาร ERD โดยละเอียด: `docs/00-phase-0-erd.md`

## 1. ขอบเขตที่เข้าใจ

สร้างเว็บ POS ภาษาไทยสำหรับร้านคอมพิวเตอร์แห่งเดียว (single shop) รองรับการขายอุปกรณ์ งานซ่อม งานบริการ และเคลมสินค้า โดยมี 2 บทบาท:

- **Technician:** เปิด/แก้บิลของตัวเองในสถานะ Draft, ส่งขออนุมัติ, ดูสินค้า/ลูกค้าแบบอ่านและเพิ่มลูกค้า, ดูค่าคอมของตัวเอง
- **Admin:** จัดการทุกอย่าง รวมถึงอนุมัติ/ปฏิเสธ/ยกเลิกบิล, สต๊อก, ราคาทุน, ผู้ใช้, กติกาคอมมิชชั่น, รายงาน และ audit log

หลักการสำคัญ:

- บังคับสิทธิ์ที่ server ทุกจุด; middleware เป็นเพียงด่านแรก
- จำนวนเงินเก็บเป็น `Decimal` และคำนวณด้วย Decimal เท่านั้น
- ทุก operation ที่แตะหลายตารางต้องอยู่ใน Prisma transaction เดียว
- ข้อมูลบัญชี/สต๊อกห้ามลบจริง; master data ใช้ soft delete/archive
- UI หลักเป็นภาษาไทย รองรับจอคอมและแท็บเล็ต โดยหน้าเปิดบิลเน้นคีย์บอร์ดและเครื่องยิงบาร์โค้ด

## 2. โครงสร้างโปรเจกต์ที่เสนอ

```text
src/
  app/
    (auth)/login/
    (app)/dashboard/
    (app)/bills/                  # list, new, [id], edit, print
    (app)/customers/
    (app)/products/
    (app)/inventory/              # stock, receipts, movements, low-stock
    (app)/commissions/            # summary, payouts, rules (admin)
    (app)/reports/
    (app)/settings/               # shop/VAT/bill types/users (ตามสิทธิ์)
    (app)/audit-logs/
    print/bills/[id]/a4/
    print/bills/[id]/thermal-80mm/
    api/auth/[...nextauth]/
    api/export/                   # CSV
  components/
    ui/                           # shadcn/ui
    layout/
    forms/
    pos/                          # barcode input, cart, payment panel
  server/
    auth/                         # auth config + guards
    actions/                      # server actions ต่อโดเมน
    services/                     # business logic + transaction
    policies/                     # RBAC/ownership rules
    validators/                   # Zod schemas
  lib/                            # prisma, money, date, rate-limit, barcode, csv
  types/
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/
  integration/
  e2e/
docs/
docker-compose.yml
.env.example
```

แนวนโยบาย:

- อ่านข้อมูลด้วย Server Components; เขียนผ่าน Server Actions
- Route Handler ใช้เฉพาะ Auth.js, ดาวน์โหลด CSV, และ endpoint ที่ต้องใช้จาก client โดยตรง
- ชั้น `services` เป็นที่เดียวที่เรียก Prisma สำหรับ business flow สำคัญ; UI ห้ามคำนวณยอดเงินเอง
- DTO ของ Technician ต้องตัด `costPrice/unitCost/กำไร` ออกก่อนส่งถึง client
- Auth.js Credentials + bcrypt, JWT cookie แบบ httpOnly; ตรวจ `isActive` และ role ซ้ำที่ server ทุก request สำคัญ
- Login rate limit และ audit การเข้าใช้งาน; ใช้ Postgres เป็นที่เก็บ rate-limit เพื่อให้ทำงานได้หลาย instance
- Zod ตรวจ input ทุก mutation; Prisma parameterized query; เพิ่ม security headers/CSP
- ใช้ `Asia/Bangkok` เป็น timezone หลัก และแสดงปี พ.ศ. ใน UI

## 3. การออกแบบกระบวนการทำงานที่เสนอ

### 3.1 สถานะบิล

```text
DRAFT ──submit(owner)──> PENDING_APPROVAL
                          ├──approve(admin)──> APPROVED ──mark paid──> PAID
                          └──reject(admin)───> REJECTED ──edit/resubmit──> PENDING_APPROVAL
APPROVED ──void(admin)──> VOIDED
PAID     ──void(admin)──> VOIDED
```

- แก้ไขได้เฉพาะ `DRAFT` และ `REJECTED` โดยเจ้าของบิล
- ส่งอนุมัติแล้วล็อกทันที; Admin ต้องใส่เหตุผลเมื่อปฏิเสธ
- Void ต้องเป็น Admin + ใส่เหตุผล + คืนสต๊อกถ้าเคยตัดแล้ว + กลับรายการคอมมิชชั่น
- ทุกการเปลี่ยนสถานะลง `BillStatusHistory` และ `AuditLog`

### 3.2 สต๊อกที่เสนอ

**ข้อเสนอหลัก:** ตรวจความพร้อมตอนส่งอนุมัติ แต่ **ตัดสต๊อกจริงเมื่อ APPROVED เท่านั้น** และไม่ทำ hold ในสถานะ Pending

เหตุผล: ตรงกับ requirement, ลดความซับซ้อนของ reservation/expiry, และบิลที่ถูกปฏิเสธไม่ทำให้สต๊อกถูกจองค้าง ข้อแลกเปลี่ยนคือของอาจถูกบิลอื่นใช้ไประหว่างรออนุมัติ จึงต้องตรวจซ้ำและ lock แถวสินค้า/Serial ใน transaction ตอนอนุมัติ หากชนกันให้ approve ไม่ผ่าน แล้ว Admin ตีกลับให้แก้

- ต้องเลือก Serial ตอนเพิ่มรายการที่ track serial; Serial จะถูกยืนยัน/ผูกกับบิลตอน approve
- กันสต๊อกติดลบด้วย row lock + เงื่อนไขใน transaction; ถ้าไม่พอให้ rollback ทั้งหมด
- Void สร้าง movement กลับรายการอ้างอิงบิลเดิม ไม่แก้ยอดเดิม
- รับสินค้าเข้าตัดผ่าน StockMovement เช่นกัน (ไม่มี direct update ยอดคงเหลือ)
- ค่าแรง/บริการที่กรอกเองไม่ตัดสต๊อก

### 3.3 คอมมิชชั่น

- คำนวณเฉพาะตอนบิลเป็น `APPROVED`; snapshot กติกา/อัตรา/ฐาน/ต้นทุน ณ ขณะนั้น
- Void หลังอนุมัติ: mark entry เดิมเป็น reversed และสร้าง entry ติดลบอ้างอิงรายการเดิม (ไม่ลบ)
- Payout เป็นรอบต่อช่าง; เฉพาะ entry ที่ยัง Pending และไม่ถูก reverse
- ฐานคอมที่เสนอ: ยอดขายสุทธิหลังส่วนลดทั้งหมด **ก่อน VAT**; กำไร = ฐานสุทธิ − ต้นทุน snapshot
- กติกาการเลือก rule เมื่อเข้าเงื่อนไขหลายข้อเป็นประเด็นให้ยืนยัน (ดูข้อ 4)

### 3.4 ประกันและเคลม

- Product เก็บ `warrantyMonths`; ตอน approve คำนวณและ snapshot วันหมดประกันลงรายการที่ขาย/Serial
- ถ้า track serial ต้องมี Serial ต่อหน่วย; ค้น Serial ย้อนกลับได้โดยไม่ต้องเลือกลูกค้า
- หน้าเคลม: ตรวจประวัติซื้อจริงจากบิล `APPROVED/PAID` ที่ไม่ถูก Void
- แสดงเลขบิลเดิม, วันที่ซื้อ, Serial, วันหมดประกัน, สถานะประกัน
- หากไม่พบประวัติ: แสดง warning ชัดเจน และบังคับให้ Admin ใส่เหตุผลยืนยันก่อนอนุมัติ
- เก็บผลการตรวจเป็น snapshot ในบิลเคลม เพื่อให้ย้อนตรวจภายหลังได้

### 3.5 เลขที่บิลและรายงาน

- เลขบิลออกตอนสร้าง Draft, รูปแบบเริ่มต้น: `INV-2569-000001`, `RPR-...`, `SVC-...`, `CLM-...`
- แยก sequence ตาม prefix + ปี พ.ศ.; เพิ่มประเภทบิลได้ผ่านตาราง `BillType` โดยกำหนด prefix ได้
- รายงานยอดขายเริ่มต้นนับบิล `APPROVED` และ `PAID` ที่ไม่ถูก Void; แสดงยอดรับชำระจริง (Paid) แยก
- กำไรขั้นต้น = รายได้สุทธิไม่รวม VAT − ต้นทุนสินค้า; ยังไม่หักค่าคอม

## 4. ข้อเสนอที่ยังต้องยืนยัน

1. **สต๊อก:** ใช้วิธี “ตรวจตอน submit / ตัดตอน approve / ไม่ hold” ตามข้อ 3.2 หรือต้องการจองของตั้งแต่ Pending?
2. **VAT:** ราคาที่กรอกเป็นราคารวม VAT หรือยังไม่รวม VAT? ค่าเริ่มต้นที่เสนอ: รวม VAT, อัตรา 7%, เริ่มระบบด้วย VAT ปิด จน Admin เปิดใน Settings
3. **ส่วนลด:** รองรับทั้งจำนวนเงินและเปอร์เซ็นต์ ทั้งระดับบรรทัดและท้ายบิลหรือไม่? ที่เสนอ: รองรับทั้งสองแบบ
4. **คอมมิชชั่น:** เมื่อเข้าเงื่อนไขหลาย rule พร้อมกัน ให้ใช้ “rule ที่ specific/priority สูงสุดเพียง rule เดียวต่อบิล” (แนะนำ) หรือคิดแยกตามหมวด/บรรทัดแล้วรวมหลาย rule?
5. **ผู้รับคอม:** บิลมี `technicianId` แยกจาก `createdBy`; Admin เปิดบิลแทนช่างได้ ค่าคอมคิดให้ผู้รับผิดชอบบิล แต่ถ้า Admin เปิดบิลเองจะไม่มีคอม หรือให้ Admin เลือกตัวเอง/ช่าง?
6. **การรับชำระ:** ให้เฉพาะ Admin กด `PAID` หรือให้เจ้าของบิล/ช่างกดได้? และอนุญาต Void บิลที่ Paid แล้วหรือไม่? ที่เสนอ: Admin เท่านั้น, Void ได้พร้อมกลับรายการคอม
7. **ต้นทุน:** ใช้ต้นทุนเฉลี่ยถ่วงน้ำหนักจาก Goods Receipt (แนะนำ) หรือใช้ต้นทุนล่าสุดของสินค้า?
8. **Login/session:** ใช้ email + password, idle timeout 30 นาที, absolute 12 ชั่วโมง, rate limit 5 ครั้ง/15 นาที ต่อ email+IP — ยืนยัน?
9. **สภาพแวดล้อม:** จะรัน local ด้วย Docker Compose Postgres หรือมี PostgreSQL อยู่แล้ว และเป้าหมาย deploy คือ Vercel + managed Postgres หรือ self-host?
10. **สิทธิ์ Admin:** Admin แก้เฉพาะบิล Draft ของตัวเอง แต่ดู/อนุมัติ/Void บิลคนอื่นได้ และอนุมัติบิลตัวเองได้หรือไม่?

## 5. สิ่งที่เสนอให้อยู่นอกขอบเขต MVP

- หลายสาขา/หลายร้าน (multi-tenant)
- ชำระเงินแบ่งหลายช่องทาง หรือ partial payment
- ระบบคืนสินค้า/คืนเงินหลังส่งมอบ (Void ใช้สำหรับยกเลิกทั้งบิล)
- เชื่อมต่อ e-Tax/ใบกำกับภาษีอิเล็กทรอนิกส์
- จัดส่ง/ใบเสร็จทางอีเมล
- ระบบ hold/reserve สต๊อกขั้นสูง (หากไม่เลือกในข้อ 1)

## 6. แผนดำเนินการหลังอนุมัติ

| Phase | ผลลัพธ์หลัก |
|---|---|
| 1 | Setup Next.js, Tailwind/shadcn, Prisma schema + migration, Docker, seed ตามจำนวนที่กำหนด |
| 2 | Auth.js, login/logout, session timeout, RBAC 2 ระดับ, จัดการผู้ใช้, rate limit, audit login |
| 3 | สินค้า/หมวด/บาร์โค้ด/SKU, Stock ledger, Goods receipt, low stock, CSV, label |
| 4 | ลูกค้า, ค้นหา, โปรไฟล์และประวัติการซื้อ |
| 5 | บิลทุกประเภท, รายการสินค้า/บริการ, barcode-first UI, workflow, ตัดสต๊อก, void, audit |
| 6 | Commission rules, คำนวณ/snapshot, payout, reversal, export CSV |
| 7 | Serial/warranty, ตรวจประวัติเคลม, serial lookup, admin override |
| 8 | Dashboard, รายงาน, พิมพ์ A4/80mm |
| 9 | Unit/integration tests ครบ, security review, README, deployment guide |

ทุก phase จะสรุปงานที่ทำ วิธีทดสอบ และสิ่งที่ค้าง ก่อนไป phase ถัดไป
