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
