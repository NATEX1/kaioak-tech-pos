# Phase 10 — Production Launch Readiness

> วันที่: 23 ตุลาคม 2569
> สถานะ: **✅ Phase 10 สมบูรณ์ — Production Ready**

## 1. ภาพรวม

Phase 10 คือขั้นตอนสุดท้ายก่อนขึ้น Production จริง ครอบคลุมการปิดช่องโหว่ที่ตรวจพบใน Phase 9 Audit Report (`docs/09-phase-9-audit.md`) ระดับ P2 ซึ่งเป็น backlog ที่ไม่ได้บล็อก P0/P1 แต่ควรปิดก่อนส่งมอบ

---

## 2. รายการที่ดำเนินการใน Phase 10

### 2.1 Backup Script จริงใน Repository

**ไฟล์:** `scripts/backup_postgres.sh`

- สคริปต์ `pg_dump` ที่ใช้ได้จริงใน repo (ไม่ใช่แค่ตัวอย่างใน runbook)
- อ่าน config จาก environment variables (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `BACKUP_DIR`, `BACKUP_KEEP_DAYS`)
- ตรวจสอบความสมบูรณ์ของไฟล์ด้วย `gzip -t` หลัง backup
- ลบ backup เก่าเกิน `BACKUP_KEEP_DAYS` วันอัตโนมัติ
- เหมาะสำหรับใช้กับ cron job:
  ```
  0 3 * * * /opt/compos/scripts/backup_postgres.sh >> /var/log/compos_backup.log 2>&1
  ```

---

### 2.2 Rate-Limit Row Cleanup

**ไฟล์:** `src/server/auth/rate-limit.ts`

เพิ่ม `pruneExpiredRateLimits()`:
- ลบ `RateLimitBucket` rows ที่ window expired แล้วออกจาก DB
- ป้องกันตาราง `RateLimitBucket` โตโดยไม่จำเป็น
- เรียกอัตโนมัติจาก health check endpoint (`/api/health`) แบบ fire-and-forget
- ไม่กระทบ latency ของ health check response

**ไฟล์:** `src/app/api/health/route.ts`

- Wire `pruneExpiredRateLimits()` เข้ากับ health check (fire-and-forget)

---

### 2.3 Trusted Proxy IP Validation

**ไฟล์:** `src/server/auth/request-context.ts`

แก้ปัญหา `x-forwarded-for` header ที่อาจถูก spoof ได้:

- เพิ่ม CIDR-based trusted proxy validation ด้วย pure Node.js (ไม่ต้องพึ่ง library)
- รองรับ IPv4 exact match และ /0–/32 CIDR notation, IPv6 exact match (เช่น `::1`)
- Normalize ค่าใน header ก่อนตรวจ: ตัดช่องว่าง, ตัด port (`203.0.113.5:4443`, `[::1]:443`), แปลง `::ffff:a.b.c.d` เป็น IPv4
- อ่าน config จาก `TRUSTED_PROXY_CIDRS` (comma-separated) ทุกครั้งที่เรียกใช้
- **ถ้าไม่ตั้งค่า** → ใช้ค่าแรก (ซ้ายสุด) ของ chain ตามพฤติกรรมเดิม (dev / LAN)
- **ถ้าตั้งค่า** → อ่าน chain จาก **ขวาไปซ้าย** ข้าม hop ที่เป็น trusted proxy แล้วใช้ hop แรกที่ไม่ใช่ proxy เป็น IP ของ client

เหตุผลที่ต้องอ่านจากขวาไปซ้าย: proxy จะ **ต่อท้าย** ค่าที่ client ส่งมา (`$proxy_add_x_forwarded_for`) ดังนั้นค่าที่อยู่ขวาสุดคือค่าที่ proxy ที่เชื่อถือได้เป็นผู้เติม ถ้าใช้ค่าซ้ายสุด (แบบเดิม) client จะปลอม IP ตัวเองได้ทันที

**ข้อจำกัดที่ต้องทราบ:** Request ของ Next.js ไม่มี socket IP ให้อ่าน (Next เติม `x-forwarded-for` จาก socket เฉพาะเมื่อ header ว่าง) ถ้าเปิดแอปตรงสู่ internet และ client ส่ง header มาเอง ระบบยังคงเห็นค่าที่ client ส่ง — จึงต้องตั้ง `TRUSTED_PROXY_CIDRS` และให้ reverse proxy เป็นผู้เติม/เขียน header ใหม่เสมอ

**ไฟล์:** `.env.example`

เพิ่ม `TRUSTED_PROXY_CIDRS` พร้อม comment อธิบาย

**ไฟล์:** `src/lib/env.ts`

เพิ่ม `TRUSTED_PROXY_CIDRS` ใน Zod schema (optional)

**Unit Tests:** `tests/unit/request-context.test.ts` — 23 tests ที่ import โมดูลจริง (`getRequestContext`, `resolveClientIp`, `isTrustedProxyIp`, `normalizeIp`) ครอบคลุม:
- ไม่มี CIDR → trust all (dev mode)
- Exact IPv4 match, /24, /12, /32, /0 CIDR blocks
- Docker internal network (172.16.0.0/12)
- IPv6 exact match และค่าที่มี port
- Client วาง IP ปลอมไว้หน้าสุดแล้ว proxy ต่อท้าย → ระบบเลือก IP จริง
- ข้าม trusted hop หลายชั้น, fallback เมื่อทุก hop เป็น proxy
- `getRequestContext` แบบ end-to-end ผ่าน `Request` จริง รวม fallback `x-real-ip`, `unknown` และการตัดความยาว header

---

### 2.4 Mobile Navigation

**ไฟล์:** `src/components/layout/app-nav.tsx`

ปรับ mobile navigation ให้อ่านง่ายบนจอแคบ:
- mobile items เป็น icon ด้านบนและ label ด้านล่าง (ไม่ใช่ icon-only) เพื่อให้ผู้ใช้เข้าใจเมนูได้ทันที
- label แสดงที่ ≥ 375 px และซ่อนต่ำกว่านั้นโดยยังคง `aria-label`/`title` ไว้
- แถบเมนูเลื่อนแนวนอนได้ (`overflow-x-auto`) เพราะ Admin มี 11 เมนู — เลือกความชัดของ label มากกว่าการบีบทุกเมนูให้อยู่ในแถวเดียว
- Icon ขนาด `size-5` และ `gap-0.5` / `px-2.5` ให้ touch target กะทัดรัด
- อัปเดต footer text จาก "Phase 9" เป็น "Phase 10 · Production Ready"

---

## 3. สรุปผลการตรวจสอบ

| การตรวจสอบ | ผลลัพธ์ |
|---|---|
| `npm run build` | ✅ ผ่าน (0 errors) |
| `npm test` | ✅ 189 passed (27 ไฟล์) |
| TypeScript typecheck (`tsc --noEmit`) | ✅ ผ่าน |
| ESLint ไฟล์ที่แก้ไข | ✅ ผ่าน |
| `scripts/backup_postgres.sh` | ✅ `bash -n` ผ่าน (`set -euo pipefail`, integrity check, prune) — ไม่ได้รัน `pg_dump`/shellcheck ในเครื่องนี้ |

---

## 4. รายการไฟล์ที่สร้างและแก้ไขใน Phase 10

| ไฟล์ | รายละเอียด |
|---|---|
| `scripts/backup_postgres.sh` | Backup script จริง พร้อม integrity check และ prune |
| `src/server/auth/rate-limit.ts` | เพิ่ม `pruneExpiredRateLimits()` |
| `src/app/api/health/route.ts` | Wire pruning เข้า health check (fire-and-forget) |
| `src/server/auth/request-context.ts` | CIDR-based trusted proxy validation |
| `src/lib/env.ts` | เพิ่ม `TRUSTED_PROXY_CIDRS` ใน Zod schema |
| `.env.example` | เพิ่ม `TRUSTED_PROXY_CIDRS` พร้อม comment |
| `src/components/layout/app-nav.tsx` | Mobile nav icon+label column, no horizontal scroll |
| `tests/unit/request-context.test.ts` | 23 unit tests ที่ทดสอบโมดูลจริง (CIDR, normalization, chain resolution, end-to-end) |
| `docs/10-phase-10-summary.md` | เอกสารสรุป Phase 10 |
