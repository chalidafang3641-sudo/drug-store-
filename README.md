# The Watcher - ระบบแจ้งเตือนวันหมดอายุของยา

Frontend: GitHub Pages (กล้องสแกนได้) · Backend: Google Apps Script (JSON API) · DB: Google Sheets

## ฟีเจอร์ทั้งหมด (6 พาร์ท)
1. โครงระบบ 2 ฝั่ง + ล็อกอิน + ตั้งชื่อ/โลโก้โรงพยาบาล + สแกนทั้ง HID และกล้อง
2. สถานที่เก็บยา (ไอคอน/สี/จุดเริ่มต้น/จัดลำดับ) · รายการยา · Lot บังคับ
3. รับเข้า (เลือกยา > Lot > วันหมดอายุ > จำนวน > สถานที่) สร้าง Item + Transaction
4. หน้าหลัก: สรุป 4 ช่วงหมดอายุ (35/60/120/120+) + ค้นหา + รายการใกล้หมดอายุ + แยกสถานที่
5. ยาแต่ละจุด (จำนวน/รวมจำนวนจริง + รายการในจุด) · แลกยา/ย้ายระหว่างสถานที่
6. แจ้งเตือนรายวันผ่าน Telegram/LINE · เปลี่ยนรหัสผ่าน · ส่งออก Excel

---

## Migration Plan

แผนย้ายระบบไป SvelteKit + Vercel + Supabase อยู่ที่ [`docs/migration-plan.md`](docs/migration-plan.md)

## Requirements

เอกสาร requirement ที่แกะจากโค้ด frontend/backend ปัจจุบันอยู่ที่ [`req.md`](req.md)

ใช้เอกสารนี้เป็น source of truth สำหรับการย้ายระบบไป SvelteKit + Supabase โดยครอบคลุม workflow, role/permission, API contract, data model, validation, business rules และ gap ที่ต้องทำต่อ

## Legacy Data & Assets

ดึงข้อมูลจาก API เดิมมาเก็บ snapshot local:

```bash
OLD_ADMIN_USER=admin OLD_ADMIN_PASSWORD=... npm run legacy:export
```

ดึงรูป/โลโก้ที่อ้างอิงใน snapshot มาเก็บ local:

```bash
npm run legacy:assets
```

ทดสอบและ import snapshot เข้า Supabase/Postgres:

```bash
npm run legacy:import:dry-run
npm run legacy:import
npm run legacy:reconcile
```

ผลลัพธ์ถูกเก็บใน `legacy-exports/` และ `uploads/legacy-assets/` ซึ่งถูก `.gitignore` เพราะเป็นข้อมูลจริง/ไฟล์จริงจากระบบเก่า

สถานะล่าสุด:

- Supabase schema และ legacy snapshot ถูก import ไปยัง project `qvbqoxfuqzzffryqkuva` แล้ว
- Supabase URL: `https://qvbqoxfuqzzffryqkuva.supabase.co`
- Legacy snapshot ล่าสุดมี config 1, locations 12, drugs 16, active stock items 26, transactions 54, users 2
- Reconcile ล่าสุดผ่าน: active locations 12, active drugs 16, active items 26, total qty 26, transactions 54, near-expiry 4
- สร้าง placeholder สำหรับประวัติที่อ้างข้อมูลเก่าที่ไม่อยู่ใน active snapshot: inactive drugs 8, closed items 10, transaction FK null 0
- Legacy users ถูก skip เป็นค่า default เพราะไม่ย้ายรหัสผ่านเก่า/plaintext; ใช้ admin seed แล้วค่อย reset/migrate auth ภายหลัง
- Legacy asset ล่าสุดพบโลโก้ 1 ไฟล์และ upload เข้า Supabase Storage bucket `branding` แล้ว; `app_config.logo_file_id` ถูก update เป็น public Storage URL
- ยังไม่พบรูปยาใน legacy snapshot จึงยังไม่มีไฟล์ยาให้ upload เข้า bucket `drug-images`
- Backend ใหม่ผ่าน read-only smoke test กับ API contract เดิมแล้ว: login, locations, drugs, dashboard, stock, search, history
- Write workflows ผ่าน smoke test กับ Supabase แล้วและ cleanup test rows ด้วย captured ids: receive, exchange, adjust, dispose
- Browser smoke test ของ UI เดิมผ่านแล้วเมื่อ point `window.TW_API_URL` ไป backend ใหม่: login, dashboard, locations, receive, exchange, settings และไม่มี console error

## Function Parity Status

เป้าหมายคือให้ UI เดิมและ flow งานหลักทำงานเหมือนเดิมผ่าน API contract เดิมก่อน แล้วค่อยย้ายไป SvelteKit ทีละส่วน

สถานะปัจจุบัน:

- Read-only workflow หลักผ่านกับ Supabase แล้ว: login/session check, dashboard, locations, drugs, stock, search, recent receive/exchange, low stock
- ข้อมูลเก่าถูก import และ reconcile แล้ว; legacy logo ถูกย้ายเข้า Supabase Storage แล้ว
- Write workflow หลักผ่าน smoke test แล้ว: receive, exchange, dispose, adjust
- UI เดิมผ่าน browser smoke test กับ backend ใหม่แล้วสำหรับงานหลักที่ตรวจแบบเร็ว
- SvelteKit scaffold build ได้แล้ว, login/protected layout ใช้ legacy `app_users` session ผ่าน httpOnly cookie แล้ว, dashboard route อ่าน `getDashboard` จริงจาก Postgres แล้ว; routes งานอื่นยังเป็น placeholder รอ migrate UI จริง

ดังนั้นคำตอบเชิงสถานะคือ backend ใหม่รองรับ UI เดิมได้แล้วในงานหลักระดับ smoke test และ SvelteKit เริ่มมี auth/dashboard จริงแล้ว แต่ยังต้องทำ QA เชิงลึก, permission/edge cases, notification/export และย้าย UI งานหลักที่เหลือเข้า SvelteKit ก่อน production cutover

---

## ติดตั้ง

### A. Backend (Apps Script + Sheet)
1. สร้าง Google Sheet เปล่า > Extensions > Apps Script
2. วางเนื้อหา `Code.gs` ทั้งหมด บันทึก
3. รันฟังก์ชัน `setup` หนึ่งครั้ง (อนุญาตสิทธิ์ Drive/Sheets)
4. Deploy > New deployment > Web app > Execute as **Me**, Who has access **Anyone** > คัดลอก URL `/exec`
   - แก้โค้ดภายหลังต้อง Deploy > Manage deployments > New version ทุกครั้ง

### B. Frontend (GitHub Pages)
1. แก้ `js/api.js` ใส่ค่า `API_URL` เป็น URL `/exec`
2. push โฟลเดอร์นี้ขึ้น GitHub repo
3. Settings > Pages > เลือก branch `main` / root > บันทึก
4. เปิด URL ที่ Pages ให้มา

### C. เข้าใช้ครั้งแรก
- `admin` / `admin1234` (เปลี่ยนรหัสได้ที่ ตั้งค่า > บัญชีผู้ใช้)

---

## ใช้งานบนเครื่องด้วย PostgreSQL

โปรเจกต์นี้มี backend local แบบ Node.js + PostgreSQL ที่รับ API รูปแบบเดียวกับ Google Apps Script เดิม

1. สร้างฐานข้อมูล
   ```bash
   createdb the_watcher
   ```
2. ตั้งค่า environment
   ```bash
   cp .env.example .env
   ```
3. ติดตั้ง dependencies และสร้าง schema
   ```bash
   npm install
   npm run db:setup
   ```
4. เปิด server
   ```bash
  npm run dev
  ```
5. เปิดเว็บที่ `http://localhost:3000`

ค่าเริ่มต้นยังใช้ `admin` / `admin1234`

### D. SvelteKit migration preview

Express dev server เดิมยังใช้ `npm run dev` เหมือนเดิม ส่วน SvelteKit ใช้คำสั่งแยก:

```bash
npm run dev:svelte
npm run check:svelte
npm run build
```

SvelteKit endpoint `POST /api` reuse action contract เดิม และหน้าแรกอ่าน branding/counts จาก Postgres แล้ว

---

## เครื่องยิงบาร์โค้ด (HID)
ทำงานเป็นคีย์บอร์ด ไม่ต้องลงไดรเวอร์ ตั้งให้ส่ง Enter/CR ปิดท้าย (ค่าเริ่มต้นส่วนใหญ่เป็นแบบนี้)
หน้ารับเข้า/ช่องบาร์โค้ดจะโฟกัสรอ ยิงได้เลย ระบบแยกแยะ "เครื่องยิง" กับ "พิมพ์เอง" อัตโนมัติ

## กล้องมือถือ
กดปุ่มสแกนด้วยกล้อง ทำงานบน https (GitHub Pages เป็น https) และต้องอนุญาตกล้อง
นี่คือเหตุผลที่แยก frontend มา GitHub เพราะ Web App ของ GAS รันใน iframe ที่บล็อกกล้อง

## การแจ้งเตือน (Telegram / LINE)
1. ตั้งค่า > การแจ้งเตือน เปิดสวิตช์ เลือกช่องทาง ใส่ token/chat id ตั้งเวลา แล้วบันทึก
   - Telegram: สร้างบอทด้วย @BotFather เอา token มาวาง + ใส่ chat id
   - LINE: ใช้ Channel Access Token ของ Messaging API (LINE Notify ปิดบริการแล้ว) ส่งแบบ broadcast
2. เปิด Apps Script รันฟังก์ชัน `setupNotifications` หนึ่งครั้ง เพื่ออนุญาตสิทธิ์ส่งข้อความและสร้าง trigger รายวัน
3. กดปุ่ม "ส่งข้อความทดสอบ" เพื่อตรวจสอบ

## ส่งออก Excel
- หน้ารับเข้า: ปุ่ม "ส่งออกวันนี้" ดาวน์โหลดรายการรับเข้าของวันนั้น
- ตั้งค่า > ส่งออกข้อมูล: เลือกประเภท (รับเข้า / การเคลื่อนไหวทั้งหมด / สต็อกคงเหลือ) และช่วงวันที่
- ไฟล์เป็น .xlsx เปิดด้วย Excel หรือ Google Sheets รองรับภาษาไทย

---

## ความปลอดภัย / CORS
- โค้ดฝั่ง GitHub เป็น public อย่าใส่ secret (token แจ้งเตือน) ในฝั่งนี้ เก็บไว้ใน Sheet/Apps Script เท่านั้น
- API ใช้ POST `Content-Type: text/plain` และไม่ใส่ custom header เพื่อเลี่ยง CORS preflight
- endpoint เปิด Anyone ระบบจึง validate session token ทุกคำขอ

## โครงไฟล์
```
the-watcher/
  Code.gs            backend ทั้งหมด (router + sheets + auth + logic + แจ้งเตือน + export)
  index.html         app shell
  css/app.css        ธีม OKLCH
  js/api.js          ตัวเรียก API (ใส่ API_URL)
  js/scanner.js      HID + กล้อง
  js/core.js         boot / auth / นำทาง / helper วันหมดอายุ
  js/manage.js       สถานที่ + รายการยา + Lot บังคับ
  js/receive.js      รับเข้า
  js/dashboard.js    หน้าหลัก
  js/stock.js        ยาแต่ละจุด
  js/exchange.js     แลกยา
  js/export.js       ส่งออก Excel
  js/settings.js     ตั้งค่า + โลโก้ + แจ้งเตือน + บัญชี
```

## บทบาทผู้ใช้
- admin: ทั้งหมด · pharmacist: จัดการสต็อก/ยา/แลกยา/รับเข้า · staff: รับเข้า + ดู

## รูปยา
เพิ่มรูปได้ที่ ตั้งค่า > รายการยา > เลือกยา/เพิ่มยา > ปุ่มเลือกรูป (ถ่าย/เลือกจากคลังภาพ) รูปเก็บใน Google Drive และแสดงในทุกหน้า (รายการยา รับเข้า ยาแต่ละจุด แลกยา หน้าหลัก)

## ฟีเจอร์เพิ่มเติม (รุ่นล่าสุด)
- ตัดจ่าย/ทิ้งยา: ยาแต่ละจุด > ปุ่มตัดจ่าย (เบิกใช้/หมดอายุ/ชำรุด)
- ตรวจนับสต็อก: ตั้งค่า > ตรวจนับสต็อก เลือกจุดแล้วกรอกจำนวนจริงเพื่อปรับยอด
- พิมพ์รายงาน: ตั้งค่า > พิมพ์รายงาน (ใกล้หมดอายุ/สต็อก) พิมพ์หรือบันทึก PDF
- จัดการผู้ใช้ (แอดมิน): เพิ่ม/แก้ไข/ลบ ผู้ใช้ กำหนดบทบาท รีเซ็ตรหัส
- ประวัติการเคลื่อนไหว: ดูรับเข้า/ย้าย/ตัดจ่าย/ปรับยอด กรองตามประเภท
- แจ้งเตือนสต็อกต่ำ: ตั้ง min ต่อยา (ฟอร์มยา) แสดงแถบเตือนหน้าหลัก + รวมในแจ้งเตือนรายวัน
- ตั้งช่วงเตือน (วัน) เองได้ที่ ข้อมูลโรงพยาบาล
- การแสดงผล: โหมดมืด และปีพุทธศักราช (พ.ศ.)
- PWA: เปิดบนมือถือ > เพิ่มลงในหน้าจอโฮม เพื่อใช้เหมือนแอป (มีไอคอน)

### ติดตั้ง PWA
ต้องเปิดผ่าน https (GitHub Pages เป็น https อยู่แล้ว) ไฟล์ manifest.json, sw.js และโฟลเดอร์ icons ต้องอยู่ root เดียวกับ index.html
