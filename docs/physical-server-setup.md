# คู่มือเตรียมเครื่องเซิร์ฟเวอร์จริงสำหรับ KLYX LAB POS

> เอกสารนี้สำหรับ **เครื่องคอมพิวเตอร์ที่ตั้งในร้าน/ออฟฟิศ (on-premise)** ไม่ใช่ VPS หรือ cloud
> แนวทางที่แนะนำคือ **Ubuntu Server 24.04 LTS + Docker Engine + Docker Compose + PostgreSQL 17 + Nginx**
> ตัวแอปและฐานข้อมูลจะรันอยู่ใน Docker บนเครื่องเดียวกัน โดยเปิดให้เครื่องลูกข่ายในร้านเข้าถึงผ่าน Nginx เท่านั้น

---

## 0. สรุปสิ่งที่จะได้

เมื่อทำตามคู่มือนี้ครบ จะได้:

- เครื่องเซิร์ฟเวอร์ Linux ที่มี IP คงที่ใน LAN
- ระบบ KLYX LAB POS รันอัตโนมัติหลังไฟดับ/รีบูต
- PostgreSQL 17 เก็บข้อมูลใน Docker volume
- Nginx เป็นทางเข้าหลักของเครื่องลูกข่าย
- Backup ฐานข้อมูลรายวัน พร้อมวิธี restore
- แนวทางป้องกันเครื่องและข้อมูลเบื้องต้น
- Checklist ก่อนเปิดใช้งานจริง

**สิ่งที่คู่มือนี้ไม่ครอบคลุม**

- ระบบสำรองเครื่องแบบ High Availability (HA) หรือ load balancer หลายเครื่อง
- การเปิดระบบออกสู่อินเทอร์เน็ตโดยตรงแบบ public internet
- การเชื่อมต่อเครื่องพิมพ์ ESC/POS แบบควบคุม cash drawer โดยตรง
- การยืนยันการรับเงิน PromptPay อัตโนมัติจากธนาคาร

สำหรับฟีเจอร์และ workflow ของตัวระบบ ดูเพิ่มเติมที่ [ภาพรวมระบบ](system-overview.md)

---

## 1. เลือกรูปแบบการใช้งานก่อนซื้อเครื่อง

### 1.1 LAN-only — แนะนำสำหรับร้านทั่วไป

```text
เครื่องลูกข่ายในร้าน (POS / แท็บเล็ต / คอมหลังร้าน)
                    │
                    ▼
              Router / Switch
                    │
                    ▼
        ┌───────────────────────┐
        │  เครื่องเซิร์ฟเวอร์     │
        │  Nginx :80/:443        │
        │  App :3000 (localhost) │
        │  PostgreSQL :5432      │
        │  (localhost เท่านั้น)   │
        └───────────────────────┘
```

- เครื่องลูกข่ายเข้าผ่าน `http://192.168.1.10` หรือชื่อภายในเช่น `http://pos.klyxlab.lan`
- ไม่เปิดพอร์ตออกอินเทอร์เน็ต
- PostgreSQL และพอร์ตแอปผูกกับ `127.0.0.1` เท่านั้น
- เหมาะกับร้านที่มีเครื่อง POS อยู่ใน LAN เดียวกัน

### 1.2 Remote access ผ่าน VPN — แนะนำเมื่อต้องเข้าจากนอกสถานที่

ใช้ **Tailscale** หรือ **WireGuard** ติดตั้งบนเซิร์ฟเวอร์และอุปกรณ์ของผู้ดูแล

- ไม่ต้อง forward port ที่ router
- ไม่ต้องเปิดแอปหรือฐานข้อมูลสู่อินเทอร์เน็ต
- เข้าผ่าน IP ของ VPN หรือ HTTPS ของ Tailscale Serve
- เหมาะกับการดูแลระยะไกล การเช็กยอด หรือการพิมพ์เอกสารจากบ้าน

### 1.3 Public internet — ไม่แนะนำถ้าไม่จำเป็น

ถ้าจำเป็นต้องเปิดให้เข้าจากอินเทอร์เน็ตจริง ๆ ต้องมีอย่างน้อย:

- โดเมน + HTTPS ที่ถูกต้อง
- Nginx เป็น reverse proxy
- Firewall เปิดเฉพาะ 80/443
- ไม่เปิด 3000 และ 5432 สู่ภายนอก
- อัปเดตระบบสม่ำเสมอ
- จำกัดสิทธิ์ผู้ใช้และตรวจ audit log

แต่สำหรับระบบ POS ที่มีข้อมูลลูกค้าและยอดขาย **VPN ปลอดภัยกว่าและดูแลง่ายกว่า**

---

## 2. สเปกเครื่องที่แนะนำ

### 2.1 สเปกขั้นต่ำและสเปกที่แนะนำ

| รายการ | ขั้นต่ำ | แนะนำสำหรับProduction |
|---|---|---|
| CPU | 4 cores (x86-64) | 6–8 cores |
| RAM | 8 GB | 16 GB |
| Storage | 256 GB SSD | 512 GB NVMe หรือ SSD |
| Disk redundancy | ไม่มีก็ได้ แต่ต้องมี backup | 2 ลูก RAID 1 |
| Network | Gigabit Ethernet 1 port | Gigabit Ethernet + UPS |
| UPS | 800 VA | 1000–1500 VA พร้อม USB monitoring |
| OS | Ubuntu Server 24.04 LTS | Ubuntu Server 24.04 LTS |
| Backup | External HDD/NAS | NAS + สำเนา offsite |

> ฐานข้อมูลของร้านขนาดเล็กไม่ได้ใช้พื้นที่มาก พื้นที่ส่วนใหญ่จะถูกใช้โดย OS, Docker images, logs และ backup
> จึงควรเน้น SSD ที่เชื่อถือได้มากกว่าความจุเยอะ ๆ

### 2.2 ตัวอย่างเครื่องที่เหมาะสม

**แบบ Mini PC (ประหยัดพื้นที่)**

- Intel Core i5 หรือ Ryzen 5 รุ่นประหยัดพลังงาน
- RAM 16 GB
- NVMe 512 GB
- Gigabit LAN 2 พอร์ต (ถ้ามี)
- UPS 800–1000 VA
- วางในที่ระบายอากาศดี ไม่วางบนพรมหรือในตู้ปิดทึบ

**แบบ Tower (ซ่อมง่าย/ขยายง่าย)**

- Intel Core i5 หรือ Ryzen 5
- RAM 16 GB
- SSD 512 GB จำนวน 2 ลูก ทำ RAID 1
- Power supply คุณภาพดี
- UPS 1000–1500 VA
- การ์ดจอออนบอร์ดเพียงพอ ไม่ต้องใช้การ์ดจอแยก

### 2.3 สิ่งที่ควรหลีกเลี่ยง

- ใช้ laptop เป็นเซิร์ฟเวอร์หลัก เพราะระบายความร้อนและอายุแบตเตอรี่ไม่เหมาะกับการเปิด 24/7
- ใช้ Raspberry Pi เป็นเครื่องหลักสำหรับProduction แม้จะรันได้ แต่ build และ performance ไม่คุ้มความเสี่ยง
- ใช้ external HDD เป็นที่เก็บฐานข้อมูลหลัก
- ใช้เครื่องที่ไม่มี UPS ในพื้นที่ที่ไฟตกบ่อย
- ใช้ Windows Server หรือ Windows 10/11 เป็น host หลัก หากไม่มีความจำเป็น เพราะ Docker/Linux ดูแลง่ายกว่า
- ใช้ Wi-Fi เป็นช่องทางหลักของเซิร์ฟเวอร์ ควรใช้สาย Ethernet

### 2.4 หมายเหตุเรื่อง ARM64

Docker image ของโปรเจกต์ใช้ `node:22-alpine` และ `postgres:17-alpine` ซึ่งมี ARM64 ให้เลือก
แต่การ build Next.js บน ARM64 อาจช้ากว่าและอาจเจอปัญหา native module บางตัว
หากเป็นไปได้ เลือกเครื่อง **x86-64** สำหรับProduction จะปลอดภัยกว่า

---

## 3. วางแผนเครือข่าย ไฟฟ้า และสถานที่

### 3.1 IP plan ตัวอย่าง

| อุปกรณ์ | IP | หมายเหตุ |
|---|---|---|
| Router | `192.168.1.1` | ตั้ง DHCP reservation ให้เซิร์ฟเวอร์ |
| เซิร์ฟเวอร์ | `192.168.1.10` | ตั้งคงที่ |
| POS เครื่องที่ 1 | `192.168.1.21` | DHCP reservation |
| POS เครื่องที่ 2 | `192.168.1.22` | DHCP reservation |
| เครื่องพิมพ์เน็ตเวิร์ก | `192.168.1.30` | ตามคู่มือเครื่องพิมพ์ |
| DHCP pool | `192.168.1.100–199` | หลีกเลี่ยงช่วง IP ของอุปกรณ์สำคัญ |

**วิธีที่แนะนำ:** ตั้ง DHCP reservation ที่ router โดยผูก MAC address ของเซิร์ฟเวอร์กับ IP `192.168.1.10`
และตั้ง static IP ซ้ำบนเครื่องเซิร์ฟเวอร์อีกชั้น เพื่อไม่ให้ IP เปลี่ยนเมื่อ router รีเซ็ต

### 3.2 ตั้งค่า router ที่ควรทำ

- เปลี่ยนรหัสผ่าน admin ของ router จากค่า default
- ปิด UPnP
- ไม่ทำ port forwarding ไปที่ 3000 หรือ 5432
- แยก guest Wi-Fi ออกจาก Wi-Fi ของร้าน
- ใช้ WPA2/WPA3 และปิด WPS
- อัปเดต firmware router
- ถ้ามี VLAN ให้แยก VLAN สำหรับ POS/เซิร์ฟเวอร์ออกจาก Wi-Fi ลูกค้า

### 3.3 ไฟฟ้าและ UPS

- ต่อเซิร์ฟเวอร์, router และ switch เข้า UPS
- เลือก UPS ที่มีพอร์ต USB และรองรับ software เช่น NUT
- ตั้ง BIOS เป็น **Restore on AC Power Loss = Power On**
- ตั้งระบบให้ shutdown อัตโนมัติเมื่อแบตเตอรี่ UPS เหลือน้อย
- อย่าใช้ปลั๊กพ่วงหลายชั้นต่อกัน
- ติดป้ายสายไฟและสาย LAN

### 3.4 สถานที่วาง

- ที่มีอากาศถ่ายเท ไม่โดนแดด
- ห่างจากน้ำและความชื้น
- ไม่วางบนพื้นโดยตรง ใช้ชั้นวางหรือขาตั้ง
- ล็อกตู้หรือห้องถ้ามีคนภายนอกเข้าออก
- เก็บฝุ่นและทำความสะอาดพัดลมเป็นระยะ
- เก็บแผ่นติดตั้ง Ubuntu, สายสำรอง และอะแดปเตอร์ไว้ในที่รู้

---

## 4. ติดตั้ง Ubuntu Server 24.04 LTS

### 4.1 เตรียม USB

1. ดาวน์โหลด Ubuntu Server 24.04 LTS จากเว็บไซต์ Ubuntu
2. เขียน ISO ลง USB ด้วย balenaEtcher หรือ Rufus
3. ต่อจอ คีย์บอร์ด และสาย LAN ชั่วคราว
4. ตั้ง BIOS ให้บูตจาก USB

### 4.2 ตั้งค่า BIOS/UEFI ก่อนติดตั้ง

- Boot mode: UEFI
- Secure Boot: เปิดได้ถ้าไม่พบปัญหา
- Restore on AC Power Loss: **Power On**
- Boot order: USB ก่อน SSD
- ตั้ง BIOS password ถ้าเครื่องอยู่ในพื้นที่ที่คนอื่นเข้าถึงได้
- เปิด virtualization technology ไว้เผื่ออนาคต (ไม่บังคับ)
- ตั้ง fan profile เป็น balanced หรือ standard

### 4.3 ขั้นตอนใน installer

ค่าที่แนะนำ:

| หัวข้อ | ค่า |
|---|---|
| Language | English |
| Keyboard | English (US) |
| Network | DHCP ก่อน แล้วค่อยตั้ง static หลังติดตั้ง |
| Storage | ใช้ทั้งลูก หรือ LVM |
| Disk encryption | ตามนโยบายร้าน (ถ้าเปิด ต้องเก็บ passphrase ให้ดี) |
| Profile name | เช่น `KLYX Admin` |
| Username | `klyx` |
| Server name | `klyx-pos` |
| OpenSSH server | **ติดตั้ง** |
| Import SSH key | ใส่ public key ของผู้ดูแลถ้ามี |
| Featured snaps | ไม่ต้องเลือกเพิ่ม |

> ในคู่มือนี้จะใช้ผู้ใช้ชื่อ `klyx` และโฟลเดอร์โปรเจกต์ `/opt/compos`
> หากใช้ชื่ออื่น ให้เปลี่ยนคำสั่งตามชื่อผู้ใช้ของจริง

### 4.4 ตั้งค่าครั้งแรกหลังติดตั้ง

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y \
  curl git ca-certificates gnupg \
  ufw fail2ban unattended-upgrades \
  htop ncdu smartmontools
```

ตั้งชื่อเครื่องและเวลา:

```bash
sudo hostnamectl set-hostname klyx-pos
sudo timedatectl set-timezone Asia/Bangkok
sudo timedatectl set-ntp true
timedatectl
```

> เวลาของเครื่องต้องตรง เพราะระบบใช้ `Asia/Bangkok` ในการคำนวณปิดยอดรายวันและวันที่ในเอกสาร

รีบูตถ้ามี kernel update:

```bash
sudo reboot
```

### 4.5 ตั้ง static IP ด้วย netplan

ดูชื่อ interface ก่อน:

```bash
ip -br a
```

สมมติได้ `enp1s0` ให้แก้ไฟล์ netplan:

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

ตัวอย่าง:

```yaml
network:
  version: 2
  ethernets:
    enp1s0:
      dhcp4: false
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 192.168.1.1
          - 1.1.1.1
```

ทดสอบและใช้งาน:

```bash
sudo netplan try
sudo netplan apply
ip -br a
ping -c 3 192.168.1.1
```

> ถ้าตั้งผ่าน SSH ควรมีจอ/คีย์บอร์ดต่ออยู่ด้วย เพราะ `netplan try` อาจทำให้หลุดการเชื่อมต่อ

### 4.6 ถ้า RAM 8 GB — เพิ่ม swap (ทางเลือก)

Next.js build และ Docker อาจใช้ memory สูงชั่วคราว การเพิ่ม swap ช่วยลดโอกาส build ไม่ผ่าน:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 5. ความปลอดภัยพื้นฐานของเครื่อง

### 5.1 ผู้ใช้และ SSH

สร้างผู้ใช้สำหรับดูแลระบบถ้า installer สร้างชื่ออื่น:

```bash
sudo adduser klyx
sudo usermod -aG sudo klyx
```

จากเครื่องคอมพิวเตอร์ของผู้ดูแล สร้าง SSH key และคัดลอกขึ้นเซิร์ฟเวอร์:

```bash
ssh-keygen -t ed25519 -C "klyx-server-admin"
ssh-copy-id klyx@192.168.1.10
```

ทดสอบ login ด้วย key ก่อนปิด password:

```bash
ssh klyx@192.168.1.10
```

แก้ไข SSH config:

```bash
sudo nano /etc/ssh/sshd_config.d/99-klyx.conf
```

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers klyx
```

ตรวจและ reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

> เปิด terminal เดิมค้างไว้ก่อน แล้วเปิด terminal ใหม่ทดสอบ login ด้วย key
> ถ้า login ไม่ได้ ให้แก้ config ผ่าน terminal เดิมทันที

### 5.2 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 80 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 443 proto tcp
sudo ufw enable
sudo ufw status verbose
```

ถ้าใช้ Tailscale:

```bash
sudo ufw allow in on tailscale0
```

> **สำคัญ:** Docker สามารถ publish port ข้าม UFW ได้
> ไฟล์ `docker-compose.prod.yml` จึงผูกแอปกับ `127.0.0.1:3000` และฐานข้อมูลกับ `127.0.0.1:5432`
> ห้ามเปลี่ยนเป็น `0.0.0.0` โดยไม่เข้าใจความเสี่ยง

ถ้าต้องเข้าแอปจากเครื่องตัวเองเพื่อ debug ให้ใช้ SSH tunnel แทนการเปิดพอร์ต:

```bash
ssh -L 3000:127.0.0.1:3000 klyx@192.168.1.10
```

แล้วเปิด `http://localhost:3000` บนเครื่องของผู้ดูแล

### 5.3 Automatic security updates

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

ตั้งไม่ให้รีบูตอัตโนมัติระหว่างร้านเปิด:

```bash
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

```text
Unattended-Upgrade::Automatic-Reboot "false";
```

จากนั้นกำหนดช่วงรีบูตเอง เช่น เดือนละครั้งนอกเวลาร้าน

### 5.4 Fail2ban (ทางเลือก)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

สร้าง `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 1h
findtime = 10m
```

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

### 5.5 หลักปฏิบัติเรื่องรหัสผ่าน

- ใช้ password manager เก็บรหัสผ่าน
- Admin 1 คนต่อ 1 บัญชี ห้ามใช้บัญชีร่วม
- เปลี่ยนรหัสผ่าน seed หลัง login ครั้งแรก
- เก็บ `.env` เป็นไฟล์สิทธิ์ `600`
- ห้าม commit `.env` ลง Git
- เก็บสำเนา `.env` แบบเข้ารหัสไว้นอกเครื่อง

---

## 6. ติดตั้ง Docker Engine และ Compose

> ไม่จำเป็นต้องติดตั้ง Node.js หรือ PostgreSQL บน host ถ้าใช้ Docker ตามคู่มือนี้

ติดตั้ง Docker จาก repository ทางการ:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

เพิ่มผู้ใช้เข้า group docker:

```bash
sudo usermod -aG docker klyx
newgrp docker
docker run --rm hello-world
docker compose version
```

> ผู้ใช้ที่อยู่ใน group `docker` มีสิทธิ์เทียบเท่า root ในทางปฏิบัติ
> อย่าเพิ่มผู้ใช้ที่ไม่จำเป็นเข้า group นี้

ตั้ง Docker log rotation เพื่อไม่ให้ log กินดิสก์:

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
JSON
sudo systemctl restart docker
```

---

## 7. นำโปรเจกต์ขึ้นเครื่อง

### 7.1 ดึงโค้ดขึ้นเซิร์ฟเวอร์

สร้างโฟลเดอร์และ clone:

```bash
sudo mkdir -p /opt
sudo git clone <repository-url> /opt/compos
sudo chown -R klyx:klyx /opt/compos
cd /opt/compos
```

ถ้า repository เป็น private ให้ใช้ **deploy key แบบ read-only**:

```bash
ssh-keygen -t ed25519 -C "klyx-deploy" -f ~/.ssh/klyx_deploy
cat ~/.ssh/klyx_deploy.pub
```

นำ public key ไปเพิ่มใน repository (Deploy keys) แล้วตั้ง `~/.ssh/config`:

```text
Host github.com
  IdentityFile ~/.ssh/klyx_deploy
  IdentitiesOnly yes
```

ทางเลือก: ถ้าเครื่องเซิร์ฟเวอร์อยู่ออฟไลน์ ให้ build บนเครื่องที่มีอินเทอร์เน็ตแล้วถ่าย image ไปแทน (ดูภาคผนวก B)

### 7.2 สร้างไฟล์ `.env`

```bash
cd /opt/compos
cp .env.example .env
chmod 600 .env
```

สร้าง secret:

```bash
openssl rand -base64 32
openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24
```

แก้ไข `.env`:

```bash
nano .env
```

ตัวอย่างค่าสำหรับ Production:

```dotenv
# Database
POSTGRES_USER=compos
POSTGRES_PASSWORD=REPLACE_WITH_LONG_ALPHANUMERIC_PASSWORD
POSTGRES_DB=compos_prod
POSTGRES_PORT=5432

# App in Docker connects to service name "db"
DATABASE_URL="postgresql://compos:REPLACE_WITH_LONG_ALPHANUMERIC_PASSWORD@db:5432/compos_prod?schema=public"

# Auth.js
AUTH_SECRET=REPLACE_WITH_OPENSSL_RAND_BASE64_32
AUTH_URL="http://192.168.1.10"
AUTH_TRUST_HOST=true

# First admin (used only by db:seed:base)
SEED_ADMIN_EMAIL=owner@klyxlab.local
SEED_ADMIN_PASSWORD=REPLACE_WITH_STRONG_ADMIN_PASSWORD
SEED_ADMIN_NAME=เจ้าของร้าน
SEED_SHOP_NAME=KLYX LAB

# Reverse proxy / Docker network
TRUSTED_PROXY_CIDRS=127.0.0.1,::1,172.16.0.0/12
```

ข้อควรระวัง:

- `DATABASE_URL` ต้องใช้ host **`db`** เมื่อแอปรันใน Docker Compose
- `AUTH_URL` ต้องตรงกับ URL ที่เปิดในเบราว์เซอร์ เช่น `http://192.168.1.10` หรือ `https://pos.example.com`
- ถ้าใช้ Nginx บนพอร์ต 80 ไม่ต้องใส่ `:3000` ใน `AUTH_URL`
- ใช้รหัสผ่านฐานข้อมูลเป็นตัวอักษร/ตัวเลขล้วน เพื่อหลีกเลี่ยงปัญหา URL encoding
- `POSTGRES_PASSWORD` กับรหัสใน `DATABASE_URL` ต้องตรงกัน
- ถ้าเปลี่ยน `POSTGRES_PASSWORD` หลังฐานข้อมูลถูกสร้างแล้ว การแก้ `.env` อย่างเดียวจะไม่เปลี่ยนรหัสจริงในฐานข้อมูล (ดูหัวข้อ 14)

### 7.3 ตรวจสอบ compose

```bash
cd /opt/compos
docker compose -f docker-compose.prod.yml config --quiet
```

ถ้าไม่มี error แสดงว่า compose และ `.env` อ่านได้

> `docker compose config` แบบไม่ใส่ `--quiet` จะแสดงค่าลับทั้งหมด จึงไม่ควรแชร์ output ให้ผู้อื่น

### 7.4 Build image

```bash
docker compose -f docker-compose.prod.yml build --pull
```

> การ build ต้องใช้อินเทอร์เน็ตเพื่อดึง base image, npm packages และฟอนต์ Google
> ถ้าร้านไม่มีอินเทอร์เน็ต ให้ build บนเครื่องอื่นแล้วถ่าย image ไป (ภาคผนวก B)

### 7.5 เริ่มฐานข้อมูลและ migrate

```bash
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml ps
```

รอจน `db` เป็น `healthy` แล้วรัน migration:

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run db:deploy
```

สร้าง Admin คนแรกและข้อมูลพื้นฐาน:

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run db:seed:base
```

> ห้ามใช้ `npm run db:migrate` หรือ `npm run db:seed` บน Production
> `db:migrate` ใช้สำหรับ development และ `db:seed` จะสร้างข้อมูลตัวอย่าง
> ใช้ `db:deploy` และ `db:seed:base` เท่านั้น

### 7.6 เริ่มแอป

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

ผลที่ต้องการจะคล้าย:

```json
{
  "status": "ok",
  "database": "connected",
  "latencyMs": 2,
  "uptime": 10,
  "timestamp": "2026-11-12T08:00:00.000Z",
  "environment": "production"
}
```

ดู log:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### 7.7 Login ครั้งแรก

เปิด `http://192.168.1.10:3000` จากเครื่องใน LAN (ก่อนตั้ง Nginx) หรือ `http://192.168.1.10` หลังตั้ง Nginx

1. Login ด้วย `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
2. ไปที่ `/profile` เพื่อเปลี่ยนรหัสผ่าน
3. ไปที่ `/settings/shop` ตั้งชื่อร้าน โลโก้ ภาษี ใบเสร็จ PromptPay ข้อความแจ้งลูกค้า
4. ไปที่ `/settings/users` สร้างบัญชีช่างแยกคน
5. ทดสอบสร้างสินค้า รับสินค้า เปิดบิล ขาย และพิมพ์เอกสาร

---

## 8. ตั้ง Nginx เป็นทางเข้า

### 8.1 ติดตั้ง Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

สร้าง config:

```bash
sudo nano /etc/nginx/sites-available/compos
```

ตัวอย่างสำหรับ LAN:

```nginx
server {
    listen 80;
    server_name 192.168.1.10 pos.klyxlab.lan;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

เปิดใช้งาน:

```bash
sudo ln -s /etc/nginx/sites-available/compos /etc/nginx/sites-enabled/compos
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

ทดสอบ:

```bash
curl -I http://127.0.0.1
curl -fsS http://127.0.0.1/api/health
```

### 8.2 อัปเดต `AUTH_URL` เมื่อเปลี่ยนไปใช้ Nginx

ถ้าเดิมตั้ง `AUTH_URL=http://192.168.1.10:3000` ให้แก้เป็น:

```dotenv
AUTH_URL="http://192.168.1.10"
```

แล้ว recreate container:

```bash
cd /opt/compos
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

> ถ้า `AUTH_URL` ไม่ตรงกับ URL ที่เปิดจริง ผู้ใช้อาจเจอ login loop หรือ cookie ไม่ทำงาน

### 8.3 ตั้งชื่อภายใน LAN

เลือกอย่างใดอย่างหนึ่ง:

1. **แนะนำ:** ตั้ง DNS reservation ใน router ให้ `pos.klyxlab.lan` ชี้ไป `192.168.1.10`
2. เพิ่มในไฟล์ hosts ของเครื่องลูกข่าย
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - macOS/Linux: `/etc/hosts`

```text
192.168.1.10  pos.klyxlab.lan
```

3. ใช้ IP ตรง ๆ `http://192.168.1.10` ซึ่งง่ายและเสถียรที่สุด

### 8.4 HTTPS (ทางเลือก)

**ใน LAN เดียวกัน** การใช้ HTTP อาจยอมรับได้ถ้าเครือข่ายร้านเชื่อถือได้ แต่ถ้ามี Wi-Fi ลูกค้าหรือต้องการความปลอดภัยสูงขึ้น ควรใช้ HTTPS

ทางเลือกที่ง่าย:

- ใช้ **Tailscale Serve** ให้ HTTPS ภายใน tailnet
- ใช้โดเมนจริง + Let's Encrypt (ต้องมี DNS ที่ชี้มาที่เซิร์ฟเวอร์ หรือใช้ DNS-01 challenge)
- ใช้ local CA เช่น Caddy แล้วติดตั้ง root certificate บนเครื่องลูกข่าย

ตัวอย่าง Tailscale Serve:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale serve --bg 3000
tailscale serve status
```

จากนั้นตั้ง `AUTH_URL` เป็น URL ที่ Tailscale แสดง และ recreate app

> ไม่แนะนำให้ forward port 80/443 จาก router ไปที่เซิร์ฟเวอร์โดยตรง หากไม่ได้ออกแบบ security ให้ครบ

---

## 9. Remote access

### 9.1 Tailscale / WireGuard — แนะนำ

ติดตั้งบนเซิร์ฟเวอร์และอุปกรณ์ของผู้ดูแล:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale status
```

- เข้าจากนอกสถานที่ผ่าน IP ของ Tailscale
- ไม่ต้องเปิด port ที่ router
- ถ้าใช้ Tailscale Serve จะได้ HTTPS ด้วย
- ควรตั้ง ACL ให้เฉพาะอุปกรณ์ของผู้ดูแลเข้าถึงเซิร์ฟเวอร์ได้

### 9.2 Cloudflare Tunnel — ทางเลือก

ใช้เมื่อต้องการให้เข้าผ่านโดเมนโดยไม่เปิด port:

- ติดตั้ง `cloudflared` บนเซิร์ฟเวอร์
- สร้าง tunnel ไปที่ `http://127.0.0.1:3000`
- ตั้ง `AUTH_URL` เป็นโดเมนของ tunnel
- ตรวจสอบว่า Cloudflare Access หรือระบบยืนยันตัวตนไม่ได้เปิดขัดกับ login ของแอป

### 9.3 สิ่งที่ห้ามทำ

- ห้าม forward port 5432 ออกอินเทอร์เน็ต
- ห้ามเปิด 3000 สู่อินเทอร์เน็ตโดยตรง
- ห้ามใช้ DMZ กับเครื่องนี้
- ห้ามเปิด UPnP บน router
- ห้ามใช้รหัสผ่าน admin ร่วมกันหลายคน

---

## 10. Backup และ Restore

### 10.1 ต้องสำรองอะไร

| สิ่งที่ต้องสำรอง | ความสำคัญ | วิธี |
|---|---|---|
| ฐานข้อมูล PostgreSQL | สูงสุด | `pg_dump` รายวัน |
| ไฟล์ `.env` | สูง | เก็บสำเนาเข้ารหัสนอกเครื่อง |
| โค้ด/Compose/Dockerfile | กลาง | Git repository |
| โลโก้/ไฟล์ใน `public` | กลาง | Git repository |
| รายงาน/เอกสารที่พิมพ์ | ตามร้าน | เครื่องพิมพ์/แฟ้มเอกสาร |

> ฐานข้อมูลคือหัวใจของระบบ ส่วนไฟล์อื่นส่วนใหญ่สร้างใหม่ได้จาก Git

### 10.2 สคริปต์ backup สำหรับ Docker

โปรเจกต์มีสคริปต์ `scripts/backup_postgres_docker.sh` สำหรับ backup ฐานข้อมูลจาก container โดยตรง

ทดสอบรันด้วยมือ:

```bash
cd /opt/compos
chmod +x scripts/backup_postgres_docker.sh
./scripts/backup_postgres_docker.sh
ls -lh /opt/backup/dumps
```

สคริปต์จะ:

- ตรวจว่า service `db` กำลังรัน
- ใช้ `pg_dump` ภายใน container
- บีบอัดเป็น `.sql.gz`
- ตรวจว่าไฟล์ไม่ว่างและไม่เสีย
- ลบ backup ที่เก่ากว่า 30 วัน

### 10.3 ตั้ง cron รายวัน

```bash
sudo mkdir -p /opt/backup/dumps /opt/backup/logs
sudo chown -R klyx:klyx /opt/backup
crontab -e
```

เพิ่ม:

```cron
# ทุกวัน 03:00 น.
0 3 * * * /opt/compos/scripts/backup_postgres_docker.sh >> /opt/backup/logs/backup.log 2>&1
```

ตรวจ log:

```bash
tail -n 50 /opt/backup/logs/backup.log
```

### 10.4 สำเนานอกเครื่อง

อย่างน้อยสัปดาห์ละครั้ง คัดลอก backup ไปยัง:

- external HDD/NAS ในร้าน
- หรือ cloud storage ที่เข้ารหัส
- เก็บอย่างน้อย 1 สำเนาไว้นอกสถานที่

ตัวอย่าง:

```bash
rsync -av /opt/backup/dumps/ /mnt/usb/compos-backups/
```

### 10.5 ทดสอบ restore

**ห้ามทดสอบ restore ทับฐานข้อมูล Production โดยตรง** ให้ทดสอบกับฐานข้อมูลแยกหรือเครื่องทดสอบ

ขั้นตอน restore บนเครื่อง Production (เมื่อจำเป็นจริง):

```bash
cd /opt/compos

# 1) หยุดแอปเพื่อไม่ให้มีคนเขียนข้อมูลระหว่าง restore
docker compose -f docker-compose.prod.yml stop app

# 2) ลบและสร้างฐานข้อมูลใหม่
docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'dropdb --username="$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && \
   createdb --username="$POSTGRES_USER" --owner="$POSTGRES_USER" "$POSTGRES_DB"'

# 3) restore จากไฟล์ backup
gunzip -c /opt/backup/dumps/compos_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'

# 4) เริ่มแอปและตรวจสุขภาพ
docker compose -f docker-compose.prod.yml start app
curl -fsS http://127.0.0.1:3000/api/health
```

> `dropdb --force` จะตัดการเชื่อมต่อที่ค้างอยู่ ต้องหยุดแอปก่อนทุกครั้ง

### 10.6 RPO/RTO ที่ควรเข้าใจ

- Backup รายวัน → ถ้าเครื่องเสีย อาจเสียข้อมูลย้อนหลังได้ถึง 1 วัน
- ถ้าต้องการ RPO ต่ำกว่านี้ ต้องเพิ่มความถี่ backup หรือทำ WAL archiving
- RTO ขึ้นกับความเร็วในการติดตั้งเครื่องใหม่ + restore backup + ตั้งค่า `.env`
- ควรซ้อม restore อย่างน้อยทุก 3–6 เดือน

---

## 11. UPS, RAID และ Monitoring

### 11.1 UPS ด้วย NUT

ติดตั้ง:

```bash
sudo apt install -y nut
lsusb
sudo nut-scanner -U
```

ตัวอย่าง config:

`/etc/nut/ups.conf`

```ini
[ups]
    driver = usbhid-ups
    port = auto
    desc = "KLYX LAB UPS"
```

`/etc/nut/nut.conf`

```text
MODE=standalone
```

`/etc/nut/upsd.users`

```ini
[monuser]
    password = CHANGE_ME
    upsmon master
```

`/etc/nut/upsmon.conf`

```text
MONITOR ups@localhost 1 monuser CHANGE_ME master
MINSUPPLIES 1
SHUTDOWNCMD "/sbin/shutdown -h +0"
POLLFREQ 5
POLLFREQALERT 5
HOSTSYNC 15
DEADTIME 15
POWERDOWNFLAG /etc/killpower
```

เปิดบริการ:

```bash
sudo systemctl enable --now nut-server nut-monitor
upsc ups@localhost
```

> ทดสอบ shutdown จริงในวันหยุด/นอกเวลาร้าน เพราะคำสั่ง `upsmon -c fsd` จะสั่ง shutdown ทันที

### 11.2 RAID 1 (ถ้ามีสองลูก)

- ตั้ง RAID ใน BIOS ถ้าเป็น hardware RAID
- หรือใช้ Ubuntu installer สร้าง software RAID 1
- ตรวจสอบ:

```bash
cat /proc/mdstat
lsblk
```

> RAID 1 ป้องกันดิสก์ลูกหนึ่งเสีย แต่ไม่ป้องกันการลบข้อมูล/ransomware ต้องมี backup แยกเสมอ

### 11.3 ตรวจสุขภาพดิสก์

```bash
sudo smartctl -a /dev/nvme0n1
sudo systemctl enable --now smartd
```

ติดตามค่า SMART และพื้นที่ดิสก์เป็นระยะ:

```bash
df -h
sudo ncdu /
```

### 11.4 Monitoring ขั้นต่ำ

- ตรวจ `/api/health` ทุกวัน
- ดู `docker compose ps`
- ดู log ที่มี error
- ตรวจพื้นที่ดิสก์และ backup
- ถ้าต้องการแจ้งเตือน ให้ใช้ Uptime Kuma หรือ script เช็ก health แล้วส่งข้อความเข้า LINE/Telegram
- อย่าติดตั้ง monitoring ไว้บนเครื่องเดียวกันเพียงอย่างเดียว เพราะถ้าเครื่องดับจะไม่มีการแจ้งเตือน

---

## 12. Go-live checklist

### 12.1 ฝั่งเซิร์ฟเวอร์

- [ ] IP คงที่และเข้าถึงได้จากเครื่องลูกข่าย
- [ ] `timedatectl` เป็น `Asia/Bangkok` และ NTP ทำงาน
- [ ] `ufw status` เปิดและไม่เปิด 3000/5432 สู่ LAN
- [ ] SSH ใช้ key และปิด password login
- [ ] `docker compose ps` ทั้ง `db` และ `app` เป็น healthy/running
- [ ] `curl -fsS http://127.0.0.1:3000/api/health` ได้ `database: connected`
- [ ] Nginx เปิดและ `curl -I http://127.0.0.1` ได้ 200
- [ ] `AUTH_URL` ตรงกับ URL ที่ใช้งานจริง
- [ ] Login Admin ได้ และเปลี่ยนรหัสผ่าน seed แล้ว
- [ ] สร้างผู้ใช้ช่างแยกคนและทดสอบสิทธิ์
- [ ] ตั้งข้อมูลร้าน ภาษี ใบเสร็จ PromptPay และข้อความแจ้งลูกค้า
- [ ] Backup รันด้วยมือสำเร็จ 1 ครั้ง
- [ ] ตั้ง cron backup และตรวจ log
- [ ] ซ้อม restore กับฐานข้อมูลทดสอบ
- [ ] UPS ต่อครบและทดสอบ shutdown
- [ ] BIOS ตั้ง Restore on AC Power Loss = Power On
- [ ] เก็บ `.env` สำเนาเข้ารหัสนอกเครื่อง
- [ ] จด IP, URL, บัญชี และขั้นตอนกู้คืนไว้ใน password manager

### 12.2 ฝั่งเครื่องลูกข่าย

- [ ] ใช้ Chrome/Edge เวอร์ชันล่าสุด
- [ ] ตั้ง homepage เป็น URL ของร้าน
- [ ] ตั้งเครื่องพิมพ์ A4 เป็น default
- [ ] ตั้งเครื่องพิมพ์ใบเสร็จ 80 มม. เป็น default แยกเครื่องถ้าจำเป็น
- [ ] ตั้ง scale การพิมพ์ 100% และเปิด background graphics
- [ ] ทดสอบพิมพ์ A4, ใบเสร็จ 80 มม. และป้ายบาร์โค้ด
- [ ] ทดสอบ scanner แบบ keyboard wedge (สแกนแล้ว Enter)
- [ ] ทดสอบ PromptPay QR ด้วยแอปธนาคาร
- [ ] ทดสอบ LINE/WhatsApp share บนมือถือ
- [ ] ทดสอบปิดยอดรายวัน
- [ ] ทดสอบสร้างใบเสนอราคาและแปลงเป็นบิล
- [ ] ตรวจว่าราคาและยอดเงินตรงกับที่ตั้งในสินค้า

### 12.3 ทดสอบ workflow จริงก่อนเปิดร้าน

1. สร้างสินค้าใหม่ 1 รายการ
2. รับสินค้าเข้าสต๊อก
3. เปิดบิลขายและชำระเงิน
4. พิมพ์ใบเสร็จ
5. สร้างงานซ่อมและเปลี่ยนสถานะ
6. สร้างใบเสนอราคาและแปลงเป็นบิล
7. ตรวจสอบ audit log
8. ปิดยอดรายวัน
9. Backup และ restore ลงฐานข้อมูลทดสอบ

---

## 13. การอัปเดตระบบและ rollback

### 13.1 ก่อนอัปเดต

- อ่าน release notes / migration ใหม่
- Backup ฐานข้อมูลก่อนทุกครั้ง
- แจ้งผู้ใช้ล่วงหน้าและเลือกช่วงเวลาร้านปิด
- อย่าอัปเดตระหว่างมีบิลค้างหรือกำลังปิดยอด

### 13.2 ขั้นตอนอัปเดต

```bash
cd /opt/compos

# 1) backup ก่อน
./scripts/backup_postgres_docker.sh

# 2) ดึงโค้ดเวอร์ชันใหม่
git fetch --tags
git checkout v1.2.3

# 3) build image ใหม่
docker compose -f docker-compose.prod.yml build --pull app

# 4) migrate ฐานข้อมูล
docker compose -f docker-compose.prod.yml run --rm app npm run db:deploy

# 5) สลับแอป
docker compose -f docker-compose.prod.yml up -d app

# 6) ตรวจสุขภาพ
curl -fsS http://127.0.0.1:3000/api/health
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

> ใช้ tag ของ release แทนการ deploy `main` โดยตรง เพื่อให้ย้อนกลับได้ง่าย

### 13.3 Rollback

```bash
cd /opt/compos
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
curl -fsS http://127.0.0.1:3000/api/health
```

ถ้า migration ใหม่เปลี่ยนโครงสร้างข้อมูลจนแอปเก่าใช้ไม่ได้:

1. หยุดแอป
2. restore backup ก่อน migration
3. checkout โค้ดเวอร์ชันเก่า
4. build และ start
5. ตรวจสอบข้อมูล

> Prisma migration ไม่มี automatic down migration ในProduction
> การ backup ก่อน migrate จึงสำคัญที่สุด

---

## 14. Troubleshooting ที่พบบ่อย

| อาการ | สาเหตุที่พบบ่อย | ตรวจสอบ/แก้ไข |
|---|---|---|
| เปิดเว็บแล้ว 502 Bad Gateway | app ไม่รัน หรือ port ไม่ตรง | `docker compose ps`, `curl 127.0.0.1:3000/api/health`, `logs app` |
| Login แล้ววนกลับหน้า login | `AUTH_URL` ไม่ตรง URL จริง | แก้ `.env`, `up -d --force-recreate app`, ล้าง cookie |
| `database: disconnected` | db ไม่ healthy / password ไม่ตรง | `docker compose logs db`, ตรวจ `DATABASE_URL` |
| App ต่อ DB ไม่ได้ | ใช้ host `localhost` ใน container | เปลี่ยนเป็น `db` ใน `DATABASE_URL` |
| เปลี่ยนรหัส DB ใน `.env` แล้วยังต่อไม่ได้ | รหัสจริงใน PostgreSQL ไม่เปลี่ยนตาม env | `ALTER USER` ใน DB แล้วค่อยแก้ `.env` |
| Migration fail | schema/data ไม่ตรง หรือ DB ไม่พร้อม | อย่าลบ `_prisma_migrations`; restore backup และตรวจ log |
| Build ไม่ผ่านเพราะ memory | RAM 8 GB ไม่พอชั่วคราว | เพิ่ม swap หรือใช้เครื่อง 16 GB |
| Disk full | log/image/backup สะสม | `df -h`, `docker system df`, `ncdu` |
| Backup fail | db ไม่รัน / สิทธิ์โฟลเดอร์ / ดิสก์เต็ม | `docker compose ps`, `ls -ld /opt/backup`, `df -h` |
| Nginx config ผิด | syntax หรือ port | `sudo nginx -t`, `journalctl -u nginx` |
| เครื่องพิมพ์เพี้ยน | scale/ขนาดกระดาษ | ตั้ง 100%, A4/80mm, background graphics |
| QR PromptPay สแกนไม่ได้ | พื้นหลังไม่ขาว/ขนาดเล็ก/เลขพร้อมเพย์ผิด | ตรวจเลขใน settings, พิมพ์พื้นขาว, ขยายขนาด |
| Login ถูกจำกัด | ใส่รหัสผิด 5 ครั้งใน 15 นาที | รอ 15 นาที หรือให้ Admin ตรวจ |
| เวลาในรายงานผิด | timezone/NTP ผิด | `timedatectl`, ตั้ง `Asia/Bangkok` |
| เปลี่ยน `.env` แล้วค่าไม่เปลี่ยน | container ยังใช้ค่าเก่า | `docker compose up -d --force-recreate app` |
| Port 5432 ชนกับของเดิม | มี PostgreSQL อื่นรันอยู่ | เปลี่ยน `POSTGRES_PORT` หรือหยุดตัวเดิม |
| Docker volume ใช้ PG คนละเวอร์ชัน | เปลี่ยน image โดยไม่ migrate | dump/restore หรือ `pg_upgrade` อย่าลบ volume |

คำสั่งตรวจสอบพื้นฐาน:

```bash
systemctl status docker nginx
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 app
docker compose -f docker-compose.prod.yml logs --tail=200 db
curl -v http://127.0.0.1:3000/api/health
ss -tulpn | grep -E '3000|5432|80|443'
df -h
free -h
uptime
journalctl -u nginx --since "1 hour ago"
```

### 14.1 เปลี่ยนรหัสผ่านฐานข้อมูลอย่างถูกต้อง

ถ้าต้องเปลี่ยนรหัสจริง:

```bash
cd /opt/compos

# 1) เปลี่ยนรหัสใน PostgreSQL ก่อน
docker compose -f docker-compose.prod.yml exec -T db sh -c \
  'psql --username="$POSTGRES_USER" --dbname=postgres \
   -c "ALTER USER $POSTGRES_USER WITH PASSWORD '\''NEW_PASSWORD'\'';"'

# 2) แก้ POSTGRES_PASSWORD และ DATABASE_URL ใน .env
nano .env

# 3) recreate app
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

> อย่าแก้แค่ `.env` เพราะ PostgreSQL จะยังใช้รหัสเดิมใน volume

---

## 15. ตารางดูแลรักษา

| รอบ | งาน |
|---|---|
| ทุกวัน | ดู health check, ดู log backup, ตรวจว่าปิดยอดได้ |
| ทุกสัปดาห์ | ตรวจพื้นที่ดิสก์, ดู Docker logs, คัดลอก backup ไป external/NAS |
| ทุกเดือน | อัปเดต OS, ตรวจ SMART, ตรวจ UPS, รีวิวผู้ใช้/สิทธิ์ |
| ทุก 3–6 เดือน | ซ้อม restore, ตรวจ firewall, เปลี่ยนรหัสผ่าน admin ตามนโยบาย |
| ทุกปี | ตรวจแบตเตอรี่ UPS, เปลี่ยน SSD ตามอายุ, ทดสอบ disaster recovery |

---

## ภาคผนวก A — ทางเลือก: ติดตั้งแบบ Bare Metal (ไม่ใช้ Docker)

ถ้าไม่ต้องการใช้ Docker:

1. ติดตั้ง Node.js 22 LTS
2. ติดตั้ง PostgreSQL 17
3. สร้าง database/user
4. ตั้ง `DATABASE_URL` ให้ชี้ `localhost`
5. `npm ci`
6. `npm run db:deploy`
7. `npm run db:seed:base`
8. `npm run build`
9. รันด้วย PM2
10. ตั้ง Nginx reverse proxy

รายละเอียดแบบ bare metal อยู่ใน [Deployment Runbook](deployment-runbook.md)
แต่สำหรับเครื่องจริง แนะนำ Docker เพราะควบคุมเวอร์ชันและกู้คืนง่ายกว่า

---

## ภาคผนวก B — ติดตั้งแบบออฟไลน์

ถ้าเครื่องเซิร์ฟเวอร์ไม่มีอินเทอร์เน็ต:

1. เตรียมเครื่อง build ที่มีอินเทอร์เน็ตและสถาปัตยกรรมเดียวกัน (แนะนำ x86-64)
2. ที่เครื่อง build:

```bash
docker compose -f docker-compose.prod.yml build
docker save compos-app:latest -o compos-app.tar
docker save postgres:17-alpine -o postgres-17.tar
```

3. คัดลอก `compos-app.tar`, `postgres-17.tar`, โค้ดโปรเจกต์ และ `.env` ไปยังเซิร์ฟเวอร์
4. ที่เซิร์ฟเวอร์:

```bash
docker load -i compos-app.tar
docker load -i postgres-17.tar
```

5. ใช้ image ที่ load แล้วแทนการ build (แก้ compose ให้ใช้ `image:` หรือ tag ให้ตรง)
6. รัน migration/seed ตามปกติ

> การ build บนเครื่องอื่นต้องใช้ CPU สถาปัตยกรรมเดียวกัน และควรทดสอบ image บนเครื่องจริงก่อนเปิดร้าน

---

## ภาคผนวก C — คำสั่งที่ใช้บ่อย

```bash
cd /opt/compos

# สถานะ
docker compose -f docker-compose.prod.yml ps

# ดู log
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f db

# restart
docker compose -f docker-compose.prod.yml restart app

# หยุดทั้งระบบ (ข้อมูลยังอยู่)
docker compose -f docker-compose.prod.yml down

# ห้ามใช้ถ้าไม่ต้องการลบฐานข้อมูล
# docker compose -f docker-compose.prod.yml down -v

# ตรวจสุขภาพ
curl -fsS http://127.0.0.1:3000/api/health

# backup
./scripts/backup_postgres_docker.sh

# ดูพื้นที่
df -h
docker system df

# ดู firewall
sudo ufw status verbose

# ดูเวลา
timedatectl

# ดู IP
ip -br a

# ดู process ที่ใช้ port
sudo ss -tulpn
```

---

## สรุป

สำหรับเครื่องเซิร์ฟเวอร์จริงในร้าน ให้ยึดหลักนี้:

1. **ใช้ LAN-only หรือ VPN** ไม่เปิดฐานข้อมูล/แอปสู่อินเทอร์เน็ตโดยตรง
2. **ใช้ SSD + UPS + backup นอกเครื่อง** อย่าพึ่งดิสก์ลูกเดียว
3. **ใช้ Docker Compose** เพื่อให้เวอร์ชันคงที่และกู้คืนง่าย
4. **ผูก app/db กับ 127.0.0.1** แล้วให้ Nginx เป็นทางเข้า
5. **ตั้งเวลา Asia/Bangkok และ NTP** ให้ถูกต้อง
6. **Backup ทุกวัน และซ้อม restore** อย่ารอจนเกิดเหตุ
7. **เปลี่ยนรหัสผ่าน seed และแยกบัญชีผู้ใช้** ก่อนเปิดร้าน
