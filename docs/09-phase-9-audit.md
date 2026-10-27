# Phase 9 — Audit Report (ยังไม่รับรอง Production)

> วันที่ตรวจ: 23 ตุลาคม 2569
> ขอบเขต: ตรวจ Phase 7–9 จากโค้ด ฐานข้อมูล และ browser จริง โดยยังไม่แก้ไขโค้ดหรือข้อมูลธุรกิจ
> สถานะ: **ยังไม่ผ่านการรับรอง Phase 9 / ยังไม่ควรประกาศว่า Production Ready**

## 1. ผลตรวจพื้นฐาน

| รายการ | ผล |
|---|---|
| `npm run typecheck` | ผ่าน |
| `npm test` | ผ่าน 23 ไฟล์ / 150 tests |
| `npm run build` | ผ่าน (49 routes) |
| `npx prisma migrate status` | schema up to date |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| Browser smoke test | ผ่าน 21/21 checks |
| Console errors / failed requests | ไม่พบ |

Browser checks ที่ผ่าน: login, dashboard (desktop/mobile), bill detail, A4 print, thermal 80 mm print, shop settings, และ technician เปิดบิลของตัวเองได้

ยังไม่ได้ทดสอบ: เครื่องพิมพ์จริง, การอนุมัติเคลมด้วยข้อมูลจริง, การใช้งานพร้อมกันหลายคน, และข้อมูลปริมาณมาก

> การทดสอบ login/print/settings สร้าง audit-log entries เพิ่ม แต่ไม่ได้แก้ไขบิล สินค้า หรือผู้ใช้โดยเจตนา

## 2. P0 — ต้องแก้ก่อนใช้ข้อมูลจริง

### P0-1 Technician เห็นประวัติซื้อและข้อมูลลูกค้าของช่างคนอื่น

**หลักฐานที่ reproduce ได้:**

- Login เป็น `tech1`
- เรียก `GET /api/warranty/check?serial=SN-CPU-AMD-0001-0001`
- ได้ HTTP 200 พร้อมชื่อลูกค้า เบอร์โทร อีเมล และบิล `INV-2569-000001` ซึ่งเป็นบิลของ `tech2`
- หน้า `/warranty?serial=...` แสดงประวัติการซื้อและการเคลมเดียวกัน
- หน้า customer detail แสดงรายการสินค้าที่เคยซื้อทั้งหมด แม้บิลจะไม่ได้เป็นของ technician คนนั้น

**สาเหตุ:**

- `src/server/services/warranty.ts` — `lookupWarrantyBySerial()` และ `checkClaimEligibility()` ไม่กรอง `bill.technicianId` ตาม actor
- `src/server/services/warranty.ts` — `getCustomerPurchasedProducts()` รับ `actor` แต่ไม่ได้ใช้ actor ในการกรอง
- `src/app/api/warranty/check/route.ts` — เปิดให้ technician ทุกคนเรียกได้
- `src/app/(app)/customers/[id]/page.tsx` — แสดง purchased items ให้ทุก role

ทั้งที่ `getCustomerBills()` และ `getCustomerSummary()` กรองตามเจ้าของบิลแล้ว ทำให้หน้า customer แสดงข้อมูลไม่สอดคล้องกันและลิงก์บิลบางรายการอาจเปิดไม่ได้

**ผลกระทบ:** ละเมิดข้อกำหนดที่ว่า technician เห็นประวัติซื้อเฉพาะบิลของตนเอง และเป็น PII leak ภายในร้าน

**สิ่งที่ต้องตัดสินใจก่อนแก้:** technician เปิด claim แทนบิลของช่างคนอื่นได้หรือไม่

- ถ้าไม่ได้: กรองทุก query ด้วย `technicianId` และให้ Admin เท่านั้นที่ทำงานข้ามช่างได้
- ถ้าได้: ต้องจำกัด PII ที่แสดง และบันทึก audit ทุกครั้งที่เปิดดู/เคลมข้ามช่าง

### P0-2 Seed สำหรับ Production เป็นอันตราย

`prisma/seed.ts` ไม่ใช่ base seed:

- สร้างสินค้า demo 20 รายการ ลูกค้า 5 คน และข้อมูลตัวอย่างอื่น
- รันซ้ำแล้ว `upsert` แบบ `update` จะรีเซ็ตรหัสผ่าน admin/tech เป็นค่าใน env
- เปิดใช้งานผู้ใช้ที่ถูกปิด และเขียนทับชื่อ/role/ข้อมูลสินค้า บางส่วน

`docs/deployment-runbook.md` สั่ง `npm run db:seed` ในขั้นตอน production จึงเสี่ยงทำให้ข้อมูลจริงถูกเขียนทับหรือสร้างข้อมูล demo ในระบบจริง

**สิ่งที่ต้องมี:** แยก `seed:base` (bill types, shop settings, admin คนแรก) ออกจาก `seed:demo` และมี guard เช่น `ALLOW_DEMO_SEED=true` สำหรับ demo เท่านั้น

### P0-3 Runbook อ้างไฟล์ที่ยังไม่มีใน repo

ตรวจแล้วไม่พบ:

- `Dockerfile`
- `docker-compose.prod.yml`
- `ecosystem.config.cjs`
- `.github/workflows/*` (CI)
- health-check endpoint
- backup automation (runbook มีเพียงตัวอย่าง script ให้สร้างเอง)

ดังนั้นยังทำตาม runbook เพื่อขึ้น production แบบคัดลอกคำสั่งทั้งหมดไม่ได้ และยังไม่มี CI ที่รัน typecheck/test/build ก่อน deploy

### P0-4 Claim ซ้ำและสถานะ Serial ยังไม่สมบูรณ์

`README.md` ระบุว่า "ป้องกันการเปิดบิลเคลมซ้ำซ้อน" แต่:

- ไม่พบ service check สำหรับ claim ที่ยัง active ของ Serial เดียวกัน
- schema มี unique เฉพาะ `BillWarrantyClaim.billId`; `productSerialId` ไม่ unique
- enum `SerialStatus.CLAIMED` มีอยู่ แต่ไม่มีโค้ดใช้งาน
- อนุมัติ claim แล้ว Serial ยังคงเป็น `SOLD`
- void บิลขายเดิมสามารถคืน Serial เป็น `IN_STOCK` ได้ แม้มีประวัติ claim อยู่

**ผลกระทบ:** เปิด claim ซ้ำได้, สถานะ Serial ไม่สะท้อนว่ากำลังเคลม, และอาจขายเครื่องที่อยู่ระหว่างเคลมได้

**ต้องกำหนดนโยบาย:** หนึ่ง Serial มี active claim ได้กี่ครั้ง, claim ที่จบแล้วเปิดใหม่ได้หรือไม่, และ void บิลเดิมเมื่อมี claim ต้องทำอย่างไร

## 3. P1 — ควรแก้ก่อนรับรอง Phase 9

### P1-1 Audit Log ยังใช้งานจริงได้ไม่ครบ

- `GET /audit-logs?from=not-a-date` คืน **HTTP 500** (reproduce แล้ว)
  - สาเหตุ: `src/app/(app)/audit-logs/page.tsx` สร้าง `new Date()` จาก query โดยไม่ validate ก่อนส่งให้ Prisma
- Action ภาษาไทยไม่ครบ:
  - `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_BLOCKED`, `AUTH_LOGOUT`
  - `SETTINGS_UPDATED`, `STOCK_ADJUSTED`, `PRODUCTS_IMPORTED`
  - `PRODUCT_BARCODE_*`, `CATEGORY_*`, `SUPPLIER_*`, `CUSTOMER_ARCHIVED/RESTORED`
  - `USER_CREATED`, `USER_PASSWORD_*`, `USER_REACTIVATED`
  - แสดงเป็น raw code แทนคำอธิบาย แม้เอกสาร Phase 9 จะบอกว่ามีป้ายภาษาไทยแล้ว
- ไม่มี detail/diff view: service ดึง `before`/`after`/`metadata` มาแล้ว แต่ UI ไม่ได้แสดง
- IP Address มีเฉพาะ auth events; action ส่วนใหญ่แสดง `—`
- ไม่มี retention/export/immutable policy

### P1-2 ใบกำกับภาษีถูกกล่าวเกินจริง

`README.md` เขียนว่า "พิมพ์ใบเสร็จ/ใบกำกับภาษี" แต่เอกสารพิมพ์จริงเป็น:

- `PAID` → ใบเสร็จรับเงิน
- `APPROVED` → ใบส่งของ / ใบแจ้งหนี้

ยังไม่มีเลขใบกำกับภาษี แยกจากเลขบิล และไม่มี validation บังคับ `taxId` เมื่อเปิด VAT

**เลือกอย่างใดอย่างหนึ่ง:** ทำใบกำกับภาษีให้ถูกต้อง หรือแก้ docs/UI ให้เรียกว่าใบเสร็จ/ใบส่งของและไม่กล่าวอ้างว่าเป็นใบกำกับภาษี

### P1-3 Pagination และ Report ยังไม่ครอบคลุม

Pagination มีเฉพาะ bills, stock movements, audit logs ส่วนリストอื่นยังมี hard limit:

- products 200
- customers 200
- goods receipts 100
- commission ledger 500
- payout 100

Phase 4/6/8 เคยระบุว่า pagination จะทำใน Phase 9 แต่ยังไม่ได้ทำครบ

Reports ยัง:

- ไม่มี CSV export (Phase 8 ระบุว่าจะทำใน Phase 9)
- โหลดบิลและ items 12 เดือนเข้ามา aggregate ใน application memory
- ไม่มี net profit (มีเฉพาะ gross profit) ตามที่ docs ระบุไว้

### P1-4 Test coverage ยังไม่ครอบคลุมจุดเสี่ยง

มี 150 tests ที่ผ่าน แต่ยังไม่มี tests สำหรับ:

- technician เห็น/ไม่เห็นประวัติซื้อข้ามช่าง
- duplicate claim และ claim/serial state
- audit-log date parsing/action labels
- report correctness/CSV
- print route authorization
- production-safe seed
- API export authorization

`tests/e2e/.gitkeep` ว่าง; browser smoke test ที่ใช้ตรวจเป็น script ชั่วคราว ไม่ได้อยู่ใน repo/CI

## 4. P2 — งานเก็บรายละเอียดและความเสี่ยงระยะยาว

- README/docs ยังกล่าวว่า Phase 1–9 เสร็จสมบูรณ์และพร้อม Production แต่ยังมีข้อจำกัดเก่าที่ขัดกับโค้ด เช่น
  - "บิลจำกัด 200 รายการ ยังไม่มี pagination"
  - "pagination defer ไป Phase 9"
  - "CSP/HSTS จะทำใน Phase 9"
  - จำนวน tests/routes เก่า
- Phase 8/9 docs ระบุ lint 0 warnings แต่ `npm run lint` ปัจจุบันได้ 282 warnings จาก `.agent`, `.gemini`, `.opencode`, `.impeccable`; โค้ดแอปใน `src`, `tests`, `prisma` ไม่มี warning
- `src/lib/env.ts` มี `getServerEnv()` แต่ไม่มีใครเรียกใช้ จึงไม่มีการ validate env ตอน startup จริง
- Login rate-limit rows ที่ fail จะค้างใน DB ไม่มี cleanup
- `x-forwarded-for` ถูกใช้เป็น IP โดยไม่มีการยืนยัน trusted proxy; ถ้าเปิดระบบตรงอาจ spoof ได้
- CSP ยังมี `'unsafe-inline'` ใน `script-src` แม้ docs ใช้คำว่า strict
- `npm audit` รายงาน 9 high ใน dev tooling แม้ production audit เป็น 0; ควรตรวจซ้ำด้วย `npm ci` ใน CI
- Mobile top navigation ที่ 390 px ถูกตัดด้านขวาและต้อง scroll แนวนอน; ใช้งานได้แต่ discoverability ไม่ดี
- ยังไม่ทดสอบเครื่องพิมพ์ A4/thermal จริง
- ยังไม่มี monitoring/alerting/log rotation และ backup automation

## 5. Phase 10 ที่ยังไม่มี

แผนเดิมใน `docs/00-phase-0-summary.md` มีเพียง Phase 1–9 ไม่มีนิยาม Phase 10 หรือ launch checklist

ถ้าต้องการ 10 phases ควรกำหนด Phase 10 เป็น:

1. แก้ P0/P1 ทั้งหมด
2. UAT กับร้านจริง
3. backup/restore drill
4. monitoring/health check/alerting
5. production deployment rehearsal
6. sign-off และคู่มือส่งมอบ

## 6. ลำดับที่แนะนำ

1. ตัดสินนโยบาย cross-technician warranty/claim
2. แก้ PII scoping + เพิ่ม tests
3. แก้ audit-log date/labels/detail + tests
4. แยก base seed/demo seed และเพิ่ม deployment artifacts/CI
5. กำหนด duplicate-claim/serial policy แล้วแก้ใน transaction
6. แก้ docs เรื่องใบกำกับภาษีและสถานะ production
7. ทำ pagination/report CSV/remaining tests

---

**สรุป:** ฟีเจอร์หลักของ Phase 9 มีอยู่และ flow พื้นฐานทำงานได้ แต่ยังไม่ควรรับรอง Phase 9 หรือขึ้น production จนกว่าจะแก้ P0 อย่างน้อย 4 ข้อข้างต้น
