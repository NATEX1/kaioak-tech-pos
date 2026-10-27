# คู่มือการติดตั้งและขึ้นระบบ (Deployment Runbook) — KAIOAK TECH POS

เอกสารนี้ระบุขั้นตอนการติดตั้ง กำหนดค่า และดูแลรักษาระบบ KAIOAK TECH POS บนสภาพแวดล้อม Production อย่างปลอดภัยและมีเสถียรภาพ

---

## 1. ข้อมูลทางเทคนิคและข้อกำหนดของระบบ (System Requirements)

| รายการ | ข้อกำหนดขั้นต่ำ | ข้อแนะนำ Production |
|---|---|---|
| **CPU** | 2 vCPU | 4 vCPU ขึ้นไป |
| **RAM** | 2 GB | 4–8 GB |
| **Disk** | 20 GB SSD | 50+ GB SSD (ตามปริมาณบิลและรูปภาพ) |
| **Node.js** | v22.12.0 LTS ขึ้นไป | v22 LTS (Active) |
| **Database** | PostgreSQL 17 | Managed PostgreSQL 17 (AWS RDS, GCP Cloud SQL, Supabase, Neon) |
| **OS** | Ubuntu 22.04 LTS / 24.04 LTS หรือ Debian 12 | Linux 64-bit with systemd / Docker |

---

## 2. ตัวแปรสภาพแวดล้อม (Environment Variables)

สร้างไฟล์ `.env` บนเซิร์ฟเวอร์ Production (ห้าม commit ลงใน Git repository):

```bash
# -------------------------------------------------------------
# Database Configuration
# -------------------------------------------------------------
# URL สำหรับ Prisma ORM เชื่อมต่อกับ PostgreSQL 17
DATABASE_URL="postgresql://compos_user:SECURE_STRONG_PASSWORD@db-host:5432/compos_prod?schema=public&sslmode=require&connection_limit=20"

# -------------------------------------------------------------
# NextAuth / Auth.js Configuration
# -------------------------------------------------------------
# สุ่ม key ความยาวอย่างน้อย 32 ตัวอักษร (สร้างด้วย: openssl rand -base64 32)
AUTH_SECRET="your-generated-32-byte-base64-secret-here"
AUTH_URL="https://pos.yourdomain.com"
AUTH_TRUST_HOST="true"

# -------------------------------------------------------------
# Application Runtime
# -------------------------------------------------------------
NODE_ENV="production"
PORT=3000

# -------------------------------------------------------------
# First-install Base Seed (ใช้เฉพาะตอนสร้าง Admin คนแรก)
# -------------------------------------------------------------
SEED_ADMIN_EMAIL="owner@yourdomain.com"
SEED_ADMIN_PASSWORD="CHANGE_ME_TO_A_LONG_UNIQUE_PASSWORD"
SEED_ADMIN_NAME="เจ้าของร้าน"
SEED_SHOP_NAME="ชื่อร้านของคุณ"
```

> [!CAUTION]
> ห้ามใช้ `AUTH_SECRET` หรือรหัสผ่านฐานข้อมูลที่เป็นค่าเริ่มต้นจากเครื่องพัฒนาเด็ดขาด

---

## 3. ขั้นตอนการติดตั้งและการ Deploy (Step-by-Step Deployment)

### วิธีที่ 1: ติดตั้งผ่าน Node.js + PM2 (Bare Metal / VPS)

#### ขั้นตอนที่ 3.1: เตรียมเซิร์ฟเวอร์และ Node.js
```bash
# อัปเดตแพ็กเกจระบบ
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# ติดตั้ง Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# ตรวจสอบเวอร์ชัน
node -v  # ต้องเป็น v22.x
npm -v

# ติดตั้ง PM2 สำหรับ Process Management
sudo npm install -g pm2
```

#### ขั้นตอนที่ 3.2: Clone โค้ดและติดตั้ง Dependencies
```bash
cd /var/www
sudo git clone <repository-url> compos
cd compos
sudo chown -R $USER:$USER /var/www/compos

# ติดตั้ง dependencies แบบ production-safe
npm ci
```

#### ขั้นตอนที่ 3.3: Migration ฐานข้อมูล
```bash
# รัน migration สำหรับ production (ห้ามใช้ prisma migrate dev)
npm run db:deploy

# รัน base seed (Admin แรก, Bill Types, Shop Settings, Document Sequences)
# เฉพาะการติดตั้งครั้งแรก — ไม่สร้างสินค้า/ลูกค้าตัวอย่าง
npm run db:seed:base
```

> [!CAUTION]
> ห้ามใช้ `npm run db:seed` หรือ `npm run db:seed:demo` บน production
> เพราะจะสร้างข้อมูลตัวอย่างและอาจรีเซ็ตรหัสผ่าน/ข้อมูลผู้ใช้เดิม
> ระบบบล็อก demo seed เมื่อ `NODE_ENV=production` เว้นแต่ตั้ง `ALLOW_DEMO_SEED=true` โดยเจตนา

#### ขั้นตอนที่ 3.4: Build ระบบ
```bash
npm run build
```

#### ขั้นตอนที่ 3.5: ตั้งค่า PM2 สำหรับ Auto-restart
สร้างไฟล์ `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: "compos-pos",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      error_file: "/var/log/compos/err.log",
      out_file: "/var/log/compos/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
```

รันระบบและบันทึก startup script:
```bash
mkdir -p /var/log/compos
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

### วิธีที่ 2: ติดตั้งผ่าน Docker Compose

ไฟล์ `docker-compose.prod.yml` ตัวอย่าง:

```yaml
version: "3.8"

services:
  db:
    image: postgres:17-alpine
    restart: always
    environment:
      POSTGRES_DB: compos_prod
      POSTGRES_USER: compos_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_URL: "postgresql://compos_user:${DB_PASSWORD}@db:5432/compos_prod?schema=public"
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL}
      AUTH_TRUST_HOST: "true"
      NODE_ENV: "production"
    depends_on:
      - db

volumes:
  postgres_data:
```

---

## 4. Reverse Proxy และการตั้งค่า SSL (Nginx + Let's Encrypt)

### ตัวอย่างการตั้งค่า Nginx (`/etc/nginx/sites-available/compos`)

```nginx
server {
    server_name pos.yourdomain.com;

    # Client body limit สำหรับการอัปโหลด CSV / เอกสาร
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Static assets caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    listen 80;
}
```

ขอใบรับรอง SSL ฟรีด้วย Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pos.yourdomain.com
```

---

## 5. ความปลอดภัยและ Security Checklist

- [x] **Strict Content-Security-Policy (CSP):** เปิดใช้งานผ่าน `next.config.ts` ป้องกัน XSS และ Injection
- [x] **HTTP Strict Transport Security (HSTS):** เปิด `max-age=63072000; includeSubDomains; preload` เมื่อรันบน HTTPS
- [x] **Rate Limiting:** ระบบจำกัดการเข้าสู่ระบบ 5 ครั้งต่อ 15 นาทีต่อ IP + Email พร้อม HMAC Advisory lock
- [x] **Audit Logging:** บันทึกการกระทำสำคัญทุกประเภท (Login, บิล, สต๊อก, ค่าคอม, การตั้งค่า) ในตาราง `AuditLog`
- [x] **RBAC Guards:** ตรวจสอบสิทธิ์ Admin / Technician ทุก Route และ Server Action แบบ 2 ชั้น
- [x] **No Plaintext Passwords:** เข้ารหัสผ่านด้วย bcrypt cost factor 12
- [x] **Safe Database Access:** ใช้ Prisma Parameterized Queries ป้องกัน SQL Injection 100%

---

## 6. แผนสำรองข้อมูลและกู้คืน (Backup & Disaster Recovery)

### 6.1 การสำรองข้อมูลอัตโนมัติ (Automated Daily Backup)
สร้างสคริปต์ `/opt/backup/backup_postgres.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backup/dumps"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/compos_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

# ทำการ dump และ gzip
pg_dump -h localhost -U compos_user compos_prod | gzip > $FILENAME

# ลบไฟล์สำรองที่มีอายุเกิน 30 วัน
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $FILENAME"
```

ตั้งค่า Cron job (`sudo crontab -e`):
```cron
# สำรองข้อมูลทุกวันเวลา 03:00 น.
0 3 * * * /opt/backup/backup_postgres.sh >> /var/log/compos_backup.log 2>&1
```

### 6.2 การกู้คืนข้อมูล (Database Restore)
```bash
# แตกไฟล์และกู้คืนลงฐานข้อมูล
gunzip -c /opt/backup/dumps/compos_backup_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U compos_user compos_prod
```

---

## 7. การอัปเดตระบบ (Deployment Pipeline / Updates)

เมื่อมีการอัปเดตโค้ดเวอร์ชันใหม่:
```bash
cd /var/www/compos

# ดึงโค้ดล่าสุด
git pull origin main

# ติดตั้ง dependencies ใหม่หากมีการเปลี่ยนแปลง
npm ci

# รัน migration (ถ้ามี)
npm run db:deploy

# ตรวจสอบความถูกต้อง
npm run typecheck
npm test

# Build production bundle
npm run build

# Reload service แบบ zero-downtime
pm2 reload compos-pos
```
