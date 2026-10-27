# Phase 9 — Audit Log, Pagination, Security & Deployment

## 1. สรุปงานที่ทำใน Phase 9

Phase 9 มุ่งเน้นการเตรียมความพร้อมของระบบสำหรับ Production (Production Readiness) ทั้งในด้านการตรวจสอบ (Auditability), ประสิทธิภาพในการจัดการข้อมูลปริมาณมาก (Scalability & Pagination), ความมั่นคงปลอดภัย (Security Hardening) และคู่มือการติดตั้งขึ้นระบบ (Deployment Runbook)

---

### 1.1 หน้ารวม Audit Log สำหรับ Admin (`/audit-logs`)

- **หน้า UI กลาง:** สร้างหน้า `/audit-logs` พร้อม guard ป้องกันสิทธิ์ non-admin (`notFound()`)
- **การกรองข้อมูล (Filters):**
  - กรองตามผู้กระทำ (Actor / User)
  - กรองตามประเภท Entity (Bill, Product, Customer, User, Commission, ShopSettings ฯลฯ)
  - กรองตาม Action (ค้นหาตาม keyword หรือ match action code)
  - กรองตามช่วงวันที่ทำรายการ (`from` / `to` พร้อม timezone Bangkok UTC+7)
- **การแสดงผล:**
  - Action Badge แยกสีตามหมวดหมู่ (สีแดงสำหรับ DELETE/VOID, สีเขียวสำหรับ CREATE, สีฟ้าสำหรับ UPDATE/APPROVE, สีม่วงสำหรับ LOGIN/LOGOUT)
  - แสดงชื่อและอีเมลของผู้ทำรายการ (หรือ "ระบบ" ในกรณีที่เป็น system action)
  - Entity ID พร้อมแสดง IP Address ที่ใช้ทำรายการ
  - ป้ายภาษาไทยอธิบายความหมายของแต่ละ Action Code
- **การเชื่อมโยงระบบ:** เพิ่มเมนู "บันทึกระบบ" (`ClipboardList` icon) ในแถบเมนูข้าง (Sidebar) สำหรับ Admin

---

### 1.2 ระบบ Pagination (การแบ่งหน้าแบบ URL-based)

- **Reusable Component (`src/components/ui/pagination.tsx`):**
  - ออกแบบโดยใช้ HTML `<nav>` และ standard Next.js `<Link>` ไม่พึ่งพา client-side state
  - รองรับการ preserve query parameters ที่มีอยู่เดิม (เช่น filters, search query)
  - คำนวณ delta range เพื่อแสดงเลขหน้าใกล้เคียง และแสดง ellipsis เมื่อมีจำนวนหน้ามาก
  - ปุ่ม ย้อนกลับ / ถัดไป พร้อม `aria-disabled` เมื่ออยู่หน้าแรกหรือหน้าสุดท้าย
  - แสดงข้อความสรุปจำนวนหน้าและจำนวนรายการทั้งหมดในรูปแบบภาษาไทย
- **Bills Pagination (`/bills`):**
  - ปรับปรุง `listBills` service ให้รับ `page` และ `pageSize` พร้อมคืน `{ items, totalCount, page, pageSize }`
  - ปรับปรุงหน้า `/bills` ให้แสดงผลรายการบิลพร้อม Pagination
- **Stock Movement Pagination (`/inventory/stock`):**
  - เพิ่ม `listStockMovementsPaginated` service พร้อม `STOCK_MOVEMENTS_PAGE_SIZE = 50`
  - ปรับปรุงหน้า `/inventory/stock` ให้แบ่งหน้าได้อย่างมีประสิทธิภาพ
- **Unit Test:**
  - สร้าง `tests/unit/pagination.test.ts` ครอบคลุมการทำงานของ `buildPageUrl`, การรักษาพารามิเตอร์ และ edge cases

---

### 1.3 เสริมความปลอดภัยด้วย Security Headers (CSP & HSTS)

ปรับปรุง `next.config.ts` ให้มี security headers มาตรฐานความปลอดภัยระดับองค์กร:
- **Content-Security-Policy (CSP):**
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (รองรับ Next.js RSC payload และ hydration scripts)
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (สำหรับ Tailwind CSS v4 runtime styling)
  - `font-src 'self' https://fonts.gstatic.com`
  - `img-src 'self' data: blob:` (รองรับ SVG barcode generation ผ่าน data-URIs)
  - `connect-src 'self'`
  - `frame-ancestors 'none'` (ป้องกัน clickjacking ร่วมกับ X-Frame-Options: DENY)
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
- **HTTP Strict Transport Security (HSTS):**
  - กำหนด `max-age=63072000; includeSubDomains; preload` เฉพาะบน Production เพื่อป้องกัน SSL stripping และไม่รบกวน localhost/development

---

### 1.4 Deployment Runbook & Operational Documentation

- สร้างเอกสาร [docs/deployment-runbook.md](deployment-runbook.md) ครอบคลุม:
  - สเปกฮาร์ดแวร์ขั้นต่ำและข้อแนะนำสำหรับ Production
  - การจัดการตัวแปรสภาพแวดล้อม (`.env`) และ security secrets
  - ขั้นตอนการ deploy ผ่าน Node.js + PM2 (cluster mode) และ Docker Compose
  - การตั้งค่า Nginx Reverse Proxy พร้อม Let's Encrypt SSL
  - แผนสำรองข้อมูลฐานข้อมูล PostgreSQL อัตโนมัติ (Automated pg_dump cron) และขั้นตอนการกู้คืน
  - แผนการอัปเดตระบบแบบ Zero-downtime (`pm2 reload`)

---

## 2. สรุปผลการทดสอบและการตรวจสอบ (Verification Results)

| การตรวจสอบ | ผลลัพธ์ | รายละเอียด |
|---|---|---|
| **TypeScript Typecheck (`npm run typecheck`)** | ✅ ผ่าน (0 errors) | Type definitions ถูกต้องทุกไฟล์ |
| **ESLint (`npm run lint`)** | ✅ ผ่าน (0 errors) | โค้ดสะอาดตรงตาม code standards |
| **Unit & Integration Tests (`npm test`)** | ✅ ผ่าน 150/150 tests | รวมทั้งสิ้น 23 test suites ผ่านทั้งหมด |
| **Production Build (`npm run build`)** | ✅ สำเร็จ (49 routes) | Route `/audit-logs` ถูกคอมไพล์สำเร็จ |

---

## 3. รายการไฟล์ที่สร้างและแก้ไขใน Phase 9

| ไฟล์ | รายละเอียดการเปลี่ยนแปลง |
|---|---|
| `next.config.ts` | เพิ่ม Content-Security-Policy (CSP) และ HSTS headers |
| `src/components/ui/pagination.tsx` | สร้าง URL-based Pagination component พร้อม helper `buildPageUrl` |
| `src/server/services/bills.ts` | เพิ่ม pagination support ใน `listBills` (`page`, `pageSize`, `totalCount`) |
| `src/app/(app)/bills/page.tsx` | เชื่อมต่อ Pagination component ในหน้าบิล |
| `src/server/services/stock.ts` | เพิ่ม `listStockMovementsPaginated` สำหรับ stock ledger |
| `src/app/(app)/inventory/stock/page.tsx` | เชื่อมต่อ Pagination ในหน้าความเคลื่อนไหวสต๊อก |
| `src/server/services/audit-logs.ts` | สร้าง audit log service (`listAuditLogs`, `listAuditEntityTypes`, `listAuditActors`) |
| `src/app/(app)/audit-logs/page.tsx` | สร้างหน้า Audit Log UI พร้อม filter และ pagination |
| `src/components/layout/app-nav.tsx` | เพิ่มเมนู "บันทึกระบบ" สำหรับ Admin |
| `tests/unit/pagination.test.ts` | เขียน unit tests สำหรับ pagination helper |
| `tests/integration/bill-service.test.ts` | ปรับปรุง integration test ให้รองรับ return structure ใหม่ของ `listBills` |
| `docs/deployment-runbook.md` | เอกสารคู่มือการติดตั้งและขึ้นระบบบน Production |
| `docs/09-phase-9-summary.md` | เอกสารสรุปงาน Phase 9 |
| `README.md` | อัปเดตสถานะทุก Phase ให้สมบูรณ์ |
