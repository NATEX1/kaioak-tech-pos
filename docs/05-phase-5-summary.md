# Phase 5 — Bills, Approval Workflow และ Stock Deduction

> สถานะ: **เสร็จสิ้นและผ่านการตรวจแล้ว** — Phase 6 ต่อยอด reversal และรอบจ่ายค่าคอมมิชชั่นแล้ว; Phase 2–3 ยังรออนุมัติอย่างเป็นทางการตามบันทึกเดิม

## 1. สรุปสิ่งที่ทำเสร็จ

- เพิ่มระบบบิล 4 ประเภท: ขายสินค้า (`SALE`), ซ่อม (`REPAIR`), บริการ (`SERVICE`) และเคลม (`WARRANTY_CLAIM`)
- เพิ่มรายการบิล ค้นหา/กรองตามสถานะ ประเภท ช่าง และข้อความ
- เพิ่มหน้าสร้าง/แก้ไขบิลแบบ barcode-first รองรับสินค้า บริการ Serial ส่วนลดรายการ และส่วนลดท้ายบิล
- เพิ่ม workflow `DRAFT → PENDING_APPROVAL → APPROVED / REJECTED → PAID / VOIDED`
- เพิ่มการตรวจสต๊อกตอน submit และตัดสต๊อกจริงภายใน transaction ตอน approve พร้อม row lock
- เพิ่มการคืนสต๊อกและ Serial เมื่อ void พร้อม stock movement กลับรายการและ audit history
- เพิ่มการตรวจประวัติซื้อสำหรับบิลเคลม, snapshot ผลตรวจ และการอนุมัติกรณีพิเศษโดย Admin
- เพิ่มการผูก Serial กับบิล, วันที่ขาย, วันเริ่ม/สิ้นสุดประกัน และการคืนสถานะเมื่อ void
- เพิ่ม Dashboard summary, บิลล่าสุด, คิวรออนุมัติ และประวัติบิลในโปรไฟล์ลูกค้า
- เพิ่มการจำกัดสิทธิ์ทั้ง page, server action และ service layer
- เพิ่ม unit/integration tests และตรวจ browser flow จริงทั้ง Admin, Technician 1 และ Technician 2

Phase 5 ไม่ต้องมี migration ใหม่ เพราะตารางบิลทั้งหมดถูกสร้างไว้ตั้งแต่ Phase 1 แล้ว

## 2. Route และ UI

| Route | หน้าที่ |
|---|---|
| `/bills` | รายการบิล summary cards ตัวกรอง และลิงก์เปิดบิล |
| `/bills/new` | สร้างบิลร่างแบบ barcode-first |
| `/bills/[id]` | รายละเอียดบิล รายการ สรุปยอด สถานะ ประวัติ และปุ่ม workflow |
| `/bills/[id]/edit` | แก้ไขบิลร่างหรือบิลที่ถูกตีกลับ |

UI หลักเป็นภาษาไทย รองรับ desktop/tablet/mobile:

- ฟอร์มบิลเป็นสองคอลัมน์บนจอใหญ่ และเรียงเป็นคอลัมน์เดียวบนจอแคบ
- ช่องสแกนบาร์โค้ดโฟกัสอัตโนมัติเฉพาะจอตั้งแต่ 768px ขึ้นไป และใช้ `preventScroll` เพื่อไม่กระโดดข้ามข้อมูลลูกค้า
- ตารางบิลบนจอแคบสามารถเลื่อนแนวนอนภายใน container ได้
- ตรวจแล้วที่ 390px, 768px และ 1440px โดยไม่มี horizontal overflow ระดับหน้า

## 3. ประเภทบิลและเลขที่บิล

| ประเภท | Prefix | เงื่อนไขเพิ่มเติม |
|---|---|---|
| `SALE` | `INV` | ไม่มี |
| `REPAIR` | `RPR` | ต้องมีอาการเสียอย่างน้อย 3 ตัวอักษรก่อน submit |
| `SERVICE` | `SVC` | ไม่มี |
| `WARRANTY_CLAIM` | `CLM` | ต้องมีข้อมูลเคลมและผลตรวจประวัติซื้อ |

- เลขบิลออกตอนสร้าง Draft
- รูปแบบ `PREFIX-ปี พ.ศ.-ลำดับ 6 หลัก` เช่น `INV-2569-000001`
- Sequence แยกตาม prefix และปี พ.ศ.; ใช้ transaction เดียวกับการสร้างบิล
- ระหว่างทดสอบได้ reset sequence ของ development DB กลับเป็นค่าว่างเมื่อไม่มีบิลคงเหลือ

## 4. Workflow และสิทธิ์

```text
DRAFT ──submit(เจ้าของ/Admin)──> PENDING_APPROVAL
                                  ├──approve(Admin)──> APPROVED ──pay(Admin)──> PAID
                                  └──reject(Admin)───> REJECTED ──edit/resubmit──> PENDING_APPROVAL
APPROVED ──void(Admin)──> VOIDED
PAID     ──void(Admin)──> VOIDED
```

| การกระทำ | Admin | Technician |
|---|---|---|
| ดูบิลทั้งหมด | ✅ | ❌ เห็นเฉพาะบิลที่ตัวเองรับผิดชอบ |
| สร้างบิล | ✅ (เลือกช่างผู้รับผิดชอบ) | ✅ (บิลของตัวเอง) |
| สร้างบิลแทนช่าง | ✅ | ❌ |
| แก้ไข Draft/Rejected | ✅ | ✅ เฉพาะบิลของตัวเอง |
| Submit | ✅ | ✅ เฉพาะบิลของตัวเอง |
| Approve / Reject / Paid / Void | ✅ | ❌ |
| เปิดบิลของช่างคนอื่น | ✅ | ❌ (404) |

- Admin สร้างบิลแทนช่างได้ โดยเลือก `technicianId` ที่ active และมี role `TECHNICIAN`
- Technician ไม่สามารถกำหนด `technicianId` เป็นคนอื่นได้ แม้แก้ request โดยตรง
- การป้องกันมีหลายชั้น: page guard, server action และ service layer
- ทุก action ที่เปลี่ยนสถานะต้องเป็น Admin ยกเว้น submit ซึ่งเจ้าของบิลหรือ Admin ทำได้
- **ยังต้องยืนยัน:** ปัจจุบัน Admin อนุมัติบิลที่ตัวเองสร้างได้ และแก้ไขบิล Draft/Rejected ของช่างคนอื่นได้

## 5. เงิน ส่วนลด และ VAT

- ราคาเป็นบาท ทศนิยม 2 ตำแหน่ง และคำนวณด้วย Decimal.js ทุกจุด
- Server เป็นผู้คำนวณยอดจริง; client คำนวณเพื่อ preview เท่านั้น
- รองรับส่วนลดแบบจำนวนเงินและเปอร์เซ็นต์ทั้งระดับรายการและท้ายบิล
- ป้องกันส่วนลดติดลบ เกินยอดรายการ และยอดรวมติดลบ
- เก็บ snapshot `unitCost` จากต้นทุนเฉลี่ยถ่วงน้ำหนัก ณ เวลาอนุมัติ
- VAT เริ่มต้นปิด; เมื่อเปิดใช้จะคำนวณแบบราคารวม VAT ตามอัตราใน Settings
- ยอดที่เก็บในบิล: `subtotal`, `lineDiscountTotal`, `discountAmount`, `netAmountBeforeVat`, `vatAmount`, `grandTotal`

## 6. สต๊อก Serial และประกัน

- ตอน submit: ตรวจสินค้า active, จำนวนคงเหลือ และ Serial ที่พร้อมขาย โดยยังไม่ตัดสต๊อก
- ตอน approve:
  - lock บิลและแถวสินค้าตามลำดับที่กำหนด
  - ตรวจสต๊อกซ้ำอีกครั้ง
  - ตัด `Product.stockQty`
  - เปลี่ยน Serial เป็น `SOLD` พร้อม `soldAt` และวันประกัน
  - สร้าง `StockMovement` ประเภท `SALE` พร้อม `balanceAfter`
  - เปลี่ยนสถานะบิลเป็น `APPROVED` และบันทึก `stockDeductedAt`
- ถ้าสต๊อกหรือ Serial เปลี่ยนไประหว่างรออนุมัติ การ approve จะ rollback ทั้ง transaction
- ตอน void:
  - อนุญาตเฉพาะบิล `APPROVED` หรือ `PAID`
  - สร้าง `StockMovement` ประเภท `VOID_RESTOCK` โดยอ้าง `sourceMovementId` ของรายการเดิม
  - คืน Serial เป็น `IN_STOCK` และล้างวันที่ขาย/ประกัน
  - ตั้ง `releasedAt` ใน `BillItemSerial`
  - บันทึก `stockRestoredAt` และเหตุผลการยกเลิก
- ถ้าสินค้าถูกเก็บถาวรระหว่างบิลยัง active ระบบจะไม่ยอม void จนกว่าจะกู้คืนสินค้า
- สินค้าที่ติดตาม Serial ต้องเลือก Serial ให้ครบจำนวนก่อนบันทึก
- Serial ต้องไม่ซ้ำทั้งระบบ และบิลที่ยัง active ต้องไม่ผูก Serial เดียวกันซ้ำ

## 7. งานซ่อมและเคลม

### งานซ่อม

- เก็บยี่ห้อ รุ่น Serial เครื่อง อาการเสีย ผลตรวจ วิธีแก้ไข และสถานะงานซ่อม
- บังคับอาการเสียอย่างน้อย 3 ตัวอักษรทั้งตอน submit และ approve
- สถานะงานซ่อมแก้ไขได้ผ่านหน้าบิลในสถานะ Draft/Rejected

### เคลม

- ตรวจจากบิล `APPROVED` หรือ `PAID` ของลูกค้าคนเดียวกัน
- ถ้าระบุ Serial จะตรวจจาก Serial ที่ยังไม่ถูก release; ถ้าไม่ระบุจะค้นจากสินค้าและลูกค้า
- Snapshot: เลขบิลเดิม วันที่ซื้อ วันเริ่ม/สิ้นสุดประกัน ผลตรวจ และเวลาที่ตรวจ
- ผลตรวจ: `FOUND_IN_WARRANTY`, `FOUND_OUT_OF_WARRANTY`, `NOT_FOUND`
- ถ้าไม่พบประวัติหรือหมดประกัน Admin ต้องใส่เหตุผลอนุมัติกรณีพิเศษอย่างน้อย 3 ตัวอักษร
- ตรวจซ้ำอีกครั้งตอน approve และเก็บ snapshot ล่าสุด

## 8. Audit และ Status History

ทุกการเปลี่ยนสถานะเขียน `BillStatusHistory` พร้อมผู้ทำเหตุผลและเวลา และเขียน `AuditLog`:

- `BILL_CREATED`
- `BILL_UPDATED`
- `BILL_SUBMITTED`
- `BILL_APPROVED`
- `BILL_REJECTED`
- `BILL_PAID`
- `BILL_VOIDED`

Audit เก็บ `billNumber`, สถานะก่อน/หลัง, ยอดเงิน, จำนวนรายการ, เหตุผล และช่วงเวลาตัด/คืนสต๊อกตาม action

## 9. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/server/services/bills.ts` | workflow, stock/serial, warranty check, audit และ transaction |
| `src/server/actions/bills.ts` | Server Actions และ map error/field errors |
| `src/server/validators/bills.ts` | Zod schema สำหรับ create/update/action |
| `src/server/services/billing-options.ts` | โหลดลูกค้า ช่าง สินค้า Bill Types และ Settings |
| `src/lib/bill-calculations.ts` | คำนวณยอดด้วย Decimal และ `addMonths` แบบ UTC |
| `src/components/bills/bill-form.tsx` | ฟอร์มบิล barcode-first และ preview |
| `src/components/bills/bill-workflow-forms.tsx` | submit/approve/reject/pay/void |
| `src/app/(app)/bills/page.tsx` | รายการบิล summary และตัวกรอง |
| `src/app/(app)/bills/new/page.tsx` | หน้าเปิดบิล |
| `src/app/(app)/bills/[id]/page.tsx` | รายละเอียดและ workflow |
| `src/app/(app)/bills/[id]/edit/page.tsx` | แก้ไข Draft/Rejected |
| `src/app/(app)/page.tsx` | Dashboard บิลรออนุมัติและบิลล่าสุด |
| `src/server/services/customers.ts` | ประวัติบิลและยอดซื้อในโปรไฟล์ลูกค้า |
| `tests/unit/bill-calculations.test.ts` | unit tests เงิน/VAT/เดือน/validator |
| `tests/integration/bill-service.test.ts` | integration tests workflow/สิทธิ์/สต๊อก/Serial/เคลม |

## 10. ผลตรวจสอบ

รันเมื่อเสร็จ Phase 5:

```text
npm run typecheck  → ผ่าน
npm run lint       → ผ่าน
npm test           → 15 ไฟล์, 99 tests ผ่านทั้งหมด
npm run build      → ผ่าน
```

ชุดทดสอบใหม่:

- `tests/unit/bill-calculations.test.ts` — 8 tests: line totals, percent/amount discounts, bill totals, VAT, `addMonths` และ validation
- `tests/integration/bill-service.test.ts` — 13 tests:
  - สร้าง Draft แล้วยังไม่ตัดสต๊อก
  - คำนวณยอดและ snapshot ต้นทุน
  - technician เห็น/แก้เฉพาะบิลของตัวเอง
  - submit ตรวจสต๊อกแต่ไม่ตัด
  - technician ถูกปฏิเสธทุก action ของ Admin
  - approve ตัดสต๊อกและผูก Serial ใน transaction
  - paid แล้ว void คืนสต๊อก Serial และ warranty
  - สต๊อกไม่พอทำให้ submit ไม่ผ่านโดยไม่เปลี่ยนข้อมูล
  - บังคับ Serial และตรวจส่วนลด
  - reject → แก้ไข → resubmit สำเร็จ
  - บังคับข้อมูลซ่อมก่อน submit
  - ตรวจเคลมจากประวัติซื้อจริง
  - ต้องมี override เมื่อไม่พบประวัติ
  - summary และ pending list แยกตามสิทธิ์

Browser validation ด้วย Chrome headless: **46 checks ผ่านทั้งหมด**

- Admin dashboard, รายการบิล empty state และเปิดบิล
- สแกนบาร์โค้ดซ้ำเพื่อเพิ่มจำนวน, เลือก Serial และเพิ่มค่าบริการ
- Preview ยอดรวมและสร้าง Draft
- Submit → Approve → Paid → Void พร้อมตรวจข้อความสถานะ
- ตรวจว่าบิล Void ไม่มีปุ่ม action เหลือ
- ประวัติลูกค้าลิงก์กลับบิลจริง
- Technician สร้าง/ส่งบิลของตัวเองได้ แต่ไม่เห็น action ของ Admin
- Technician 2 ไม่เห็นบิลในรายการ และเปิด detail/edit ตรง ๆ ได้ 404
- Admin reject พร้อมเหตุผล และหน้าแสดงเหตุผล
- ฟอร์มซ่อม/เคลมแสดงส่วนข้อมูลตามประเภทบิล
- Mobile 390px, tablet 768px และ desktop 1440px ไม่มี horizontal overflow ระดับหน้า
- Mobile เปิดหน้าใหม่ที่ตำแหน่งบนสุดและไม่มี autofocus กระโดด
- ไม่มี console error หรือ server 5xx

ข้อมูลทดสอบ:

- ลบบิลที่ browser validation สร้างทั้งหมด และคืนสต๊อก/Serial ของบิลเหล่านั้นแล้ว
- ไม่แตะข้อมูลที่ผู้ใช้สร้างระหว่างการตรวจ; ณ เวลาสรุปมีบิลทดสอบที่ผู้ใช้สร้างเอง 1 ใบ (`PAID`) จึงคงอยู่ตามจริง
- ข้อมูล seed ยังครบ 20 สินค้า, 5 ลูกค้า และ 123 Serial; sequence ของบิลสะท้อนเอกสารที่ยังมีอยู่ในฐานข้อมูล

## 11. วิธีทดสอบด้วยมือ

ให้ PostgreSQL และ dev server ทำงานก่อน:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

1. Login Admin เปิด `/bills` ตรวจ summary และ empty state/รายการ
2. กดเปิดบิลใหม่ เลือกลูกค้าและช่าง แล้วสแกนบาร์โค้ดสินค้าที่ไม่ติด Serial สองครั้ง ต้องเพิ่มจำนวนในรายการเดิม
3. สแกนสินค้าที่ติด Serial แล้วเลือก Serial ให้ครบ กดเพิ่มค่าบริการและกรอกจำนวนเงิน
4. ตรวจยอด preview แล้วบันทึกเป็นร่าง
5. เปิดรายละเอียดบิล กดส่งขออนุมัติ ต้องเห็นสถานะรออนุมัติและไม่มีการตัดสต๊อก
6. Login Admin คนเดิม กดอนุมัติ ต้องเห็นข้อความตัดสต๊อกและตรวจ stock ledger/สินค้าว่ายอดลดลง
7. กดบันทึกชำระเงิน ต้องเปลี่ยนเป็นชำระแล้ว
8. กดยกเลิกบิล กรอกเหตุผลและยืนยัน ต้องคืนสต๊อก Serial และแสดงเหตุผล
9. Login Technician สร้างบิลของตัวเองและส่งขออนุมัติ ต้องไม่เห็นปุ่มอนุมัติ/ตีกลับ/ชำระ/ยกเลิก
10. Login Technician อีกคน เปิดบิลของ Technician คนแรกตรง ๆ ต้องได้ 404
11. Login Admin กดตีกลับบิลของ Technician พร้อมเหตุผล แล้ว login Technician กลับมาแก้ไขและส่งใหม่
12. สร้างบิลซ่อม ตรวจว่าต้องกรอกอาการเสียก่อนส่ง
13. สร้างบิลเคลมจากสินค้าที่ลูกค้าซื้อจริง ตรวจเลขบิลเดิมและวันประกัน
14. สร้างบิลเคลมที่ไม่มีประวัติซื้อ แล้วลองอนุมัติโดยไม่ใส่ override ต้องถูกปฏิเสธ
15. ตรวจที่ 390px, 768px และ 1440px ว่าไม่มี horizontal overflow ระดับหน้า

## 12. ข้อจำกัด งานที่ยังไม่ทำ และการตัดสินใจที่รอตรวจ

- **Admin self-approval:** ปัจจุบัน Admin อนุมัติบิลที่ตัวเองสร้างได้ ยังไม่ได้เพิ่มข้อห้ามหรือ four-eyes approval
- **Admin edit scope:** ปัจจุบัน Admin แก้ไขบิล Draft/Rejected ของช่างคนอื่นได้ แตกต่างจากถ้อยคำ “เจ้าของบิล” ใน Phase 0 ที่ยังเป็นคำถามเปิด
- **Commission:** ยังไม่สร้าง/กลับรายการคอมมิชชั่นใน Phase 5; จะทำพร้อม reversal ใน Phase 6
- **Receipt/ใบเสร็จ:** ยังไม่มีหน้าพิมพ์ใบเสร็จหรือใบกำกับภาษี; ตรวจเฉพาะ layout ใน browser
- **Printer:** ยังไม่ได้ทดสอบเครื่องพิมพ์ใบเสร็จ/A4 จริง
- **Pagination:** รายการบิลจำกัด 200 รายการ และยังไม่มี pagination
- **Void scope:** Void ทั้งบิลเท่านั้น ยังไม่มี partial return/credit note/บันทึกการคืนเงิน
- **Repair status หลังอนุมัติ:** ยังแก้สถานะงานซ่อมได้เฉพาะตอนบิลยัง Draft/Rejected
- **E2E suite:** browser validation เป็น script ชั่วคราว ไม่ได้ commit เป็น Playwright/Cypress suite
- **AuditLog:** ยังไม่มีหน้าดู audit log สำหรับผู้ใช้; login audit จากรอบ browser test ยังคงอยู่ใน development DB
- **Deployment:** ยังไม่ได้เลือกเป้าหมาย production และยังไม่มี deployment runbook
- **Security review:** CSP/HSTS แบบเต็ม, trusted proxy IP และ dependency audit เลื่อนไป Phase 9; `npm audit` ยังพบ high vulnerabilities ใน development tooling
- **Authentication:** Auth.js ยังเป็น beta รุ่นที่ติดตั้งไว้
