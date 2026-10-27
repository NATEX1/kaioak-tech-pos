# Phase 3 — Products และ Inventory

> สถานะ: **เสร็จสิ้น รอตรวจ** — Phase 2 ยังรออนุมัติอย่างเป็นทางการ แต่ Phase 3 ได้รับอนุญาตให้ดำเนินการแล้ว

## 1. สรุปสิ่งที่ทำเสร็จ

- เพิ่มระบบข้อมูลหลักสินค้า หมวดหมู่ และผู้จัดจำหน่าย พร้อม soft archive/restore
- สร้าง SKU อัตโนมัติจากรหัสหมวดหมู่และลำดับถัดไป
- รองรับบาร์โค้ดหลายรายการต่อสินค้า, บาร์โค้ดหลัก, Code 128 และ EAN-13 พร้อม checksum
- เพิ่มหน้าค้นหาสินค้าแบบ barcode-first สำหรับ Admin และ Technician
- เพิ่มใบรับสินค้า (Goods Receipt) แบบ immutable
  - รับเข้าสินค้าปกติ
  - รับเข้าสินค้าที่ติดตาม Serial พร้อมตรวจจำนวนและความซ้ำ
  - คำนวณต้นทุนเฉลี่ยถ่วงน้ำหนัก
- เพิ่ม stock ledger และหน้าปรับสต๊อกเข้า/ออกพร้อมเหตุผล
- เพิ่มหน้าสินค้าใกล้หมดพร้อมจุดสั่งซื้อและจำนวนแนะนำให้สั่ง
- เพิ่ม CSV import/export แบบ all-or-nothing
- เพิ่มป้ายบาร์โค้ด SVG ขนาด 60 × 35 มม. พิมพ์ผ่านเลย์เอาต์ A4
- เพิ่ม audit log สำหรับการสร้าง/แก้ไข/เก็บถาวรสินค้า หมวดหมู่ ผู้จัดจำหน่าย ใบรับ และการปรับสต๊อก
- เพิ่ม unit/integration tests และตรวจ browser flow จริงทั้ง Admin และ Technician

## 2. Route และ UI

| Route | หน้าที่ |
|---|---|
| `/inventory` | ภาพรวมสต๊อก ตัวเลขสินค้า มูลค่าสต๊อก (Admin) และความเคลื่อนไหวล่าสุด |
| `/inventory/products` | ค้นหา/สแกนบาร์โค้ด กรองหมวดหมู่ สถานะ และสินค้าใกล้หมด |
| `/inventory/products/new` | สร้างสินค้าและบาร์โค้ดหลัก (Admin) |
| `/inventory/products/[id]` | ข้อมูลสินค้า, บาร์โค้ด, Serial, stock ledger, ประวัติรับ, ปรับสต๊อก, เก็บถาวร |
| `/inventory/products/[id]/edit` | แก้ข้อมูลหลัก ราคา และเงื่อนไข Serial (Admin) |
| `/inventory/products/[id]/label` | ตัวอย่างและพิมพ์ป้ายบาร์โค้ด (Admin) |
| `/inventory/low-stock` | รายการต่ำกว่าจุดสั่งซื้อ เรียงตามส่วนต่างที่ต้องเติม |
| `/inventory/receipts` | ประวัติใบรับสินค้า (Admin) |
| `/inventory/receipts/new` | สร้างใบรับด้วยการสแกน/เลือกสินค้าและกรอก Serial (Admin) |
| `/inventory/receipts/[id]` | รายละเอียดใบรับและต้นทุนรวม (Admin) |
| `/inventory/stock` | Stock ledger กรองตามสินค้าและประเภท (Admin) |
| `/inventory/import` | นำเข้า CSV, ดาวน์โหลดไฟล์ตัวอย่าง/ข้อมูลปัจจุบัน, หัวคอลัมน์ |
| `/inventory/categories`, `/inventory/categories/[id]` | หมวดหมู่สินค้า (Admin) |
| `/inventory/suppliers`, `/inventory/suppliers/[id]` | ผู้จัดจำหน่าย (Admin) |
| `/api/inventory/products/export` | ส่งออก CSV แบบ authenticated (Admin) |

UI หลักเป็นภาษาไทย รองรับ desktop/tablet/mobile และใช้ตารางแบบ horizontal scroll บนจอแคบ

## 3. กติกาข้อมูลหลัก

### สินค้า

- SKU unique, normalize เป็นตัวพิมพ์ใหญ่ และใช้ได้เฉพาะ `A-Z`, ตัวเลข, `-`, `_`
- หากเว้น SKU ว่าง ระบบสร้างจาก `<CATEGORY_CODE>-<ลำดับ 4 หลัก>` ภายใน transaction
- ต้นทุน (`costPrice`) แก้ไขจากฟอร์มสินค้าไม่ได้; เปลี่ยนผ่านใบรับ/ปรับสต๊อกเข้า และ CSV เฉพาะเมื่อสินค้ายังไม่มีสต๊อก
- `trackSerial` เปลี่ยนไม่ได้เมื่อมีสต๊อกหรือมีประวัติ Serial
- สินค้าที่มีสต๊อกอยู่เก็บถาวรไม่ได้
- การเก็บถาวรตั้ง `isActive = false` และ `deletedAt`; ประวัติยังอยู่และกู้คืนได้
- Technician เห็นเฉพาะสินค้าที่ยังเปิดใช้งาน

### หมวดหมู่

- `code` unique, ตัวพิมพ์ใหญ่, ใช้เฉพาะ `A-Z` และตัวเลข
- หมวดหมู่ที่มีสินค้าที่ยังเปิดใช้งานอยู่เก็บถาวรไม่ได้
- รหัสหมวดหมู่ใช้เป็น prefix ของ SKU อัตโนมัติ

### ผู้จัดจำหน่าย

- ใช้ soft archive/restore
- ผู้จัดจำหน่ายที่เก็บถาวรจะไม่ปรากฏในตัวเลือกใบรับใหม่
- ประวัติใบรับเดิมยังอ้างอิงผู้จัดจำหน่ายได้

### บาร์โค้ด

- หนึ่งสินค้ามีได้หลายบาร์โค้ด แต่มีบาร์โค้ดหลักได้หนึ่งรายการ
- บาร์โค้ด unique ทั้งระบบ
- Code 128 รับ ASCII 1–64 ตัว; EAN-13 ต้องเป็นตัวเลข 13 หลักและ checksum ถูกต้อง
- บาร์โค้ดที่ซ้ำกับสินค้าอื่นจะถูก reject ด้วย `BARCODE_EXISTS`
- การลบบาร์โค้ดหลักจะเลื่อนบาร์โค้ดที่เหลือขึ้นเป็นหลักอัตโนมัติ

## 4. สต๊อกและต้นทุน

### หลักการ

- ห้ามแก้ `Product.stockQty` โดยตรงจาก UI
- ทุกการเปลี่ยนยอดต้องสร้าง `StockMovement` ใน transaction เดียวกับยอดคงเหลือ
- ใช้ row/advisory lock ต่อสินค้าเพื่อกันการรับเข้าพร้อมกันแล้วต้นทุนเฉลี่ยเพี้ยน
- ใบรับสินค้า immutable; ไม่มีหน้าแก้ไขหรือลบใบรับ
- สต๊อกถูกตัดเมื่ออนุมัติบิลใน Phase 5 ไม่ใช่ตอนสร้าง Draft

### ต้นทุนเฉลี่ยถ่วงน้ำหนัก

```text
ต้นทุนใหม่ = ((จำนวนเดิม × ต้นทุนเดิม) + (จำนวนรับเข้า × ต้นทุนรับเข้า)) / จำนวนรวมใหม่
```

- ปัดเศษด้วย `HALF_UP` ทศนิยม 2 ตำแหน่ง
- ถ้าสต๊อกเดิมเป็น 0 ต้นทุนรับเข้าจะกลายเป็นต้นทุนใหม่ทันที
- การปรับออกไม่เปลี่ยนต้นทุนเฉลี่ย
- ใบรับแต่ละใบมี `totalCost = sum(quantity × unitCost)`

### ใบรับสินค้า

ใน transaction เดียว ระบบ:

1. ตรวจสิทธิ์ Admin
2. ตรวจวันที่และรูปแบบรายการ
3. ตรวจสินค้าซ้ำในใบเดียว
4. ตรวจ Serial ซ้ำภายในใบและซ้ำกับทั้งระบบ
5. ตรวจจำนวน Serial ให้ตรงกับจำนวนรับเข้าสำหรับสินค้า Serial
6. ออกเลข `GR-<พ.ศ.>-<ลำดับ 4 หลัก>` ผ่าน `DocumentSequence`
7. สร้าง `GoodsReceipt` และ `GoodsReceiptItem`
8. อัปเดต `stockQty` และ `costPrice`
9. สร้าง `StockMovement` type `GOODS_RECEIPT`
10. สร้าง `ProductSerial` สำหรับสินค้า Serial
11. เขียน audit log

### ปรับสต๊อก

- รองรับ `IN` และ `OUT`
- ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร
- `OUT` ที่เกินยอดคงเหลือถูก reject ด้วย `STOCK_INSUFFICIENT`
- สินค้า Serial ต้องระบุ Serial ครบทุกชิ้น
- `OUT` ของสินค้า Serial เปลี่ยนสถานะเป็น `DISPOSED` พร้อม note
- `IN` ของสินค้า Serial สร้าง Serial ใหม่และใช้ต้นทุนที่ระบุหรือต้นทุนเฉลี่ยเดิม

### สถานะ Serial

`IN_STOCK` → `SOLD` (Phase 5) / `DISPOSED` (ปรับออก) / `CLAIMED` (Phase 7)

## 5. SKU และเลขเอกสาร

- SKU ใช้ `DocumentSequence` key `SKU-<CATEGORY_CODE>` และเพิ่มครั้งละ 1
- ใบรับใช้ key `GR-<พ.ศ.>` และเพิ่มครั้งละ 1 ต่อปี
- ใช้ PostgreSQL advisory lock ภายใน transaction ผ่าน helper `nextDocumentSequence()`
- หาก SKU ที่ได้มีอยู่แล้ว ระบบลองใหม่สูงสุด 20 ครั้งก่อนแจ้ง error

> หมายเหตุ: integration/browser test สร้างและลบใบรับจริง จึงทำให้ลำดับ `GR-2569` เดินหน้าและมีเลขข้ามได้ ซึ่งไม่กระทบความถูกต้องของเอกสาร

## 6. CSV Import / Export

- หัวคอลัมน์: `sku,name,categorycode,brand,model,description,costprice,saleprice,reorderlevel,warrantymonths,trackserial,barcodes`
- จำกัด 500 แถว และ 2 MB
- ตรวจทุกแถวก่อนเขียน; ถ้าผิดแถวเดียวจะไม่บันทึกทั้งไฟล์
- สร้างสินค้าใหม่เมื่อ SKU ยังไม่มี; อัปเดตเฉพาะข้อมูลหลักเมื่อมีอยู่แล้ว
- ไม่อัปเดต `stockQty`, `costPrice` ของสินค้าที่มีสต๊อก, หรือสถานะเก็บถาวร
- บาร์โค้ดในไฟล์เป็น Code 128 และคั่นหลายรายการด้วย `|`
- บาร์โค้ดเดิมที่ไม่อยู่ในไฟล์จะไม่ถูกลบ; หากแถวมีบาร์โค้ด ระบบตั้งบาร์โค้ดแรกในไฟล์เป็น primary
- Export เฉพาะสินค้าเปิดใช้งาน พร้อม UTF-8 BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง

## 7. ป้ายบาร์โค้ดและการพิมพ์

- สร้าง SVG ฝั่ง server ด้วย `bwip-js` (`toSVG` จาก `bwip-js/node`)
- ป้ายขนาด 60 × 35 มม. สูงสุด 60 ดวงต่อครั้ง
- แสดงชื่อสินค้า ราคา บาร์โค้ด และ SKU
- ใช้ CSS `@media print` ซ่อน app shell/navigation และจัดป้ายแบบ break-inside avoid
- ยังเป็นการพิมพ์ผ่าน browser ไปยังเครื่องพิมพ์ A4/PDF ไม่ใช่ driver เฉพาะเครื่องพิมพ์ฉลาก

## 8. RBAC

| ความสามารถ | Admin | Technician |
|---|---|---|
| ดูภาพรวมสต๊อก | ✅ | ✅ (ไม่เห็นมูลค่าสต๊อก) |
| ดู/ค้นหา/สแกนสินค้า | ✅ | ✅ |
| ดูสินค้าใกล้หมด | ✅ | ✅ |
| สร้าง/แก้ไข/เก็บถาวรสินค้า | ✅ | ❌ |
| จัดการบาร์โค้ด | ✅ | ❌ |
| พิมพ์ป้าย | ✅ | ❌ |
| รับสินค้า/ปรับสต๊อก | ✅ | ❌ |
| ดู stock ledger | ✅ | ❌ |
| CSV import/export | ✅ | ❌ |
| หมวดหมู่/ผู้จัดจำหน่าย | ✅ | ❌ |

การป้องกันมีหลายชั้น:

- `requireAdmin()` ที่ page/Route Handler
- Server Actions ตรวจสิทธิ์ก่อนประมวลผล
- Service layer เรียก `assertInventoryAdmin()` ซ้ำ
- UI ซ่อนเมนู/ปุ่มตาม role เพื่อ UX เท่านั้น

## 9. Audit Log

Phase 3 เพิ่ม action อย่างน้อย:

- `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_ARCHIVED`, `CATEGORY_RESTORED`
- `SUPPLIER_CREATED`, `SUPPLIER_UPDATED`, `SUPPLIER_ARCHIVED`, `SUPPLIER_RESTORED`
- `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_ARCHIVED`, `PRODUCT_RESTORED`
- `PRODUCT_BARCODE_ADDED`, `PRODUCT_BARCODE_REMOVED`, `PRODUCT_BARCODE_PRIMARY_CHANGED`
- `GOODS_RECEIPT_CREATED`
- `STOCK_ADJUSTED`
- `PRODUCTS_IMPORTED` (audit ระดับไฟล์; เก็บรายการ SKU ใน metadata)

Audit เก็บ actor, entity, before/after หรือ metadata, และอยู่ใน transaction เดียวกับ business data เมื่อเหมาะสม

## 10. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/(app)/inventory/**` | หน้าจอสินค้า สต๊อก ใบรับ หมวดหมู่ ผู้จัดจำหน่าย CSV และป้าย |
| `src/components/inventory/**` | ฟอร์มและ interactive UI |
| `src/server/services/products.ts` | สินค้า, SKU, บาร์โค้ด, low stock, inventory summary |
| `src/server/services/stock.ts` | stock ledger, serial, adjustment, weighted average |
| `src/server/services/goods-receipts.ts` | สร้างใบรับ immutable และประวัติ |
| `src/server/services/product-import.ts` | CSV import/export แบบ transactional |
| `src/server/services/categories.ts` | หมวดหมู่และกฎการเก็บถาวร |
| `src/server/services/suppliers.ts` | ผู้จัดจำหน่าย |
| `src/server/services/document-sequences.ts` | SKU/เลขใบรับและ advisory lock |
| `src/server/actions/products.ts` | Server Actions สินค้า/บาร์โค้ด/CSV |
| `src/server/actions/goods-receipts.ts` | Server Action ใบรับ |
| `src/server/actions/stock.ts` | Server Action ปรับสต๊อก |
| `src/server/validators/inventory.ts` | Zod schemas และหัวคอลัมน์ CSV |
| `src/lib/barcode.ts` | normalize/validate Code 128/EAN-13, split Serial |
| `src/lib/csv.ts` | CSV parser/writer ที่รองรับ quote/newline และ formula-safe output |
| `src/lib/inventory-calculations.ts` | weighted average, line total, low stock, SKU format |
| `src/lib/inventory-labels.ts` | วันที่ไทย/พ.ศ. และ label ของ enum |
| `src/app/(app)/inventory/products/[id]/label/page.tsx` | สร้าง SVG และ layout ป้าย |
| `src/app/globals.css` | กฎ `@media print` ของ A4 label sheet |

## 11. Tests และผลตรวจสอบ

รันเมื่อเสร็จ Phase 3:

```text
npm run typecheck  → ผ่าน
npm run lint       → ผ่าน
npm test           → 11 ไฟล์, 66 tests ผ่านทั้งหมด
npm run build      → ผ่าน
```

ชุดทดสอบใหม่:

- `tests/unit/barcode.test.ts` — Code 128/EAN-13, checksum, normalize, split Serial
- `tests/unit/csv.test.ts` — quoted fields, newline, BOM, formula injection, malformed CSV
- `tests/unit/inventory-calculations.test.ts` — weighted average, line total, low stock, SKU
- `tests/integration/inventory-service.test.ts` — product/SKU/barcode, receipt, serial, stock adjustment, archive rules, CSV import/export, role enforcement, low stock

Integration test ใช้ฐานข้อมูล development และลบข้อมูลทดสอบใน `afterAll` (products, barcodes, serials, receipts, movements, audit, category, supplier, sequence ของหมวดที่สร้าง) โดยไม่แตะข้อมูล seed

Browser flow ที่ตรวจด้วย Chrome headless (49 checks ผ่านทั้งหมด):

- Admin login, dashboard แสดง Phase 3
- Inventory overview และรายการสินค้าโหลดถูกต้อง
- สแกนบาร์โค้ด seed แล้วเปิดสินค้าที่ตรงกัน
- หน้าป้ายแสดง SVG และแสดงตัวอย่าง 3 ดวงตามจำนวนที่ขอ
- สร้างหมวดหมู่และสินค้าใหม่; SKU ถูกสร้างอัตโนมัติ
- เพิ่มบาร์โค้ดที่สองและเปลี่ยนเป็นบาร์โค้ดหลัก
- CSV import ผ่าน file picker จริง และสินค้าถูกสร้างโดยไม่เปลี่ยนสต๊อก
- สร้างใบรับสินค้าด้วยการสแกนบาร์โค้ด; ต้นทุน/จำนวนถูกบันทึก
- ปรับสต๊อกออกให้เหลือ 0 และเก็บสินค้าถาวรสำเร็จ
- Low stock, suppliers, stock ledger และ CSV import page ใช้งานได้
- Export API ตอบ `text/csv` เป็น attachment และมี UTF-8 BOM
- Technician เห็นเมนูเพียงภาพรวม/สินค้า/ใกล้หมด และถูกกันจาก route ที่ไม่ได้รับอนุญาต
- Technician ไม่เห็นต้นทุน, ฟอร์มปรับสต๊อก หรือประวัติรับสินค้า
- Mobile 390px ไม่มี horizontal overflow
- ไม่มี console error หรือ page exception

## 12. วิธีทดสอบด้วยมือ

ให้ PostgreSQL และ dev server ทำงานก่อน:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

1. Login Admin เปิด `/inventory` ตรวจตัวเลขสินค้า/สต๊อก/มูลค่า
2. เปิด `/inventory/products` สแกนบาร์โค้ด seed เช่นจาก Seed (`8851000001010`) แล้วกด Enter
3. สร้างหมวดหมู่ที่ `/inventory/categories` และสร้างสินค้าที่ `/inventory/products/new` โดยเว้น SKU ว่าง
4. เพิ่มบาร์โค้ดที่สอง ตั้งเป็นหลัก และเปิดหน้าพิมพ์ป้าย
5. สร้างใบรับที่ `/inventory/receipts/new` ด้วยการสแกนบาร์โค้ด และตรวจต้นทุนใน `/inventory/stock`
6. ทดลองรับเข้าสินค้า Serial ด้วยจำนวน Serial ไม่ครบ ต้องถูก reject
7. ทดลองปรับสต๊อกออกเกินยอด ต้องถูก reject
8. ทดลองเก็บสินค้าที่มีสต๊อกถาวร ต้องถูก reject; เมื่อปรับเหลือ 0 ต้องเก็บได้
9. นำเข้า CSV ที่มีแถวผิดหนึ่งแถว ต้องไม่มีสินค้าใดถูกสร้าง; จากนั้นแก้ไฟล์ให้ถูกและนำเข้าใหม่
10. ดาวน์โหลด CSV และเปิดด้วย Excel ตรวจภาษาไทย
11. Login Technician ตรวจเมนูและเปิด `/inventory/receipts` โดยตรง ต้องไป `/forbidden`
12. ย่อหน้าจอเป็น 390px และตรวจว่าไม่มี horizontal overflow

## 13. ข้อจำกัดและงานที่ยังไม่ทำ

- ยังไม่มี pagination ในรายการสินค้า/stock ledger/ใบรับ; ปัจจุบันจำกัดสินค้า 200 และ movement 200 รายการ
- ยังไม่มี bulk stocktake document; ใช้ adjustment ทีละรายการ
- ใบรับแก้ไข/ลบไม่ได้ตามการออกแบบ; ใช้ adjustment เพื่อแก้ยอด
- CSV ยังรองรับเฉพาะสินค้า ไม่รวมหมวดหมู่ ผู้จัดจำหน่าย หรือ Serial
- ไม่มีการ upload รูปสินค้า
- ป้ายพิมพ์ผ่าน browser A4; ยังไม่มี preset เครื่องพิมพ์ฉลากเฉพาะหรือ Zebra/TSPL
- ไม่มีหน้าดู audit log สำหรับผู้ใช้
- ยังไม่มี scheduled cleanup ของ rate-limit bucket
- `npm audit` ยังพบ high vulnerabilities ใน development tooling (9 รายการ) — defer ไป Phase 9
- CSP/HSTS แบบเต็มยัง defer ไป Phase 9
- Phase 2 ยังรออนุมัติอย่างเป็นทางการ
- ยังไม่ได้ตัดสินใจ Admin อนุมัติบิลของตัวเอง (Phase 5)
- ยังไม่ได้เลือก deployment target

## 14. ก่อนเริ่ม Phase 4 — Customers

Phase 4 ต้องใช้:

- ตาราง `Customer` และ seed 5 คนที่มีอยู่แล้ว
- รูปแบบ service/action/validation จาก Phase 2–3
- กฎ soft archive และประวัติการซื้อ/ประกัน
- สิทธิ์ Admin ในการจัดการข้อมูลหลัก และ Technician ในการค้นหา/เพิ่มลูกค้าตาม requirement
- หน้าค้นหาด้วยเบอร์โทรและประวัติซ่อม/เคลมที่จะต่อกับ Phase 5–7

**หยุดรอตรวจ Phase 3 ก่อนเริ่ม Phase 4**
