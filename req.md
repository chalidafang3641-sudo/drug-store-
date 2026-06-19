# Requirements: The Watcher / Drug Store

เอกสารนี้แกะ requirement จากโค้ด frontend และ backend ปัจจุบัน ได้แก่ static frontend (`index.html`, `js/*.js`), backend เดิมบน Google Apps Script (`Code.gs`), backend PostgreSQL local (`server/index.js`) และ schema (`db/schema.sql`)

## 1. ภาพรวมระบบ

The Watcher เป็นระบบบริหารคลังยาเพื่อใช้ในโรงพยาบาล/หน่วยงานสุขภาพ โดยเน้นการติดตามยาแยกตามสถานที่เก็บ, Lot No., วันหมดอายุ และจำนวนคงเหลือ

ระบบต้องรองรับงานหลักดังนี้:

- เข้าสู่ระบบด้วยบัญชีผู้ใช้และสิทธิ์ตามบทบาท
- ตั้งค่าชื่อโรงพยาบาล โลโก้ ช่วงเตือนวันหมดอายุ และรูปแบบการแสดงผล
- จัดการสถานที่เก็บยา พร้อมไอคอน สี จุดเริ่มต้นรับเข้า และลำดับการแสดงผล
- จัดการ master ยา พร้อมบาร์โค้ด หน่วย รูปภาพ จุดเก็บเริ่มต้น การบังคับ Lot และขั้นต่ำสต็อก
- รับยาเข้าสต็อกโดยเลือก/ค้นหา/สแกนยา กรอก Lot วันหมดอายุ จำนวน และสถานที่
- ดู dashboard ยาใกล้หมดอายุ, สต็อกต่ำ, ค้นหารายการยา และดูแยกสถานที่
- ดูสต็อกตามสถานที่ ย้ายยา/แลกยาระหว่างสถานที่ และตัดจ่าย/ทิ้งยา
- ตรวจนับสต็อกจริงแล้วปรับยอด
- ดูประวัติการเคลื่อนไหว
- ส่งออก Excel และพิมพ์รายงาน/PDF
- แจ้งเตือนยาใกล้หมดอายุผ่าน Telegram หรือ LINE
- รองรับการใช้งานบนมือถือและเดสก์ท็อป รวมถึง PWA

## 2. ผู้ใช้และสิทธิ์

ระบบมีบทบาทมาตรฐาน 3 แบบ:

| บทบาท | สิทธิ์ | คำอธิบาย |
| --- | --- | --- |
| `admin` | `*` | ผู้ดูแลระบบ ใช้ได้ทุกเมนู รวมตั้งค่า ระบบแจ้งเตือน และจัดการผู้ใช้ |
| `pharmacist` | `stock`, `drug`, `exchange`, `receive`, `view` | จัดการยา สต็อก รับเข้า ย้าย และดูข้อมูล |
| `staff` | `receive`, `view` | รับเข้าและดูข้อมูล |

Requirement:

- ทุก API ที่ไม่ใช่ `ping`, `branding`, `login`, `logout` ต้องตรวจ session token
- token หมดอายุต้องตอบ `code: "AUTH"` เพื่อให้ frontend logout และกลับหน้า login
- ผู้ใช้ต้องเปลี่ยนรหัสผ่านตัวเองได้
- admin ต้องเพิ่ม/แก้ไข/ลบผู้ใช้ได้
- admin ห้ามลบบัญชีตัวเอง
- รหัสผ่านใหม่ต้องยาวอย่างน้อย 4 ตัวอักษร
- backend PostgreSQL ต้อง hash password ด้วย `crypt()`/`pgcrypto`

## 3. Frontend Shell และ UX

ระบบปัจจุบันเป็น SPA แบบ static HTML/JS:

- `index.html` เป็น app shell
- เมนูหลักมี 5 ส่วน:
  - หน้าหลัก (`home`)
  - ยาแต่ละจุด (`locations`)
  - รับเข้า (`receive`) เป็นปุ่มกลาง/FAB
  - แลกยา (`exchange`)
  - ตั้งค่า (`settings`)
- บนมือถือใช้ bottom navigation
- บนเดสก์ท็อปต้องปรับ layout ให้ใช้งานได้กว้างขึ้น
- ต้องมี loading overlay, toast, empty state, bottom sheet และ confirmation dialog
- ต้องรองรับ dark mode โดยเก็บค่าใน `localStorage`
- ต้องรองรับการแสดงปี พ.ศ. ตามค่า config
- ต้อง escape ข้อความก่อน render เพื่อป้องกัน HTML injection
- frontend ต้องเรียก API แบบ `POST` ด้วย `Content-Type: text/plain` เพื่อหลีกเลี่ยง CORS preflight ของ Apps Script เดิม
- API base ต้อง override ได้ด้วย `window.TW_API_URL`; ค่า default local คือ `http://localhost:3000/api`

## 4. Authentication Flow

Requirement:

- หน้าแรกต้องโหลด branding ก่อนแสดง login/app
- ถ้ามี token ใน `localStorage` (`tw_token`) ต้องเรียก `me` เพื่อตรวจ session
- ถ้า session ใช้ได้ให้ render app และโหลดหน้าหลัก
- ถ้า session หมดอายุต้องลบ token และแสดงหน้า login
- login ต้องรับ `username`, `password`
- login สำเร็จต้องเก็บ token, user object และ render app
- logout ต้องเรียก API `logout`, ลบ token และกลับหน้า login

## 5. Branding และ Config

ข้อมูล config หลัก:

- `hospital_name`
- `logo_file_id` / `logo_url`
- `expiry_thresholds.critical`
- `expiry_thresholds.high`
- `expiry_thresholds.medium`
- `default_receive_location_id`
- `notification`
- `display_be`
- `app_version`

Requirement:

- ชื่อโรงพยาบาลต้องไม่ว่าง
- ช่วงเตือนวันหมดอายุต้องเรียงจากน้อยไปมาก: `critical < high < medium`
- ค่า default ปัจจุบันคือ 35, 60, 120 วัน
- admin ต้องอัปโหลด/ลบโลโก้ได้
- frontend จำกัดโลโก้ไม่เกิน 4 MB
- backend local fallback เก็บไฟล์ใน `uploads/`
- backend PostgreSQL/Supabase production ต้อง upload โลโก้ไป bucket `branding` และรูปยาไป bucket `drug-images` เมื่อมี `SUPABASE_SERVICE_ROLE_KEY`
- backend Apps Script เดิมเก็บไฟล์ใน Google Drive
- `branding` API ต้องเปิดให้เรียกโดยไม่ต้อง login เพื่อแสดงชื่อ/โลโก้ที่หน้า login

## 6. สถานที่เก็บยา

ข้อมูลสถานที่:

- `id`
- `name`
- `icon`
- `color`
- `is_default_receive`
- `sort_order`
- `active`

Requirement:

- ผู้ใช้สิทธิ์ `view` ดูสถานที่ได้
- ผู้ใช้สิทธิ์ `drug` เพิ่ม/แก้ไข/ลบ/จัดลำดับสถานที่ได้
- ชื่อสถานที่ต้องไม่ว่าง
- เพิ่มสถานที่ใหม่ต้องใช้ icon default `box` และสี default `#16A34A`
- ลบสถานที่เป็น soft delete (`active = false`)
- สถานที่ที่ถูกลบต้องไม่แสดงในรายการใช้งาน
- ตั้งจุดเริ่มต้นรับเข้าได้เพียง 1 สถานที่
- จัดลำดับสถานที่ด้วย array ของ `ids`
- frontend ต้องบันทึก icon, color และ default receive แบบ auto-save

## 7. รายการยา

ข้อมูลยา:

- `id`
- `name`
- `code` บาร์โค้ด/รหัส
- `unit`
- `require_lot`
- `default_location_id`
- `image_file_id` / `image_url`
- `min_qty`
- `active`

Requirement:

- ผู้ใช้สิทธิ์ `view` ดูรายการยาได้
- ผู้ใช้สิทธิ์ `drug` เพิ่ม/แก้ไข/ลบยาได้
- ชื่อยาต้องไม่ว่าง
- `code` ถ้ามีต้องไม่ซ้ำกับยา active ตัวอื่น
- ลบยาเป็น soft delete (`active = false`)
- อัปโหลดรูปยาได้จากกล้อง/คลังภาพ
- frontend จำกัดรูปยาไม่เกิน 5 MB
- รูปยาต้องแสดงในรายการยา, รับเข้า, dashboard, stock, exchange และ low stock
- กำหนด `require_lot` ได้จากฟอร์มยาและหน้า "รายการที่ต้องบันทึก Lot No."
- กำหนด `min_qty` ได้; ค่า 0 หมายถึงปิดแจ้งเตือนสต็อกต่ำ
- จุดเก็บเริ่มต้นของยาต้องใช้เติมค่า default ในหน้ารับเข้าเมื่อเลือกยา

## 8. Barcode และ Scanner

ระบบต้องรองรับ 2 วิธี:

- HID / keyboard-wedge scanner
- กล้องมือถือผ่าน `html5-qrcode`

Requirement:

- HID scanner ต้องทำงานผ่านช่อง input ที่ focus อยู่
- เครื่องยิงควรส่ง Enter/CR ปิดท้าย
- frontend ต้องจับ Enter แล้วส่งค่า barcode ให้ callback
- frontend ต้องเดาว่าเป็น HID หรือ manual จากความเร็วการพิมพ์
- กล้องต้องใช้กล้องหลัง (`facingMode: environment`)
- กล้องต้องทำงานบน HTTPS
- เปิดกล้องซ้ำต้องปิด instance เดิมก่อน
- สแกนสำเร็จต้อง stop camera และเติม code ในช่องที่เกี่ยวข้อง

## 9. รับเข้า

Flow:

1. โหลดรายการยา (`getDrugs`) และสถานที่ (`getLocations`)
2. ตั้งสถานที่รับเข้าเริ่มต้นจาก `is_default_receive` หรือรายการแรก
3. เลือกยาได้จากบาร์โค้ด, กล้อง หรือค้นหาชื่อยา/รหัส
4. กรอก Lot, วันหมดอายุ, จำนวน และสถานที่
5. บันทึกด้วย `receiveItem`
6. แสดงรายการรับเข้าล่าสุด (`recentReceives`)
7. ส่งออกข้อมูลรับเข้าวันนี้ได้

Validation:

- ต้องเลือกยา
- ต้องเลือกสถานที่
- `qty` ต้องมากกว่า 0
- `expiry_date` ต้องไม่ว่าง
- ถ้ายา `require_lot = true` ต้องกรอก `lot_no`
- จำนวนใน UI เริ่มต้น 1 และมีปุ่มเพิ่ม/ลด

Business rules:

- ถ้ามี active item ที่ `drug_id`, `location_id`, `lot_no`, `expiry_date` ตรงกัน ต้องรวมจำนวนเข้ารายการเดิม
- ถ้าไม่พบรายการเดิม ต้องสร้าง item ใหม่
- ทุกการรับเข้าต้องสร้าง transaction type `receive`
- transaction ต้องเก็บ user ที่ทำรายการ

## 10. Dashboard / หน้าหลัก

Dashboard ใช้ API `getDashboard`

Requirement:

- แสดง summary ตามช่วงวันหมดอายุ:
  - `within35` หรือ threshold critical
  - `within60` หรือ threshold high
  - `within120` หรือ threshold medium
  - `over120`
  - `expired`
  - `total_items`
  - `total_qty`
- รายการ `near` ต้องแสดงเฉพาะรายการที่เหลือวันไม่เกิน `medium`
- รายการต้องเรียงจากใกล้หมดอายุมากที่สุดไปไกลที่สุด
- `expired` ต้องนับรายการที่ `days < 0`
- รายการ expired ยังอยู่ใน bucket critical เพราะ `days <= critical`
- แสดงชื่อยา รูปยา สถานที่ จำนวน Lot วันหมดอายุ และสถานะสีตาม bucket
- แสดง low stock banner จาก `low_stock`
- แสดงสรุปใกล้หมดอายุแยกสถานที่ (`by_location`)
- มี search box ที่ debounce 300 ms และเรียก `searchItems`
- `searchItems` ต้องค้นจากชื่อยา สถานที่ และ Lot
- search result ต้องจำกัด 100 รายการ

## 11. สต็อกตามสถานที่

API:

- `getLocationStock`
- `getLocationItems`

Requirement:

- แสดงการ์ด "รวมทุกสถานที่"
- แสดงการ์ดแต่ละสถานที่ตาม `sort_order`
- แต่ละการ์ดต้องมีจำนวนรายการ (`count`) และจำนวนรวม (`qty`)
- กดสถานที่แล้วแสดงรายการ active item ในสถานที่นั้น
- `location_id = "all"` ต้องดึงทุกสถานที่
- รายการต้องเรียงตามวันหมดอายุ
- แต่ละรายการต้องมี action:
  - ย้าย/แลกยา
  - ตัดจ่าย/ทิ้งยา

## 12. แลกยา / ย้ายยา

Flow:

1. ค้นหา item จาก `searchItems`
2. เลือก item
3. เลือกสถานที่ปลายทาง
4. ระบุจำนวน
5. ยืนยันด้วย `exchangeItem`
6. แสดงประวัติย้ายล่าสุด (`recentExchanges`)

Validation:

- ต้องเลือก item
- ปลายทางต้องไม่ใช่สถานที่เดิม
- จำนวนต้องมากกว่า 0
- จำนวนต้องไม่เกินจำนวนคงเหลือของ item

Business rules:

- ลดจำนวนจาก item ต้นทาง
- ถ้าต้นทางเหลือ 0 ให้เปลี่ยน status เป็น `exchanged`
- ถ้าปลายทางมี active item ที่ยา/Lot/expiry ตรงกัน ให้รวมจำนวน
- ถ้าปลายทางไม่มี ให้สร้าง item ใหม่
- ต้องสร้าง transaction type `exchange`

## 13. ตัดจ่าย / ทิ้งยา

Flow:

1. เปิดจากหน้ารายการยาแต่ละจุด
2. เลือกเหตุผล
3. ระบุจำนวน
4. เพิ่ม note ได้
5. บันทึกด้วย `disposeItem`

เหตุผลใน UI:

- `เบิกใช้`
- `หมดอายุ`
- `ชำรุด`
- `เสียหาย`
- `อื่นๆ`

Validation:

- จำนวนต้องมากกว่า 0
- จำนวนต้องไม่เกินจำนวนที่มี
- ถ้าไม่ส่งเหตุผลให้ default เป็น `อื่นๆ`

Business rules:

- ลดจำนวนจาก item
- ถ้าคงเหลือ 0 และเหตุผลคือ `เบิกใช้` ให้ status เป็น `used`
- ถ้าคงเหลือ 0 และเหตุผลอื่น ให้ status เป็น `disposed`
- ถ้ายังเหลือให้ status เป็น `active`
- ต้องสร้าง transaction type `dispose`

## 14. ตรวจนับสต็อก

API: `adjustItem`

Requirement:

- เมนูนี้แสดงเฉพาะผู้มีสิทธิ์ `stock` หรือ admin
- ผู้ใช้ต้องเลือกสถานที่ก่อน
- ระบบต้องแสดงรายการ active item ในสถานที่นั้น
- ผู้ใช้กรอกจำนวนจริงที่นับได้
- จำนวนจริงต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป

Business rules:

- ถ้าจำนวนจริงเท่ากับจำนวนในระบบ ให้ตอบว่าไม่มีการเปลี่ยนแปลง
- ถ้าจำนวนจริงเป็น 0 ให้ item status เป็น `disposed`
- ถ้าจำนวนจริงมากกว่า 0 ให้ item status เป็น `active`
- ต้องสร้าง transaction type `adjust`
- note ต้องบอกจำนวนเดิมและจำนวนใหม่ เช่น `ปรับจาก 10 เป็น 8`

## 15. ประวัติการเคลื่อนไหว

API: `getHistory`

Requirement:

- แสดง transaction ล่าสุด
- กรองประเภทได้:
  - ทั้งหมด
  - `receive`
  - `exchange`
  - `dispose`
- backend รองรับ `adjust` ด้วย แม้ UI filter ปัจจุบันยังไม่มีปุ่มแยก
- default limit ฝั่ง UI คือ 80
- ต้องแสดงชื่อยา ประเภท จาก/ไป สถานที่ Lot จำนวน เหตุผล และเวลา
- เรียงจากล่าสุดไปเก่าสุด

## 16. Export Excel

API: `exportData`

ประเภท export:

- `receive`: รับเข้าในช่วงวันที่
- `all`: การเคลื่อนไหวทั้งหมดในช่วงวันที่ (`receive`, `exchange`, `dispose`, `adjust`)
- `stock`: สต็อกคงเหลือปัจจุบันทั้งหมด

Requirement:

- frontend สร้างไฟล์ `.xlsx` ด้วย `XLSX`
- ถ้าไม่มีข้อมูลต้องแจ้งผู้ใช้
- ถ้าโหลด library ไม่ได้ต้องแจ้ง error
- `stock` ไม่ต้องใช้ช่วงวันที่
- `receive` และ `all` ต้องกรองจาก `created_at`
- ชื่อไฟล์ต้องขึ้นต้น `TheWatcher_`
- export ต้องรองรับภาษาไทย

Columns:

- `receive`: วันที่, เวลา, ยา, สถานที่, Lot No., วันหมดอายุ, จำนวน, โดย
- `all`: วันที่, เวลา, ประเภท, ยา, จาก, ไป, Lot No., วันหมดอายุ, จำนวน, เหตุผล, โดย
- `stock`: ยา, สถานที่, Lot No., วันหมดอายุ, คงเหลือ(วัน), จำนวน, รับเข้าโดย, รับเข้าเมื่อ

## 17. รายงานพิมพ์ / PDF

Requirement:

- ผู้ใช้เลือกประเภทรายงานได้:
  - ยาใกล้หมดอายุภายใน threshold medium
  - สต็อกคงเหลือทั้งหมด
- ระบบต้องเปิดหน้าต่างใหม่และ render เอกสาร A4
- ต้องใช้ชื่อโรงพยาบาลเป็นหัวรายงาน
- ต้องแสดงเวลาพิมพ์และจำนวนรายการ
- ผู้ใช้สามารถเลือก print หรือ save as PDF จาก browser
- ถ้า browser block popup ต้องแจ้งให้อนุญาต popup

## 18. แจ้งเตือน Telegram / LINE

Config:

- `enabled`
- `channel`: `telegram` หรือ `line`
- `notify_time`
- `telegram_chat_id`
- `telegram_bot_token`
- `line_token`

Requirement:

- admin เท่านั้นที่ดู/แก้ไข config แจ้งเตือนได้
- token ที่ตั้งไว้แล้วต้องไม่ส่งออกแบบ plain ใน `getNotifyConfig`
- UI ต้องแสดง placeholder ว่าตั้ง token แล้ว ถ้ามี token
- บันทึกค่า token ใหม่ได้โดยกรอกช่อง token
- มีปุ่มส่งข้อความทดสอบ (`testNotification`)
- Apps Script backend ต้องมี `setupNotifications` เพื่อสร้าง trigger รายวัน
- Apps Script backend ต้องส่งสรุปยาใกล้หมดอายุและสต็อกต่ำตามเวลาที่ตั้ง
- PostgreSQL local backend ปัจจุบันยังไม่ส่งจริง และ `testNotification` ตอบว่า local ยังไม่ได้ตั้ง worker

## 19. การแสดงผล

Requirement:

- ผู้ใช้ทุกบทบาทเปิด/ปิด dark mode ได้
- dark mode เก็บใน `localStorage` key `tw_theme`
- admin เปิด/ปิดการแสดงปี พ.ศ. ได้
- การตั้งปี พ.ศ. เป็น config กลางของระบบ (`display_be`)
- วันที่ใน UI ต้องผ่าน helper เพื่อแสดงตามค่าปี พ.ศ.

## 20. PWA

Requirement:

- ต้องมี `manifest.json`
- ต้องมี `sw.js`
- ต้องมี icon สำหรับติดตั้งบน home screen
- ระบบต้องใช้งานผ่าน HTTPS เมื่อต้องใช้กล้องและ PWA install
- static assets หลักต้อง cache ได้

## 21. API Contract

ทุกคำสั่งใช้ action-based API:

```json
{
  "action": "ชื่อคำสั่ง",
  "token": "session-token ถ้าต้อง login",
  "...": "payload เฉพาะ action"
}
```

Response สำเร็จ:

```json
{
  "status": "success"
}
```

Response ผิดพลาด:

```json
{
  "status": "error",
  "message": "ข้อความภาษาไทย"
}
```

Session หมดอายุ:

```json
{
  "status": "error",
  "code": "AUTH",
  "message": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
}
```

รายการ action:

| Action | สิทธิ์ | หน้าที่ |
| --- | --- | --- |
| `ping` | public | ตรวจ API |
| `branding` | public | ดึงชื่อ/โลโก้/threshold สำหรับหน้า login |
| `login` | public | เข้าสู่ระบบ |
| `logout` | public | ออกจากระบบ |
| `me` | `view` | ตรวจ token และดึง user ปัจจุบัน |
| `getConfig` | `*` | ดึง config ระบบ |
| `saveConfig` | `*` | บันทึก config |
| `uploadLogo` | `*` | อัปโหลดโลโก้ |
| `removeLogo` | `*` | ลบโลโก้ |
| `getLocations` | `view` | ดึงสถานที่ active |
| `saveLocation` | `drug` | เพิ่ม/แก้ไขสถานที่ |
| `deleteLocation` | `drug` | soft delete สถานที่ |
| `reorderLocations` | `drug` | จัดลำดับสถานที่ |
| `setDefaultReceive` | `drug` | ตั้งสถานที่รับเข้าเริ่มต้น |
| `getDrugs` | `view` | ดึงยา active |
| `saveDrug` | `drug` | เพิ่ม/แก้ไขยา |
| `deleteDrug` | `drug` | soft delete ยา |
| `setRequireLot` | `drug` | เปิด/ปิด Lot บังคับ |
| `uploadImage` | `drug` | อัปโหลดรูปยา |
| `receiveItem` | `receive` | รับยาเข้าสต็อก |
| `recentReceives` | `view` | ดึงรับเข้าล่าสุด |
| `findDrugByCode` | `view` | ค้นยาโดย barcode |
| `getDashboard` | `view` | ดึง summary/near/low stock |
| `searchItems` | `view` | ค้น active item |
| `getLocationStock` | `view` | สรุป stock ตามสถานที่ |
| `getLocationItems` | `view` | รายการ stock ในสถานที่ |
| `exchangeItem` | `exchange` | ย้ายยาระหว่างสถานที่ |
| `recentExchanges` | `view` | ดึงประวัติย้ายล่าสุด |
| `getNotifyConfig` | `*` | ดึง config แจ้งเตือน |
| `saveNotifyConfig` | `*` | บันทึก config แจ้งเตือน |
| `testNotification` | `*` | ส่งข้อความทดสอบ |
| `changePassword` | `view` | เปลี่ยนรหัสผ่านตัวเอง |
| `exportData` | `view` | ส่งออกข้อมูล |
| `disposeItem` | `receive` | ตัดจ่าย/ทิ้งยา |
| `getHistory` | `view` | ดูประวัติการเคลื่อนไหว |
| `getUsers` | `*` | ดึงรายชื่อผู้ใช้ |
| `saveUser` | `*` | เพิ่ม/แก้ไขผู้ใช้ |
| `deleteUser` | `*` | ลบผู้ใช้ |
| `getLowStock` | `view` | ดึงรายการสต็อกต่ำ |
| `adjustItem` | `stock` | ปรับยอดจากการตรวจนับ |

## 22. Data Model

หลักการ id:

- `id` เป็น internal primary key แบบ `BIGINT GENERATED ALWAYS AS IDENTITY`
- foreign key ทุกตารางอ้างอิงกันด้วย `id` bigint เพื่อให้ join/index เร็วและ schema ชัด
- `code_id` เป็น public/reference id ที่ API และ frontend ใช้เรียกข้อมูล
- API response field `id` ต้องส่งค่า `code_id` ออกไป ไม่ส่ง internal bigint
- ตอน import legacy data สามารถใช้ `code_id` เก็บ id เดิม/รหัสอ้างอิงจากระบบเก่า หรือให้ระบบ generate ค่าใหม่ด้วย prefix ต่อ table

### `app_config`

เก็บค่า config กลางของระบบ มีเพียง 1 row (`id = true`)

Fields สำคัญ:

- `hospital_name`
- `logo_file_id`
- `folder_id`
- `expiry_critical_days`
- `expiry_high_days`
- `expiry_medium_days`
- `default_receive_location_id`
- `notification_enabled`
- `notification_channel`
- `telegram_bot_token`
- `telegram_chat_id`
- `line_token`
- `notify_time`
- `display_be`
- `app_version`

### `locations`

เก็บ master สถานที่เก็บยา

Constraints:

- `id` เป็น bigint internal primary key
- `code_id` เป็น unique public id สำหรับ API
- `name` ห้ามว่าง
- `active` ใช้ soft delete
- `default_receive_location_id` ใน config อ้างถึง `locations.id`

### `drugs`

เก็บ master ยา

Constraints:

- `id` เป็น bigint internal primary key
- `code_id` เป็น unique public id สำหรับ API
- `name` ห้ามว่าง
- `code` unique เฉพาะยา active และ code ไม่ว่าง
- `min_qty >= 0`
- `default_location_id` อ้างถึง `locations.id`

### `items`

เก็บ stock lot จริง

Fields สำคัญ:

- `id` เป็น bigint internal primary key
- `code_id` เป็น unique public id สำหรับ API
- `drug_id`
- `location_id`
- `lot_no`
- `expiry_date`
- `qty`
- `status`
- `closed_at`
- `closed_reason`
- `last_transaction_id`
- `received_by`
- `received_at`
- `note`

Constraints:

- `qty >= 0`
- `status` อยู่ใน `active`, `exchanged`, `used`, `disposed`
- active item ต้อง unique ตาม `drug_id`, `location_id`, `lot_no`, `expiry_date`

### `transactions`

เก็บประวัติทุก movement

Fields สำคัญ:

- `id` เป็น bigint internal primary key
- `code_id` เป็น unique public id สำหรับ API
- `type`: `receive`, `exchange`, `dispose`, `adjust`
- `item_id`
- `drug_id`
- `from_location_id`
- `to_location_id`
- `qty`
- `lot_no`
- `expiry_date`
- `reason`
- `note`
- `by_username`
- `created_at`

### `app_users`

เก็บ user, role และ permissions ของ legacy/local auth ชั่วคราวระหว่าง migration

Constraints:

- `id` เป็น bigint internal primary key
- `code_id` เป็น unique public id สำหรับ API
- `username` unique
- `role` อยู่ใน `admin`, `pharmacist`, `staff`
- `permissions` เป็น text array
- `active` ใช้ปิดใช้งานบัญชี

### `sessions`

เก็บ session token

- `id` เป็น bigint internal primary key
- `code_id` เป็น session token ที่ API ส่งให้ frontend
- `expires_at` ใช้ตรวจหมดอายุ
- local backend ตั้งอายุ session 8 ชั่วโมง

### `roles`

เก็บ role และ permission set สำหรับ Supabase Auth/profile model

- seed มาตรฐาน: `admin`, `pharmacist`, `staff`
- `permissions` เป็น text array
- ใช้เป็นแหล่งอ้างอิงกลางแทนการ hard-code permission ในระยะยาว

### `profiles`

เก็บ profile ของผู้ใช้ระบบใหม่ที่ผูกกับ Supabase Auth

- `auth_user_id` อ้างถึง `auth.users.id`
- `role_id` อ้างถึง `roles.id`
- `username` ใช้รองรับ migration/legacy user ที่ยังไม่ผูก Supabase Auth
- ต้องมีอย่างน้อย `auth_user_id` หรือ `username`

### `legacy_id_map`

เก็บ mapping ระหว่าง id ระบบเก่ากับ id/code_id ระบบใหม่

- ใช้สำหรับ import ซ้ำแบบ idempotent
- unique ตาม `source_system`, `source_table`, `legacy_id`, `target_table`
- `payload` เก็บ raw source row หรือ metadata เพื่อ audit การ import

### `audit_logs`

เก็บประวัติการเปลี่ยน master/config และการกระทำสำคัญที่ไม่ใช่ stock movement

- `actor_profile_id` หรือ `actor_username`
- `action`
- `table_name`
- `record_id` / `record_code_id`
- `old_data` / `new_data` เป็น JSONB

### `errors`

เก็บ error log ของ backend local

- `where_name`
- `message`
- `stack`
- `created_at`

## 23. Business Rules สำคัญ

- Stock ที่แสดงในระบบต้องนับเฉพาะ `items.status = active` และ `qty > 0`
- เมื่อ item ปิด lifecycle เพราะย้ายหมด/ใช้หมด/ทิ้ง/ตรวจนับเป็น 0 ต้องบันทึก `closed_at`, `closed_reason`, และ `last_transaction_id`
- รายการยา/สถานที่ที่ถูกลบต้องไม่แสดงในงานปกติ
- การเปลี่ยนแปลง stock ทุกแบบต้องมี transaction
- รับเข้าหรือย้ายเข้าปลายทางต้อง merge lot ถ้า key ตรงกัน
- วันหมดอายุคำนวณจากวันที่แบบ day-level ไม่รวมเวลา
- ยาใกล้หมดอายุใช้ threshold จาก config ไม่ควร hard-code 35/60/120 ในระบบใหม่
- สต็อกต่ำคำนวณจากผลรวม active item ของยาเทียบกับ `drugs.min_qty`
- การอัปโหลดรูปและโลโก้ต้องไม่เก็บ secret ใน frontend
- API endpoint อาจ public ได้ แต่ทุก action ที่เป็นข้อมูลจริงต้องตรวจ token และ permission

## 24. Non-Functional Requirements

- UI ต้องใช้งานบนมือถือเป็นหลัก และเดสก์ท็อปได้ดี
- กล้องต้องทำงานบน HTTPS
- API ต้องตอบเป็น JSON ภาษาไทยตาม contract เดิม
- Frontend ต้องคง action API contract เดิมจนกว่า UI ใหม่จะ stable
- ระบบต้องรองรับ migration ไป SvelteKit + Supabase โดยไม่ทำ logic สำคัญหาย
- Backend ต้องใช้ transaction/lock เมื่อลดหรือย้าย stock เพื่อกันยอดคลาดเคลื่อน
- Query ที่ใช้บ่อยต้องมี index:
  - active item by location
  - active item by drug
  - active item by expiry
  - transaction by created_at/type
  - session by expires_at
- Schema ต้องเตรียม `pg_trgm` index สำหรับ search จากชื่อยา ชื่อสถานที่ และ Lot เพราะ UI ใช้ pattern ค้นหาแบบ contains
- Index บน `items` ควรเป็น partial index สำหรับ hot subset `status = 'active' AND qty > 0` เพื่อลดขนาด index และเร่ง dashboard/stock/search
- Transaction export/history ควรใช้ index ตาม `(type, created_at)` และหลีกเลี่ยง query ที่ cast `created_at::date` ถ้าต้องการใช้ index เต็มประสิทธิภาพ
- Supabase schema ใน public ต้องเปิด RLS ทุกตาราง และให้ server/API ใช้ service role หรือกำหนด policy ตาม role ก่อนเปิด Data API ให้ client ใช้ตรง
- ห้าม commit secret, `.env`, database dump, export snapshot หรือ uploaded files

## 25. Migration Requirements ไป SvelteKit + Supabase

เมื่อต้องย้ายระบบ:

- ใช้ SvelteKit เป็น frontend/backend framework
- ใช้ Supabase Postgres เป็น database หลัก
- แปลง action API เดิมเป็น SvelteKit server routes หรือ Supabase-backed service layer
- คง response shape ของ API เดิมไว้ในช่วงแรกเพื่อลดความเสี่ยง
- ใช้ schema PostgreSQL เป็นฐาน แล้วปรับให้เข้ากับ Supabase migration
- ย้าย auth ได้ 2 ทาง:
  - ระยะสั้น: คง `app_users` + `sessions`
  - ระยะยาว: ใช้ Supabase Auth แล้ว map role/permissions ใน profile table
- อัปโหลดรูปควรย้ายไป Supabase Storage; backend ใหม่ทำ Storage upload แล้วเมื่อมี service role env และ fallback เป็น local `uploads/` สำหรับ dev
- รูป/โลโก้จากระบบเก่าต้อง migrate จาก Google Drive URL/file id ผ่าน `uploads/legacy-assets/manifest.json`
- snapshot ล่าสุดพบ legacy logo 1 ไฟล์จาก `config.logo_file_id` และ upload เข้า Supabase Storage bucket `branding` แล้ว; ยังไม่พบรูปยาใน `drugs` หรือ `active_items`
- asset migration ต้องไม่ commit ไฟล์จริงใน `uploads/legacy-assets/`; ให้ upload เข้า Supabase Storage แล้วเก็บ storage path/reference ใน database
- Notification ต้องมี worker/cron ใหม่ แทน Apps Script trigger
- Data migration ต้องใช้ snapshot จาก legacy API:
  - config
  - locations
  - drugs
  - active_items
  - transactions
  - users
- Data migration tooling ต้องรองรับ:
  - dry-run import ที่ใช้ path เดียวกับ import จริงและ rollback transaction
  - committed import แบบ transaction เดียว
  - idempotent upsert ผ่าน `legacy_id_map`
  - reconciliation report หลัง import
  - placeholder สำหรับประวัติ transaction ที่อ้าง legacy drug/item ที่ไม่อยู่ใน active snapshot
- Legacy users ต้องไม่ถูก import พร้อมรหัสผ่านเก่า; ค่า default ต้อง skip user migration และใช้การ reset password หรือ Supabase Auth migration ภายหลัง
- ต้อง validate จำนวน record หลัง import เทียบกับ snapshot รวมถึง active stock qty, transaction count, near-expiry count, legacy map count, placeholder count และ transaction FK null checks

## 26. ช่องว่าง/ข้อสังเกตจากโค้ดปัจจุบัน

- `docs/design.md` ที่ copy มาจาก ns-erp ยังมีบริบทของระบบอื่น ต้องปรับให้ตรงกับ Drug Store ภายหลัง
- SvelteKit scaffold ปัจจุบัน build ได้แล้ว, root page อ่าน branding/counts จาก Drug Store Postgres แทน `countries`, login/protected layout ใช้ legacy session cookie แล้ว, dashboard route อ่าน `getDashboard` จริง, stock route อ่าน `getLocationStock`/`getLocationItems` จริงและ submit `disposeItem` ได้ผ่าน form action, receive route submit `receiveItem` ได้ผ่าน form action, exchange route submit `exchangeItem` ได้ผ่าน form action และ settings route มี config/users/history filters/stock audit/master data ยาและสถานที่แล้ว; upload รูปยาใน UI, notification, export UI และ barcode/camera/export-today ใน receive ยังไม่ถูก migrate ครบ
- Legacy UI/API read-only smoke test ผ่านกับ Supabase Postgres แล้ว
- Write workflow smoke test ผ่านแล้วสำหรับ `receiveItem`, `exchangeItem`, `disposeItem`, `adjustItem` โดยใช้ `SMOKE-` lot, remote guard, captured ids cleanup และ post-check ว่าไม่เหลือ test rows
- Browser smoke test ของ UI เดิมผ่านแล้วเมื่อ point `window.TW_API_URL` ไป backend ใหม่; ตรวจ login/session, dashboard/imported data, locations, receive, exchange, settings และ console error สำคัญ
- ยังไม่ถือว่า production parity 100% จนกว่า negative/permission tests, export/history filters, settings write, notification worker และ SvelteKit cutover ผ่านครบ
- backend PostgreSQL local ยังไม่ส่ง Telegram/LINE จริง
- SvelteKit settings history filter มีปุ่ม `adjust` แล้ว แต่ legacy UI filter เดิมยังไม่มีปุ่ม `adjust` แยก
- สิทธิ์ `disposeItem` ใช้ permission `receive`; อาจต้องพิจารณาแยกเป็น `stock` หรือ `dispose`
- local backend static serve frontend จาก root เดียวกับ API เหมาะกับ dev แต่ production บน Vercel/Supabase ควรแยก config ให้ชัด
- Apps Script backend และ local backend มี contract ใกล้กัน แต่ implementation storage ต่างกัน: Google Sheets/Drive เทียบกับ PostgreSQL/Supabase Storage พร้อม local `uploads/` fallback
- default admin ใน schema คือ `admin/admin1234`; ไม่ควรใช้ใน production
- session local อายุ 8 ชั่วโมงและยังไม่มี cleanup job สำหรับ session หมดอายุ
- file upload production ใช้ Supabase Storage เมื่อมี service role env; local fallback ยังเก็บใน `uploads/` และเสิร์ฟ public path
