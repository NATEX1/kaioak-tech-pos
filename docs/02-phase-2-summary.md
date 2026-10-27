# Phase 2 — Authentication, Session และ RBAC

> สถานะ: **เสร็จสิ้น รอตรวจ** — ยังไม่เริ่ม Phase 3

## 1. สรุปสิ่งที่ทำเสร็จ

- เพิ่ม Auth.js Credentials Provider ด้วยอีเมลและรหัสผ่าน
- เข้ารหัสผ่านด้วย bcrypt cost 12 และนโยบายรหัสผ่าน 12–64 ตัวอักษร ไม่เกิน 72 ไบต์
- ใช้ JWT session cookie แบบ `httpOnly` พร้อม idle timeout 30 นาที และ absolute timeout 12 ชั่วโมง
- ตรวจสถานะบัญชี `isActive`, role และ `tokenVersion` กับฐานข้อมูลทุก request ที่เข้า protected route
- เพิ่ม RBAC 2 ระดับ: `ADMIN` และ `TECHNICIAN`
- เพิ่มระบบจัดการผู้ใช้สำหรับ Admin
  - ดูรายการและรายละเอียดผู้ใช้
  - สร้างบัญชีใหม่
  - แก้ชื่อ เบอร์โทร และบทบาท
  - ตั้งรหัสผ่านใหม่
  - เปิด/ปิดใช้งานบัญชี
- เพิ่มหน้าลงชื่อเข้าใช้, Profile, Forbidden และ Dashboard ภาษาไทย responsive
- เพิ่ม rate limit สำหรับ login ผิด 5 ครั้งต่อ 15 นาทีต่ออีเมล + IP
- เพิ่ม audit log สำหรับ login และการจัดการผู้ใช้
- เพิ่ม security headers พื้นฐานและ safe redirect
- เพิ่มชุดทดสอบ unit/integration และตรวจ browser flow จริง

## 2. Authentication Flow

1. ผู้ใช้กรอกอีเมล/รหัสผ่านที่ `/login`
2. Server Action ส่งข้อมูลไปยัง Auth.js Credentials Provider
3. ระบบ normalize อีเมลและตรวจ schema
4. ตรวจ rate limit จากอีเมล + IP
5. ค้นหาผู้ใช้และตรวจ bcrypt hash
6. ตรวจ `isActive` หลังรหัสผ่านถูกต้อง เพื่อไม่เปิดเผยสถานะบัญชี
7. บันทึก `AUTH_LOGIN_SUCCESS`, อัปเดต `lastLoginAt` และล้าง rate-limit bucket
8. Auth.js ออก JWT cookie พร้อม `userId`, `role`, `tokenVersion`, `signedInAt`, `lastSeenAt`
9. `proxy.ts` ตรวจ session เบื้องต้น แล้ว layout/page ตรวจซ้ำกับฐานข้อมูล

### Session lifecycle

- **Idle timeout:** 30 นาทีจากการใช้งานล่าสุด
- **Absolute timeout:** 12 ชั่วโมงจากเวลาที่ login
- JWT อัปเดต `lastSeenAt` เมื่อมี request ที่ผ่าน Auth.js โดยมี `updateAge` 60 วินาที
- Protected server guard จะ redirect ไป `/login?reason=session-expired` เมื่อ session หมดอายุ
- `Auth.js maxAge` ถูกตั้งไว้ 12 ชั่วโมง แต่ระบบยังตรวจ absolute timeout เองด้วย `signedInAt`

## 3. การยกเลิก Session

`tokenVersion` ถูกเก็บใน JWT และฐานข้อมูล การเปลี่ยนแปลงต่อไปนี้จะเพิ่ม `tokenVersion`:

- เปลี่ยนบทบาท
- เปิด/ปิดใช้งานบัญชี
- Admin ตั้งรหัสผ่านใหม่ให้ผู้ใช้
- ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง

เมื่อ token version ไม่ตรงหรือบัญชีถูกปิด ระบบจะไม่ยอมรับ session เดิมทันที แม้ cookie ยังไม่หมดอายุ

## 4. RBAC

| Route | Admin | Technician |
|---|---|---|
| `/` | เข้าได้ | เข้าได้ |
| `/profile` | เข้าได้ | เข้าได้ |
| `/forbidden` | เข้าได้ | เข้าได้ |
| `/settings/users` | เข้าได้ | `/forbidden` |
| `/settings/users/new` | เข้าได้ | `/forbidden` |
| `/settings/users/[id]` | เข้าได้ | `/forbidden` |

การตรวจมีหลายชั้น:

- `proxy.ts` กันผู้ที่ไม่มี session
- `requireUser()` ตรวจ session + บัญชี + token version
- `requireAdmin()` ตรวจ role ที่ server
- Server Actions เรียก guard ซ้ำก่อนทำงานทุกครั้ง
- Service layer ตรวจ role ซ้ำอีกชั้น (`assertAdmin`)
- การซ่อนเมนูมีไว้เพื่อ UX เท่านั้น

## 5. การจัดการผู้ใช้และกฎป้องกัน

- อีเมลถูก trim, lowercase และ unique
- Admin แก้ไขอีเมลไม่ได้ เพื่อลดความสับสนเรื่อง identity; ต้องสร้างบัญชีใหม่หากจำเป็น
- Admin เปลี่ยนบทบาทของตัวเองไม่ได้
- Admin ปิดใช้งานบัญชีของตัวเองไม่ได้
- Admin ตั้งรหัสผ่านใหม่ให้ตัวเองผ่านหน้าจัดการไม่ได้ ต้องใช้ `/profile`
- ระบบไม่อนุญาตให้เหลือ Admin ที่ active เป็นศูนย์
- ใช้ PostgreSQL advisory lock ระหว่างแก้ role/สถานะ เพื่อลด race condition
- การปิดใช้งานไม่ลบผู้ใช้หรือประวัติ; เก็บ `deactivatedAt` และเปิดใช้งานใหม่ได้
- ไม่มีการลบผู้ใช้ถาวรจาก UI

### Last-admin protection

ก่อนลดสิทธิ์หรือปิดใช้งาน Admin ที่ยัง active ระบบจะนับ Admin active คนอื่นที่เหลือภายใน transaction เดียวกัน หากเหลือ 0 จะ reject ด้วย `LAST_ADMIN`

## 6. Login Rate Limit

- 5 ครั้งแรกในช่วง 15 นาทีถูกอนุญาตให้ตรวจรหัสผ่าน
- ครั้งที่ 6 ขึ้นไปถูกบล็อก 15 นาที
- key คือ HMAC-SHA256 ของ `email + IP` โดยใช้ `AUTH_SECRET`
- ไม่เก็บอีเมลหรือ IP ดิบในตาราง `RateLimitBucket`
- ใช้ `pg_advisory_xact_lock` ต่อ key เพื่อกัน parallel requests หลบ limit
- login สำเร็จจะลบ bucket ของ key นั้น

ข้อควรระวังในการ deploy: ระบบอ่าน IP จาก `x-forwarded-for`, `x-real-ip` หรือ `cf-connecting-ip` จึงต้องตั้ง reverse proxy ให้ส่ง header ที่เชื่อถือได้เท่านั้น

## 7. Audit Log

บันทึกเหตุการณ์:

- `AUTH_LOGIN_SUCCESS`
- `AUTH_LOGIN_FAILED` (invalid credentials / inactive account)
- `AUTH_LOGIN_BLOCKED` (rate limited)
- `AUTH_LOGOUT`
- `USER_CREATED`
- `USER_UPDATED`
- `USER_DEACTIVATED`
- `USER_REACTIVATED`
- `USER_PASSWORD_RESET`
- `USER_PASSWORD_CHANGED`

พร้อม actor, entity, IP, user agent, before/after หรือ metadata ตามความเหมาะสม

## 8. UI ที่เพิ่ม

- `/login` — หน้า login พร้อมข้อความ session หมดอายุ/บัญชีถูกปิด/rate limit
- `/` — Dashboard สรุปข้อมูลพื้นฐานและสถานะ Phase
- `/profile` — เปลี่ยนรหัสผ่านของตัวเอง
- `/forbidden` — หน้าแจ้งสิทธิ์ไม่เพียงพอ
- `/settings/users` — รายชื่อและสรุปจำนวนผู้ใช้
- `/settings/users/new` — สร้างผู้ใช้
- `/settings/users/[id]` — แก้ไข เปลี่ยนสถานะ และตั้งรหัสผ่านใหม่
- App shell รองรับ desktop/tablet/mobile พร้อมเมนูตาม role

## 9. ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `src/auth.config.ts` | Auth.js config ที่ไม่แตะ DB สำหรับ proxy |
| `src/auth.ts` | Credentials Provider และ Prisma/rate limit/audit |
| `src/proxy.ts` | ชั้นกัน request ก่อนเข้า protected route |
| `src/server/auth/session.ts` | ตรวจ session กับ DB, `requireUser`, `requireAdmin` |
| `src/server/auth/session-policy.ts` | กติกา idle/absolute timeout |
| `src/server/auth/rate-limit.ts` | rate limiting ด้วย PostgreSQL |
| `src/server/auth/password.ts` | bcrypt และ dummy comparison |
| `src/server/services/auth-service.ts` | login, audit, last login |
| `src/server/services/users.ts` | จัดการผู้ใช้และกฎความปลอดภัย |
| `src/server/actions/users.ts` | Server Actions + validation + form state |
| `src/server/actions/auth.ts` | logout |
| `src/server/audit.ts` | helper เขียน audit log |
| `src/server/validators/*` | Zod schemas |
| `tests/integration/login-rate-limit.test.ts` | ทดสอบ rate limit และ concurrency |
| `tests/integration/users-service.test.ts` | ทดสอบ service และ audit |
| `tests/unit/session-policy.test.ts` | ทดสอบ timeout |
| `tests/unit/safe-redirect.test.ts` | ทดสอบ open redirect |
| `tests/unit/auth-validation.test.ts` | ทดสอบ password/email policy |

## 10. ผลตรวจสอบ

รันเมื่อเสร็จ Phase 2:

```text
npm run typecheck  → ผ่าน
npm run lint       → ผ่าน
npm test           → 7 ไฟล์, 43 tests ผ่านทั้งหมด
npm run build      → ผ่าน
```

Browser flow ที่ตรวจด้วย Chrome/Playwright:

- Login ผิดแล้วอีเมลยังอยู่ในช่องกรอก
- Login ผิด 6 ครั้งแสดงข้อความ rate limit
- สร้างผู้ใช้โดยรหัสผ่านยืนยันไม่ตรง ฟอร์มยังคงชื่อ/เบอร์/อีเมล/บทบาท
- สร้างผู้ใช้สำเร็จ
- เปลี่ยนรหัสผ่านแล้ว session ทั้งหมดถูกยกเลิก
- รหัสผ่านใหม่ใช้ได้ รหัสผ่านเก่าใช้ไม่ได้
- Admin ตั้งรหัสผ่านใหม่ให้ผู้ใช้แล้ว session เดิมถูกยกเลิก
- Technician เปิด `/settings/users` แล้วถูกพาไป `/forbidden`
- Logout กลับไป `/login?reason=logged-out`
- Desktop, tablet และ mobile layout ใช้งานได้

## 11. วิธีทดสอบด้วยมือ

1. ตรวจว่า PostgreSQL ทำงาน: `docker compose ps`
2. เตรียมข้อมูล: `npm run db:migrate && npm run db:seed`
3. เริ่มเซิร์ฟเวอร์: `npm run dev`
4. Login ด้วย Admin จาก `.env`
5. สร้างผู้ใช้ใหม่ที่ `/settings/users/new`
6. Logout แล้ว login ด้วยผู้ใช้ใหม่ ตรวจว่าถูกบังคับตาม role
7. ให้ Admin ปิดใช้งานผู้ใช้ ขณะที่ผู้ใช้ยัง login อยู่อีก browser
8. refresh browser ของผู้ใช้ ต้องถูกพาออกไปที่หน้า login
9. เปิดใช้งานบัญชีอีกครั้งและ login ด้วยรหัสผ่านเดิม
10. ทดลอง login ผิด 6 ครั้งเพื่อดู rate limit
11. เปลี่ยนรหัสผ่านที่ `/profile` และตรวจว่าอุปกรณ์อื่นถูกออกจากระบบ

## 12. ข้อจำกัดและงานที่ยังไม่ทำ

- CSP และ HSTS แบบเต็มยังไม่ทำ; จะทำใน Phase 9
- `npm audit` พบช่องโหว่ใน development tooling (9 high) — defer ไป security review Phase 9
- Auth.js ที่ใช้เป็น `5.0.0-beta.32`; ควรติดตามรุ่น stable ก่อน production
- ยังไม่มีหน้าดู Audit Log
- หน้าจัดการผู้ใช้ยังไม่มี search/pagination; เหมาะกับจำนวนผู้ใช้ของร้านเดียว
- ไม่มีการส่งอีเมล/รหัสผ่านอัตโนมัติ; Admin ต้องส่งให้ผู้ใช้เอง
- ยังไม่มีบังคับเปลี่ยนรหัสผ่านชั่วคราวเมื่อ login ครั้งแรก
- Rate-limit rows ที่ไม่มีการพยายามใหม่จะไม่ถูก cleanup อัตโนมัติ; ควรมี scheduled cleanup ก่อน production
- การอ่าน IP สำหรับ rate limit ต้องตั้ง reverse proxy ให้ปลอดภัย
- ยังไม่ได้ตัดสินใจเรื่อง Admin อนุมัติบิลของตัวเอง (เกี่ยวข้องกับ Phase 5)
- ยังไม่ได้เลือก deployment target

## 13. ก่อนเริ่ม Phase 3

Phase 3 จะเริ่ม Products + Inventory ต้องใช้:

- สิทธิ์ Admin ในการจัดการสินค้าและสต๊อก
- สิทธิ์ Technician ในการดูสินค้า/สแกนบาร์โค้ด
- Audit actor จาก `requireUser()`
- Decimal utility และ stock ledger ที่มีอยู่แล้วใน schema
- รูปแบบ transaction และ validation ที่ใช้ใน Phase 2

ยังไม่มีการเริ่มต้น implementation ของ Phase 3 ในรอบนี้
