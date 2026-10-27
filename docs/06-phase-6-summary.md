# Phase 6 — Commissions และ Payouts

> สถานะ: **เสร็จสิ้น รอตรวจ** — Phase 5 ผ่านการตรวจแล้ว; Phase 2–3 ยังรออนุมัติอย่างเป็นทางการตามบันทึกเดิม

## 1. สรุปสิ่งที่ทำเสร็จ

- เพิ่มกติกาค่าคอมมิชชั่น 3 แบบ: เปอร์เซ็นต์จากยอดขายก่อน VAT, เปอร์เซ็นต์จากกำไรหลังต้นทุน และจำนวนคงที่ต่อบิล
- กำหนดขอบเขตกติกาตามช่างเทคนิค ประเภทบิล และหมวดหมู่สินค้า พร้อม priority และช่วงวันที่มีผล
- เลือกกติกาเพียงข้อเดียวต่อบิลตอนอนุมัติ และ snapshot กติกา ฐานคำนวณ ต้นทุน ยอดขาย และผลคำนวณลงใน `CommissionEntry`
- ผูกการสร้าง earning เข้ากับ transaction อนุมัติบิล และผูก reversal เข้ากับ transaction ยกเลิกบิล
- เพิ่มรายการกลับรายการติดลบแยกแทนการลบหรือแก้รายการเดิม รองรับทั้ง earning ที่ยังไม่จ่ายและจ่ายแล้ว
- เพิ่มรอบจ่ายที่รวมยอดค้างทั้งหมดถึงวันสิ้นสุดรอบ รวมยอดยกมาและยอด reversal
- เพิ่มหน้า `/commissions` สำหรับ Admin และ Technician พร้อม filter, summary, ledger, payout history และ CSV export
- เพิ่มหน้าจัดการกติกาและรอบจ่ายสำหรับ Admin รวมถึงหน้ารายละเอียดรอบจ่ายสำหรับ Admin และเจ้าของรอบ
- เพิ่ม migration ที่อนุญาตให้ `CommissionPayoutItem.amount` ติดลบ เพื่อรองรับ reversal ในรอบจ่าย
- เพิ่ม unit/integration tests, production build และ browser validation ครบทั้ง Admin และ Technician

Phase นี้ใช้โมเดล `CommissionRule`, `CommissionEntry`, `CommissionPayout` และ `CommissionPayoutItem` ที่มีอยู่ตั้งแต่ Phase 1; ไม่ได้สร้างตารางใหม่

## 2. Route และ UI

| Route | หน้าที่ |
|---|---|
| `/commissions` | Summary, ledger, ตัวกรอง, รอบจ่ายล่าสุด และปุ่ม Admin |
| `/commissions/rules` | รายการกติกา (Admin) |
| `/commissions/rules/new` | สร้างกติกา (Admin) |
| `/commissions/rules/[id]` | แก้ไข/เปิดปิดกติกาและประวัติ snapshot (Admin) |
| `/commissions/payouts` | สร้างรอบจ่ายและประวัติรอบจ่าย (Admin) |
| `/commissions/payouts/[id]` | รายละเอียดรอบจ่าย; Technician เปิดได้เฉพาะของตัวเอง |
| `/api/commissions/export` | CSV ตาม filter; Admin เท่านั้น |

UI หลักเป็นภาษาไทย ใช้ตารางแบบ horizontal scroll ภายใน container บนจอแคบ และทดสอบแล้วที่ 390px กับ 1440px โดยไม่มี horizontal overflow ระดับหน้า

## 3. การเลือกกติกาและการคำนวณ

### ตัวเลือกกติกา

1. กติกาต้อง `isActive = true`
2. `effectiveFrom <= approvedAt` และ `effectiveTo` ว่างหรือ `>= approvedAt`
3. ขอบเขตต้องตรงกับบิล:
   - `technicianId` ว่างหรือตรงกับเจ้าของบิล
   - `billTypeId` ว่างหรือตรงกับประเภทบิล
   - `categoryId` ว่างหรือมีสินค้าในบิลอยู่ในหมวดนั้น
4. เรียงตาม specificity: ช่าง = 4, ประเภทบิล = 2, หมวดหมู่ = 1
5. ถ้า specificity เท่ากัน ใช้ priority มากกว่า, `effectiveFrom` ใหม่กว่า, `createdAt` ใหม่กว่า และ `id` น้อยกว่า
6. ใช้กติกาแรกเพียงข้อเดียวต่อบิล

> **รอยืนยัน:** กติกาที่ระบุหมวดหมู่ยังใช้ฐานทั้งบิล ไม่ได้คำนวณเฉพาะรายการในหมวดหมู่ นโยบายนี้ต้องยืนยันก่อน Phase ถัดไป

### ฐานคำนวณ

| ประเภท | ฐาน | สูตร |
|---|---|---|
| `PERCENT_REVENUE` | `netAmountBeforeVat` หลังหักส่วนลดทั้งหมด | ฐาน × อัตรา ÷ 100 |
| `PERCENT_PROFIT` | `netAmountBeforeVat` − ต้นทุน snapshot | max(0, ฐานกำไร) × อัตรา ÷ 100 |
| `FIXED_PER_BILL` | ยอดคงที่ | จำนวนเงินที่กำหนด |

- ต้นทุน snapshot คือ `sum(unitCost × quantity)` ของรายการบิล ณ เวลาอนุมัติ
- อัตราเปอร์เซ็นต์ต้องอยู่ 0–100, อัตรา/จำนวนสูงสุด 4 ตำแหน่งทศนิยม
- ยอดเงินปัดแบบ `ROUND_HALF_UP` ที่ 2 ตำแหน่ง และคำนวณด้วย Decimal.js ทั้งหมด
- กำไรติดลบให้ commission เป็น 0 ไม่สร้างยอดติดลบใน earning
- หนึ่งบิลมี earning entry เดียว (`billItemId = null`)
- Phase 6 ไม่มีกติกา seed และไม่ backfill บิลที่อนุมัติก่อนมีกติกา; ภายหลัง demo seed เพิ่มกติกาตัวอย่าง 7 ข้อ (ดู README)

### Snapshot

`CommissionEntry.ruleSnapshot` เก็บ:

- id/ชื่อ/คำอธิบาย/ประเภท/อัตรา/priority/specificity ของกติกา
- ขอบเขตช่าง ประเภทบิล หมวดหมู่ และช่วงวันที่มีผล
- เลขบิล ประเภทบิล ช่าง ยอดก่อน VAT, VAT, grand total, ส่วนลด, ต้นทุน, หมวดหมู่ และรายการสินค้า
- ฐาน ต้นทุน อัตรา และ commission ที่คำนวณได้
- เวลาที่อนุมัติ

การแก้ไขหรือปิดกติกาภายหลังไม่เปลี่ยน snapshot ของรายการเดิม

## 4. Approval และ Void

### Approval

- เรียก `createCommissionEntryForApprovedBill` ภายใน transaction เดียวกับ approve
- ตรวจ existing earning ก่อนเพื่อให้ approve ซ้ำไม่สร้าง entry ซ้ำ
- ถ้าไม่มีกติกาที่เข้าเงื่อนไข จะอนุมัติบิลได้ตามปกติแต่ไม่เกิด commission entry
- เขียน `AuditLog` action `COMMISSION_EARNED`
- earning เริ่มสถานะ `PENDING`

### Void

- เรียก `reverseCommissionForBill` ภายใน transaction เดียวกับ void
- ค้นหา earning ที่ยังไม่ `REVERSED` และยังไม่มี reversal
- เปลี่ยน earning เดิมเป็น `REVERSED` พร้อม `reversedAt`
- สร้าง `CommissionEntry` ชนิด `REVERSAL` ยอดติดลบ สถานะ `PENDING` และอ้าง `reversalOfId`
- รายการเดิมที่จ่ายแล้วยังคงผูกกับ payout เดิม; reversal จะถูกหักในรอบถัดไป
- Snapshot ของ reversal เก็บข้อมูลการ void เหตุผล เวลาและ payout เดิม
- เขียน `AuditLog` action `COMMISSION_REVERSED`

## 5. รอบจ่ายและการกลับรายการ

- Admin เลือกช่าง วันเริ่มรอบ และวันสิ้นสุดรอบ
- ระบบรวม entry `PENDING` ทั้งหมดของช่างที่มี `earnedAt <= periodEnd` ไม่จำกัดเฉพาะ `periodStart`
- `periodStart` ที่บันทึกจริงจะขยับไปวันของ entry เก่าสุดถ้า entry เก่ากว่าวันที่ Admin เลือก
- ถ้ายอดสุทธิรวมติดลบ ระบบบล็อกการสร้างรอบจ่ายและแจ้งยอด/จำนวนรายการ
- ถ้ายอดสุทธิเป็น 0 หรือบวก ระบบสร้าง payout สถานะ `PAID` ทันที พร้อม `paidAt` และ `paidById`
- `CommissionPayoutItem.amount` เก็บยอดจริงของแต่ละ entry รวมยอดติดลบ; migration ใหม่ได้ drop check constraint ที่บังคับค่าบวก
- รายการที่รวมในรอบถูกเปลี่ยนเป็น `PAID`; payout ที่สร้างแล้วไม่ถูกลบหรือแก้ย้อนหลัง
- Void หลังจ่ายแล้วจะไม่แก้ยอด payout เดิม แต่สร้าง negative entry รอหักในรอบถัดไป
- รอบจ่ายใช้ sequence `PAY-ปี พ.ศ.-ลำดับ 6 หลัก`

## 6. สิทธิ์การใช้งาน

| ความสามารถ | Admin | Technician |
|---|---|---|
| ดู ledger/commission ของตัวเอง | ✅ | ✅ |
| ดู commission ของทุกคน | ✅ | ❌ |
| สร้าง/แก้ไข/เปิดปิดกติกา | ✅ | ❌ |
| สร้างรอบจ่าย | ✅ | ❌ |
| ดูรายการรอบจ่ายทั้งหมด | ✅ | ❌ |
| ดู payout detail ของตัวเอง | ✅ | ✅ |
| ดู payout detail ของคนอื่น | ✅ | ❌ (404) |
| Export CSV | ✅ | ❌ (403) |

การป้องกันมีทั้ง page guard, Server Action และ service layer; การซ่อนเมนู/ปุ่มเป็นเพียง UX

## 7. CSV Export

- Route: `GET /api/commissions/export`
- รองรับ filter `technicianId`, `status`, `kind`, `billId`, `from`, `to`
- Technician ได้ `403`; ผู้ที่ยังไม่ login ได้ `401`
- ใช้ BOM เพื่อเปิดใน Excel, ใส่ `Cache-Control: no-store`, `nosniff` และ `noindex`
- ข้อความถูก quote และป้องกัน spreadsheet formula injection
- ค่าติดลบที่เป็นตัวเลขล้วนคงรูป เช่น `-20.00` เพื่อให้ SUM ใช้งานได้
- จำกัด 500 แถวตามรายการ ledger

## 8. Audit Log

Phase 6 เพิ่ม action:

- `COMMISSION_RULE_CREATED`
- `COMMISSION_RULE_UPDATED`
- `COMMISSION_RULE_ACTIVATED`
- `COMMISSION_RULE_DEACTIVATED`
- `COMMISSION_EARNED`
- `COMMISSION_REVERSED`
- `COMMISSION_PAYOUT_CREATED`

Audit เก็บ actor, entity, before/after ที่เกี่ยวข้อง และเขียนใน transaction เดียวกับข้อมูลธุรกิจ

## 9. Migration

`prisma/migrations/20261022220000_commission_payout_signed_items/migration.sql`

- Drop constraint `CommissionPayoutItem_amount_non_negative_check`
- คง constraint ที่บังคับ `CommissionPayout.totalAmount >= 0`
- คง constraint ที่บังคับ earning ไม่ติดลบและ reversal ต้องติดลบ

## 10. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/commission-calculations.ts` | เลือกกติกา specificity, ฐานคำนวณ และปัดยอด |
| `src/lib/commission-labels.ts` | label, วันที่แบบ Bangkok, ปี พ.ศ. |
| `src/lib/csv.ts` | CSV escape ที่คงตัวเลขติดลบ |
| `src/server/services/commissions.ts` | rule CRUD, snapshot, reversal, payout, summary, CSV |
| `src/server/services/bills.ts` | เรียก commission ใน approve/void transaction และโหลดรายการใน bill detail |
| `src/server/actions/commissions.ts` | Server Actions และ error mapping |
| `src/server/validators/commissions.ts` | Zod schema สำหรับกติกาและรอบจ่าย |
| `src/server/services/commission-error.ts` | Domain error |
| `src/components/commissions/commission-rule-form.tsx` | ฟอร์มสร้าง/แก้ไขกติกา |
| `src/components/commissions/commission-rule-status-form.tsx` | เปิด/ปิดกติกา |
| `src/components/commissions/commission-payout-form.tsx` | สร้างรอบจ่าย |
| `src/components/commissions/commission-status-badges.tsx` | badge สถานะ entry/payout |
| `src/app/(app)/commissions/page.tsx` | Ledger, summary, filter และรอบจ่ายล่าสุด |
| `src/app/(app)/commissions/rules/**` | หน้าจัดการกติกา |
| `src/app/(app)/commissions/payouts/**` | หน้าจัดการและรายละเอียดรอบจ่าย |
| `src/app/(app)/bills/[id]/page.tsx` | แสดง commission snapshot ในบิล |
| `src/app/api/commissions/export/route.ts` | CSV endpoint |
| `tests/unit/commission-calculations.test.ts` | unit tests 15 tests |
| `tests/integration/commission-service.test.ts` | integration tests 8 tests |

## 11. ผลตรวจสอบ

รันเมื่อเสร็จ Phase 6:

```text
npm run typecheck  → ผ่าน
npm run lint       → ผ่าน
npm test           → 17 ไฟล์, 122 tests ผ่านทั้งหมด
npm run build      → ผ่าน
```

ชุดทดสอบใหม่:

- `tests/unit/commission-calculations.test.ts` — 15 tests:
  - เปอร์เซ็นต์ยอดขาย เปอร์เซ็นต์กำไร กำไรติดลบ จำนวนคงที่ และการปัดเศษ
  - specificity, priority, category match, effective dates และ tie-breaker
  - validator อัตรา/ช่วงวัน/รอบจ่าย
- `tests/integration/commission-service.test.ts` — 8 tests:
  - ไม่สร้าง entry เมื่อไม่มีกติกาที่เข้าเงื่อนไข
  - snapshot ฐาน ต้นทุน และกติกา
  - แก้กติกาแล้ว snapshot เก่าไม่เปลี่ยน
  - รอบจ่ายปิด entry และป้องกันรอบว่าง
  - RBAC และการแยกข้อมูลช่าง
  - เลือกกติกาที่เฉพาะเจาะจงกว่า
  - void หลังจ่ายแล้วสร้าง negative pending และหักในรอบถัดไป
  - CSV scoped export และ technician forbidden
- `tests/unit/csv.test.ts` — เพิ่มการตรวจว่าค่าติดลบยังเป็นตัวเลขและ formula ที่เริ่มด้วย `-` ยังถูก neutralize

Browser validation ด้วย Chrome headless: **55 checks ผ่านทั้งหมด**

- Admin dashboard/nav และหน้า commissions
- สร้างกติกา 2% ผูกช่าง + ประเภทบิลบริการ
- เปิด/ปิด/เปิดกติกาซ้ำ
- สร้างบิลบริการ 1,000 บาท ส่ง อนุมัติ และเห็นค่าคอม 20 บาท
- บันทึกชำระเงินและปิดรอบจ่าย `PAY-...`
- ดู payout detail และ CSV
- Void หลังจ่ายแล้ว เห็น reversal ติดลบและยอด pending สุทธิ -20
- Technician เห็นเฉพาะของตน, ถูก redirect จากหน้า Admin, CSV 403 และ payout ของคนอื่น 404
- Mobile 390px ไม่มี horizontal overflow
- ไม่มี console error หรือ server 5xx

ข้อมูลทดสอบ:

- ลบกติกา บิลบริการ และ payout ที่ browser validation สร้างทั้งหมดแล้ว
- ไม่แตะข้อมูลบิลที่ผู้ใช้สร้าง; ณ เวลาสรุปยังพบบิลผู้ใช้ `INV-2569-000001` และ `INV-2569-000002` สถานะ `PAID` โดยไม่มี commission entry จากการ backfill
- Sequence ของบิลบริการและรอบจ่ายถูกเลื่อนจากเอกสารทดสอบ แต่ไม่มีการ reset หรือลบ `DocumentSequence`

## 12. วิธีทดสอบด้วยมือ

ให้ PostgreSQL และ dev server ทำงานก่อน:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

1. Login Admin เปิด `/commissions` ตรวจ empty state, summary และปุ่มกติกา/รอบจ่าย/CSV
2. เปิด `/commissions/rules/new` สร้างกติกา 2% จากยอดขาย ผูกช่างและบิลบริการ
3. ตรวจรายการกติกาและเปิด/ปิดกติกาซ้ำ
4. สร้างบิลบริการ 1,000 บาทให้ช่างคนนั้น ส่ง อนุมัติ แล้วตรวจ snapshot และยอด 20.00
5. เปิด `/commissions` ตรวจ entry `รอจ่าย` และยอดสุทธิ
6. เปิด `/commissions/payouts` เลือกช่างและช่วงรอบที่ครอบรายการ แล้วสร้างรอบจ่าย
7. ตรวจ payout detail, รายการ และสถานะ `จ่ายแล้ว`
8. กลับไปที่บิล ยกเลิกบิลหลังจ่ายค่าคอม พร้อมเหตุผล
9. ตรวจบิลและ ledger ว่า earning เดิมเป็น `ถูกกลับรายการ` และมี reversal `-20.00` รอจ่าย
10. ลองสร้างรอบจ่ายใหม่ตอนยอดติดลบ ต้องถูกปฏิเสธ; สร้างค่าคอมใหม่ให้ยอดกลบแล้วจึงสร้างรอบจ่ายได้
11. ดาวน์โหลด CSV จาก `/api/commissions/export` ตรวจเลขบิลและยอดลบ
12. Login Technician เจ้าของ ตรวจว่าเห็นเฉพาะของตัวเองและไม่มีปุ่ม Admin
13. Login Technician อีกคน เปิด payout detail ของคนแรกตรง ๆ ต้องได้ 404
14. ตรวจ `/commissions` และ `/commissions/rules/new` ที่ 390px ว่าไม่มี horizontal overflow

## 13. ข้อจำกัด งานที่ยังไม่ทำ และการตัดสินใจที่รอตรวจ

- **Category-scoped base:** กติกาหมวดหมู่ใช้ฐานทั้งบิล; ยังไม่ได้ยืนยันว่าต้องคำนวณเฉพาะ line items ในหมวดหรือไม่
- **No backfill:** บิลที่อนุมัติก่อนมีกติกาจะไม่มี commission entry; ไม่มีเครื่องมือ backfill
- **One entry per bill:** ยังไม่มี commission แยกรายสินค้า/รายการ หรือหลายกติกาต่อบิล
- **Rule deletion:** UI เปิด/ปิดกติกาเท่านั้น ไม่มี hard delete เพราะต้องรักษาประวัติ snapshot
- **Payout immutability:** ไม่มี void/แก้ไข payout; การแก้ไขต้องทำผ่านรายการ reversal หรือกระบวนการใหม่ในอนาคต
- **Negative payout:** รอบจ่ายที่ยอดสุทธิติดลบถูกบล็อกตามการตัดสินใจปัจจุบัน; ยังไม่มี workflow เรียกเก็บเงินคืน
- **Cumulative payouts:** รอบจ่ายดึงยอดค้างก่อนหน้าและยอด reversal ทั้งหมดถึง `periodEnd`; `periodStart` ขยับอัตโนมัติ
- **Pagination:** ledger จำกัด 500 รายการและ payout history 100 รอบ; pagination เลื่อนไป Phase 9
- **CSV scope:** export ใช้ข้อมูลสูงสุด 500 แถวตาม ledger และยังไม่มี export สรุปกำไร/ภาษี
- **E2E suite:** browser validation ใช้ script ชั่วคราว ไม่ได้ commit เป็น Playwright/Cypress
- **Layout:** ตรวจ 390px และ 1440px; 768px ใช้รูปแบบเดียวกับ desktop/tablet ที่มีอยู่
- **DocumentSequence:** การทดสอบเลื่อน sequence ของ `SVC` และ `PAY`; ไม่ reset เพราะห้ามลบ sequence ที่ผู้ใช้อาจอ้างอิง
- **Deployment/security:** CSP/HSTS, trusted proxy IP, dependency audit และ deployment runbook ยังอยู่ใน Phase 9
- **Auth.js:** ยังใช้ beta รุ่นที่ติดตั้งไว้
- **Physical printer:** ยังไม่ทดสอบ receipt/A4 printer จริง
