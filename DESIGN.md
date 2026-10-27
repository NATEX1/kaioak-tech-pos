---
name: KAIOAK TECH POS
description: POS & Service Management System for Computer Retailers
colors:
  primary: "oklch(0.48 0.15 254)"
  primary-foreground: "oklch(0.99 0 0)"
  background: "oklch(0.985 0.004 240)"
  foreground: "oklch(0.19 0.02 250)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.19 0.02 250)"
  secondary: "oklch(0.955 0.012 245)"
  secondary-foreground: "oklch(0.28 0.04 250)"
  muted: "oklch(0.96 0.008 245)"
  muted-foreground: "oklch(0.5 0.02 250)"
  border: "oklch(0.91 0.01 245)"
  destructive: "oklch(0.577 0.245 27.325)"
  brand-gold: "oklch(0.82 0.14 85)"
  sidebar: "oklch(0.985 0.005 245)"
  sidebar-foreground: "oklch(0.19 0.02 250)"
  dark-background: "oklch(0.155 0.026 255)"
  dark-foreground: "oklch(0.955 0.01 250)"
  dark-card: "oklch(0.195 0.03 255)"
  dark-muted-foreground: "oklch(0.72 0.025 250)"
  dark-border: "oklch(0.98 0.01 250 / 10%)"
  dark-primary: "oklch(0.72 0.14 252)"
  dark-sidebar: "oklch(0.13 0.024 255)"
typography:
  display:
    fontFamily: "var(--font-noto-sans-thai), -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "var(--font-noto-sans-thai), -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-noto-sans-thai), -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-noto-sans-thai), -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-noto-sans-thai), -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.025em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
---

# Design System: KAIOAK TECH POS

## Overview

**Creative North Star: "The Precision Terminal"**

KAIOAK TECH POS เป็นระบบปฏิบัติการหน้าร้านและศูนย์บริการไอทีที่ถูกออกแบบมาเพื่อความแม่นยำและความเร็วสูงสุดในการทำงานจริง บุคลิกภาพเชิงภาพ (Visual Personality) ยึดหลัก **Clean, Dense, Tactile** — สะอาดตา ให้ความสำคัญกับข้อมูลที่มีความหนาแน่นพอเหมาะ สามารถสแกนและค้นหา Serial Number, รหัสสินค้า และยอดเงินได้ทันทีโดยไม่ต้องเลื่อนหา

ระบบปฏิเสธลูกเล่นที่รกรุงรังเกินความจำเป็น (Zero Fluff): ปราศจากไล่ระดับสีจัดจ้าน (Aggressive Gradients), ไม่ใช้เอฟเฟกต์กระจกเบลอ (Glassmorphism) ที่ลดทอนการอ่านตัวหนังสือ และไม่อนุญาตให้อนิเมชันเข้ามาหน่วงจังหวะการกดคีย์บอร์ดหรือการยิงบาร์โค้ด ทุกตาราง ปุ่ม และการ์ดถูกจัดวางอย่างเป็นระเบียบ สื่อถึงเครื่องมือช่างชั้นดีที่เชื่อถือได้

**Key Characteristics:**
- **High Information Density with Clear Hierarchy:** จัดกลุ่มข้อมูลสำคัญด้วย Tonal Surface ไม่ใช้เส้นกรอบหนาเตอะ
- **Barcode & Keyboard First:** ช่องค้นหาและตารางเน้นการตอบสนองที่ฉับไว สแกนแล้วเกิดผลทันที
- **Purposeful Color:** ใช้สีแซฟไฟร์เป็นหมุดนำสายตาในการอนุมัติ และใช้สีสถานะมาตรฐาน (เขียว, เหลือง, ฟ้า, แดง) อย่างเคร่งครัด

## Colors

จานสีหลักใช้สีน้ำเงินแซฟไฟร์ไอทีบนพื้นหลังโทนสว่างที่มีความเย็นสบายตา ขับเน้นความคมชัดของข้อมูลทางการเงินและสถานะบิล

### Primary
- **Royal Tech Sapphire** (`oklch(0.48 0.15 254)`): สีเอกลักษณ์ของระบบ ใช้เป็น Action หลักสำหรับการเปิดบิล, อนุมัติ, ไฮไลต์การนำทางที่กำลังเปิดใช้งาน และปุ่ม Primary

### Neutral
- **Clean Canvas White** (`oklch(0.985 0.004 240)`): สีพื้นหลังหน้าหลัก ให้ความรู้สึกสะอาด สว่าง แต่ไม่แสบตา
- **Pure Card Surface** (`oklch(1 0 0)`): สีพื้นหลังของการ์ด ตาราง และโมดอล ยกตัวขึ้นจากพื้นหลังหลักอย่างนุ่มนวล
- **Slate Ink** (`oklch(0.19 0.02 250)`): สีข้อความหลัก คอนทราสต์สูง อ่านง่ายในทุกสภาพแสง
- **Muted Steel** (`oklch(0.5 0.02 250)`): สีข้อความรอง หน่วยนับ คำอธิบายย่อย และ Timestamp
- **Subtle Divider** (`oklch(0.91 0.01 245)`): สีเส้นขอบตาราง การ์ด และแท็บนำทาง

### Status Semantics
- **Success Emerald** (`oklch(0.62 0.17 150)`): สถานะ `PAID`, `APPROVED`, รับเข้าสินค้าครบ
- **Warning Amber** (`oklch(0.75 0.16 75)`): สถานะ `PENDING_APPROVAL`, สินค้าใกล้หมดสต๊อก
- **Destructive Crimson** (`oklch(0.577 0.245 27.325)`): สถานะ `VOIDED`, `REJECTED`, การลบ หรือยกเลิก

### Dark Mode
โหมดมืดใช้ **Deep Sapphire Canvas** เป็นพื้นหลังหลัก เพื่อลดแสงจ้าเมื่อทำงานในห้องซ่อมหรือช่วงกลางคืน โดยยังคงลำดับชั้นแบบ Tonal Layering:
- **Deep Sapphire Canvas** (`oklch(0.155 0.026 255)`): พื้นหลังหน้า
- **Elevated Navy Card** (`oklch(0.195 0.03 255)`): การ์ด ตาราง และ popover
- **Signal Sapphire** (`oklch(0.72 0.14 252)`): primary, active navigation และ focus ring
- **Night Sidebar** (`oklch(0.13 0.024 255)`): แถบนำทางด้านซ้าย
- **Gold Hairline** (`oklch(0.84 0.14 85)`): ใช้เฉพาะรายละเอียดแบรนด์ ไม่ใช้เป็นสีสถานะ

**The Theme Parity Rule.** ทุกสถานะทางธุรกิจต้องมีคู่สีในโหมดมืดที่รักษาความหมายเดิม (เขียว/เหลือง/ฟ้า/แดง) และต้องผ่านคอนทราสต์ระดับอ่านง่าย ห้ามใช้สีสถานะเป็นสีตกแต่ง
**The Print Isolation Rule.** เอกสารพิมพ์ A4, สลิป 80 มม. และป้ายบาร์โค้ดต้องคงพื้นขาวและข้อความเข้มเสมอ ไม่รับสีจากโหมดมืด
**The Brand Canvas Rule.** หน้าเข้าสู่ระบบเป็น dark brand canvas คงที่ ส่วนการ์ดฟอร์มใช้พื้นผิว `--card` เพื่อให้อ่านง่ายทั้งสองธีม

### Named Rules
**The 10% Accent Rule.** สี Royal Tech Sapphire มีไว้สำหรับ Interactive Elements และสถานะโฟกัสเท่านั้น พื้นที่รวมบนหน้าจอต้องไม่เกิน 10% เพื่อคงความนิ่งและไม่ทำให้ตาล้า
**The Semantic Status Rule.** ห้ามใช้สีสถานะ (เขียว, แดง, เหลือง) เป็นสีตกแต่งเด็ดขาด ต้องใช้เพื่อบอกผลลัพธ์ทางธุรกิจเท่านั้น

## Typography

**Display / Heading Font:** Noto Sans Thai (`var(--font-noto-sans-thai)`)  
**Body Font:** Noto Sans Thai (`var(--font-noto-sans-thai)`)  
**Monospace Font:** Geist Mono (`var(--font-geist-mono)`)

**Character:** การจับคู่ฟอนต์เน้นความเรียบหรูและถูกต้องตามหลักไวยากรณ์ไทย ตัวหนังสือมีหัวอ่านง่ายในระดับข้อความยาว และสลับเป็น Monospace ทันทีเมื่อแสดงตัวเลขเงิน, บาร์โค้ด, Serial Number และเลขที่บิล

### Hierarchy
- **Display** (Bold 700, 1.75rem / 28px, line-height 1.2): หัวเรื่องหลักระดับหน้า เช่น "ภาพรวมระบบ", "บิลและอนุมัติ"
- **Headline** (Semi-bold 600, 1.25rem / 20px, line-height 1.3): หัวข้อการ์ดสถิติ (Stat Cards) และหัวข้อโมดอล
- **Title** (Semi-bold 600, 1rem / 16px, line-height 1.4): ชื่อตาราง, ชื่อกลุ่มสินค้า, รายชื่อลูกค้า
- **Body** (Regular 400, 0.875rem / 14px, line-height 1.5): รายการในตาราง ข้อความกำกับ ข้อมูลลูกค้า
- **Label** (Medium 500, 0.75rem / 12px, letter-spacing 0.025em): ป้ายสถานะ (Badges), หัวคอลัมน์ตาราง, breadcrumbs
- **Monospace Numeric** (Geist Mono Regular/Medium, tabular-nums): จำนวนเงินบาท, รหัส Serial, เลขที่บิล, บาร์โค้ด

### Named Rules
**The Tabular Numbers Rule.** ตัวเลขเงินและยอดสต๊อกทุกลำดับต้องระบุคลาส `tabular-nums` และจัดชิดขวา (text-right) เสมอ เพื่อให้การเปรียบเทียบหลักหน่วยสิบหลักร้อยในคอลัมน์ตรงกันอย่างแม่นยำ

## Layout

ระบบใช้โมเดล **Master-Detail Two-Column Grid** แบบ Responsive:
- **Sidebar Navigation:** กว้างคงที่ 260px ตรึงชิดซ้ายแบบ `sticky top-0 h-screen` แยกพื้นที่เลื่อนเมนูอิสระจากส่วนล่าง
- **Main Canvas:** คอนเทนเนอร์กลางจำกัดความกว้างสูงสุดที่ `max-w-7xl` พร้อมขอบเขต Padding `px-4 py-6 sm:px-6 lg:px-8`
- **Dashboard Grid:** แบ่ง Stat Cards เป็น 2 ถึง 4 คอลัมน์ (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`)
- **Spacing Scale:** อิงตามสเกล 4px/8px (`gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `space-y-5`) เพื่อความกระชับของการวางฟอร์ม

## Elevation & Depth

**Philosophy: Tonal Layering with Ambient Focus**

พื้นผิวส่วนใหญ่ของ KAIOAK TECH POS วางตัวแบบแบนราบ (Flat) โดยสร้างมิติความลึกผ่านสีพื้นผิว 2 ระดับ: พื้นหลังของหน้า (`--background`) และพื้นผิวการ์ด (`--card`) คั่นด้วยเส้นขอบบาง 1px (`--border`)

### Shadow Vocabulary
- **Surface Rest:** ไม่ใช้เงา (`box-shadow: none`) ในสถานะปกติ เพื่อลดภาระสายตา
- **Ambient Focus:** (`shadow-xs` / `0 1px 2px 0 rgb(0 0 0 / 0.05)`): ใช้กับการ์ดและช่องอินพุตที่ต้องการยกตัวขึ้นเล็กน้อย
- **Floating Modals & Dropdowns:** (`shadow-lg` / `0 10px 15px -3px rgb(0 0 0 / 0.1)`): ใช้กับ Popover, Dialog, Dropdown Menu และ Datepicker

### Named Rules
**The Elevation On Action Rule.** เงาจะปรากฏขึ้นเฉพาะเมื่อเกิดการโต้ตอบ (Hover, Focus, หรือ Floating Panel) เท่านั้น ไม่ใช้เงาตกกระทบแบบฟุ้งกระจายบนองค์ประกอบที่อยู่นิ่ง

## Shapes

- **Base Radius:** 0.625rem (10px) สำหรับการ์ดและคอนเทนเนอร์หลัก
- **Component Radius:** 8px (`rounded-md` / `rounded-lg`) สำหรับปุ่ม อินพุต และแท็บ
- **Badge & Chip Radius:** เต็มวงกลม (`rounded-full`) สำหรับตัวอักษรย่อผู้ใช้ และแคปซูลมนสำหรับป้ายสถานะ
- **Border Treatment:** เส้นขอบคมชัดขนาด 1px สี `border` ช่วยกำหนดขอบเขตของช่องตารางและฟอร์มได้อย่างชัดเจน

## Components

### Buttons
- **Shape:** มนพอดีมือ (8px radius)
- **Primary:** พื้นหลังสี Royal Tech Sapphire ข้อความสีขาว พร้อมเอฟเฟกต์ยุบตัว 1px ตอนคลิก (`active:translate-y-px`)
- **Outline:** เส้นขอบสี `border` พื้นหลังสีเดียวกับ canvas โฮเวอร์แล้วเปลี่ยนเป็นโทนเทาอ่อน (`hover:bg-muted`)
- **Ghost:** ไร้เส้นขอบและพื้นหลังในสถานะพัก ใช้ในเมนูย่อยและปุ่มไอคอน

### Badges & Status Indicators
- **Style:** แคปซูลขนาดเล็ก ฟอนต์ 10–12px ฟอนต์กึ่งหนา (`font-medium`)
- **Colors:** สีพื้นโปร่งใส 10% ผสมสีข้อความเข้มตรงตาม Semantic เช่น พื้นเขียวอ่อนข้อความเขียวเข้ม (`bg-emerald-50 text-emerald-700 border-emerald-200`) และคู่โหมดมืด (`dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60`)

### Cards & Tables
- **Cards:** พื้นผิว `--card` (ขาวในโหมดสว่าง / navy ในโหมดมืด) ขอบบาง 1px พร้อมหัวข้อและคำอธิบายย่อยชัดเจน
- **Tables:** แถวหัวตารางสีพื้นอ่อน แถวรายการข้อมูลสูง 44–48px เพื่อให้การคลิกลิงก์บิลหรือแก้ไขทำได้แม่นยำ

### Inputs & Barcode Fields
- **Search & Barcode Input:** สไตล์ Clean Stroke มีไอคอนค้นหา/บาร์โค้ดนำหน้า โฟกัสด้วยวงแหวนสี Primary Ring หนา 2px (`focus-visible:ring-2 focus-visible:ring-primary/20`)

## Do's and Don'ts

### Do:
- **Do** ใช้ Monospace Font (`Geist Mono`) และ `tabular-nums` ทุกครั้งที่แสดงจำนวนเงิน, เลขที่บิล, บาร์โค้ด และ Serial Number
- **Do** ยืนยันสถานะการทำงานด้วยสี Semantic ที่ถูกต้อง (เขียว = สำเร็จ/ชำระแล้ว, ส้ม/เหลือง = รอดำเนินการ, แดง = ยกเลิก/ตีกลับ)
- **Do** ออกแบบให้รองรับการสั่งพิมพ์ใบเสร็จทั้ง 80mm Thermal และ A4 ด้วยคลาส `@media print`
- **Do** ตรึงแถบ Sidebar ชิดซ้าย (`sticky top-0 h-screen`) และให้เฉพาะส่วนเมนูเลื่อนขึ้นลงได้

### Don't:
- **Don't** ใช้ไล่ระดับสีจัดจ้าน (Multi-color Gradients) หรือเอฟเฟกต์กระจกเบลอ (Backdrop Blur) บนองค์ประกอบที่ต้องอ่านข้อมูลหนาแน่น
- **Don't** ปิดกั้นการใช้งานด้วยแอนิเมชันที่ยาวเกิน 200ms
- **Don't** จัดตัวเลขทางการเงินชิดซ้าย (ต้องจัดชิดขวา `text-right` เสมอ)
- **Don't** ใช้สีแดงเพื่อความสวยงาม ให้สงวนไว้สำหรับการลบ ยกเลิก หรือเตือนความผิดพลาดเท่านั้น
