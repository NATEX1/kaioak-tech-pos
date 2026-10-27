# Phase 8 — Dashboard & Reports

## 1. สรุปงานที่ทำใน Phase 8

### 1.1 Dashboard ภาพรวม (Admin)

เพิ่ม 2 stat card ใหม่:

| Card | ข้อมูล | สี |
|---|---|---|
| **กำไรขั้นต้นเดือนนี้** | `(grandTotal − VAT) − Σ(unitCost × qty)` จากบิล PAID เดือนนี้ | Teal (บวก) / Rose (ลบ) |
| **งานซ่อมค้างอยู่** | นับ `BillRepairDetail` ที่ `repairStatus ≠ DELIVERED` | Purple (>0) / Muted (0) |

Stat card ทุกใบที่มี `href` จะกลายเป็น clickable link ไปยังหน้าที่เกี่ยวข้อง:
- ยอดขายวันนี้ → `/bills?status=PAID`
- ยอดขายเดือนนี้ → `/reports` (Admin) / `/bills?status=PAID` (Tech)
- กำไรขั้นต้นเดือนนี้ → `/reports`
- บิลรออนุมัติ → `/bills?status=PENDING_APPROVAL`
- รอชำระเงิน → `/bills?status=APPROVED`
- คอมมิชชั่นรอจ่าย → `/commissions`
- สินค้าใกล้หมด → `/inventory/low-stock`
- งานซ่อมค้างอยู่ → `/bills?billTypeCode=REPAIR`

Grid เปลี่ยนจาก `xl:grid-cols-6` เป็น `xl:grid-cols-4` เพื่อรองรับ card ที่เพิ่มขึ้น

### 1.2 หน้ารายงานยอดขาย `/reports` (Admin only)

Route: `src/app/(app)/reports/page.tsx`

- ถ้า role ≠ ADMIN → `notFound()` (404)
- 4 Summary cards: ยอดขายรวม, ต้นทุน, กำไรขั้นต้น, ยอดเดือนนี้
- Bar chart แสดง 12 เดือนย้อนหลัง — แถบซ้าย = revenue, แถบขวา = gross profit (สีแดงถ้าติดลบ)
- ตารางรายเดือน เรียงจากใหม่สุด แสดง: บิล, ยอดขายสุทธิ, ต้นทุน, กำไร, Margin%
- แถวรวม 12 เดือนที่ด้านล่างตาราง
- หมายเหตุอธิบายฐานการคำนวณ

สูตร:
```
ยอดขายสุทธิ = grandTotal − vatAmount
ต้นทุนสินค้า = Σ (unitCost × quantity) ต่อ BillItem
กำไรขั้นต้น = ยอดขายสุทธิ − ต้นทุนสินค้า
Gross Margin = กำไรขั้นต้น ÷ ยอดขายสุทธิ × 100
```

### 1.3 Navigation

- เพิ่มเมนู **"รายงานยอดขาย"** (BarChart3 icon) ใน `adminItems` — แสดงเฉพาะ Admin
- อัปเดต version indicator ด้านล่าง sidebar → `Phase 8 · Dashboard & Reports`

---

## 2. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/(app)/page.tsx` | Dashboard — เพิ่ม gross profit + repair pending + clickable cards |
| `src/app/(app)/reports/page.tsx` | หน้ารายงานยอดขายรายเดือน (ใหม่) |
| `src/server/services/reports.ts` | `getMonthlySalesReport()` — query 12 เดือนพร้อม aggregate (ใหม่) |
| `src/components/layout/app-nav.tsx` | เพิ่มเมนู Reports, อัปเดต phase indicator |

---

## 3. ผลการตรวจสอบ

```text
npm run typecheck  → ผ่าน (0 errors)
npm run lint       → ผ่าน (0 warnings, 0 errors)
npm test           → 22 ไฟล์, 145 tests ผ่านทั้งหมด (100%)
npm run build      → ผ่าน (48 routes สำเร็จ — เพิ่ม /reports)
```

---

## 4. วิธีทดสอบด้วยมือ

1. Login Admin เปิด `/` ตรวจ stat cards ครบ 8 ใบ
2. คลิก card **กำไรขั้นต้นเดือนนี้** → ต้องนำทางไปยัง `/reports`
3. ตรวจ Summary 4 cards บน `/reports`
4. ตรวจ Bar chart 12 แท่ง (revenue + gross profit ซ้อน) มีเดือนนี้สีเข้มกว่า
5. ตรวจตารางรายเดือนและแถวรวม
6. Login Technician → ไปที่ `/reports` ต้องได้ 404
7. Technician dashboard ต้องไม่มี card กำไรขั้นต้น แต่มี card งานซ่อมค้าง

---

## 5. ข้อจำกัด งานที่ยังไม่ทำ และการส่งต่อ

- **CSV export รายงาน:** ยังไม่มี export ยอดขาย/กำไรเป็น CSV (พัฒนาเพิ่มได้ใน Phase 9)
- **กำไรสุทธิ:** รายงานแสดงเฉพาะ Gross Profit ยังไม่หักค่าคอมและค่าใช้จ่ายดำเนินการ
- **Repair status หลังอนุมัติ:** ยังแก้สถานะงานซ่อมได้เฉพาะตอนบิลเป็น Draft/Rejected (ยังเปิดรับการตัดสินใจ)
- **Pagination:** รายการบิล/สต๊อกจำกัด 200 รายการ → Phase 9
- **Audit Log UI:** ยังไม่มีหน้าดู Audit Log สำหรับ Admin → Phase 9
- **Security Headers (CSP/HSTS):** → Phase 9
- **Deployment Runbook:** → Phase 9
