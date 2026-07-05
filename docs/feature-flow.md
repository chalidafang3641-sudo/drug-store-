# The Watcher Feature And Flow Summary

เอกสารนี้สรุป feature และ workflow ที่มีอยู่ในระบบตอนนี้ เพื่อใช้อ่านภาพรวมเร็วกว่า `req.md`

แหล่งอ้างอิงหลัก:

- `req.md` สำหรับ requirement, validation, business rules และ API contract แบบละเอียด
- `README.md` สำหรับสถานะ migration และวิธีรันระบบ
- `docs/ui-parity-checklist.md` สำหรับสถานะ UI parity รายหน้า

## สถานะระบบปัจจุบัน

ระบบมีทั้ง legacy static app และ SvelteKit migration app โดย backend ใหม่รองรับ action-based API contract เดิมแล้ว

- Legacy frontend: `index.html`, `css/app.css`, `js/*.js`
- Legacy backend: `Code.gs` บน Google Apps Script
- Backend ใหม่: `server/index.js` + PostgreSQL/Supabase
- SvelteKit app: `src/routes/*`
- API compatibility route: `POST /api`
- Database: Supabase/PostgreSQL schema ใน `db/schema.sql` และ `supabase/migrations/*`
- Storage: รองรับ bucket `branding` และ `drug-images` เมื่อมี Supabase service role

Workflow หลักที่ผ่าน smoke/parity ระดับใช้งานแล้ว:

- login/session
- dashboard/read-only data
- receive stock
- exchange/move stock
- dispose stock
- adjust stock
- settings หลัก
- users/master data
- export/report
- notification config และ notification run endpoint

จุดที่ยังต้อง polish เพิ่ม:

- UI parity ของ login/topbar/dashboard spacing
- validation/toast/dialog บางจุดใน settings subviews
- QA เชิงลึก permission และ edge cases ก่อน production cutover
- ตั้งค่า production cron/worker secret และ token แจ้งเตือนจริง

## บทบาทและสิทธิ์

| Role | สิทธิ์หลัก | ใช้งานได้ |
| --- | --- | --- |
| `admin` | `*` | ทุกเมนู, config, users, notification, master data, audit |
| `pharmacist` | `stock`, `drug`, `exchange`, `receive`, `view` | ดูข้อมูล, รับเข้า, ย้ายยา, จัดการยา/สถานที่, ตรวจนับ |
| `staff` | `receive`, `view` | ดูข้อมูลและรับเข้า |

ทุก API ที่ไม่ใช่ `ping`, `branding`, `login`, `logout` ต้องมี session token และถ้า token หมดอายุต้องตอบ `code: "AUTH"`

## Flow 1: Login และ Session

1. โหลด branding จาก public API
2. ผู้ใช้กรอก username/password
3. backend ตรวจรหัสผ่านและสร้าง session
4. legacy app เก็บ token ใน `localStorage`; SvelteKit ใช้ cookie `tw_token`
5. route ที่ต้อง login ตรวจ session ก่อนโหลดข้อมูล
6. logout ลบ session/token แล้วกลับหน้า login

Feature ที่เกี่ยวข้อง:

- login/logout
- role-based menu visibility
- protected route/action
- change password

## Flow 2: Dashboard

1. โหลด dashboard ผ่าน `getDashboard`
2. แสดงสรุปวันหมดอายุ: critical/high/medium/over threshold และ expired
3. แสดงรายการยาใกล้หมดอายุ เรียงจากใกล้หมดอายุมากสุด
4. แสดง low stock banner จาก `min_qty`
5. แสดงสรุปแยกตามสถานที่
6. ค้นหา active stock ผ่าน `searchItems`
7. กดสถานที่ต่อไปหน้า stock ของสถานที่นั้นได้

ข้อมูลที่แสดง:

- ชื่อยา
- รูปยา
- สถานที่
- Lot No.
- วันหมดอายุ
- จำนวน
- จำนวนวันที่เหลือ
- สถานะสีตาม bucket

## Flow 3: รับเข้า

1. โหลดรายการยา (`getDrugs`) และสถานที่ (`getLocations`)
2. ตั้งสถานที่เริ่มต้นจาก default receive location
3. เลือกยาได้จากรายการ, ค้นหา, barcode HID หรือกล้อง
4. กรอก Lot, expiry date, qty และ location
5. submit ด้วย `receiveItem`
6. backend รวม item เดิมถ้า drug/location/lot/expiry ตรงกัน
7. backend สร้าง transaction type `receive`
8. แสดงรายการรับเข้าล่าสุด
9. ส่งออกข้อมูลรับเข้าวันนี้ได้

Validation หลัก:

- ต้องเลือกยา
- ต้องเลือกสถานที่
- ต้องมีวันหมดอายุ
- จำนวนต้องมากกว่า 0
- ถ้ายา require lot ต้องกรอก Lot No.

## Flow 4: Stock By Location

1. โหลด summary ด้วย `getLocationStock`
2. แสดงการ์ดรวมทุกสถานที่และการ์ดแยกสถานที่
3. เมื่อเลือกสถานที่ โหลดรายการด้วย `getLocationItems`
4. รายการเรียงตามวันหมดอายุ
5. แต่ละ item มี action ไปย้ายยา หรือเปิด sheet ตัดจ่าย

Feature ที่เกี่ยวข้อง:

- ดู stock รวมทุกสถานที่
- ดู stock แยกสถานที่
- ดู count และ total qty
- เปิด dispose sheet
- preselect item เพื่อส่งต่อไป exchange

## Flow 5: ย้ายยา / แลกยา

1. ค้นหา active item ผ่าน `searchItems`
2. เลือก item ที่ต้องการย้าย
3. เลือกสถานที่ปลายทาง
4. ระบุจำนวน
5. submit ด้วย `exchangeItem`
6. backend ลดจำนวน item ต้นทาง
7. backend รวมเข้าปลายทางถ้ามี item ตรง drug/lot/expiry อยู่แล้ว
8. backend สร้าง transaction type `exchange`
9. แสดงประวัติย้ายล่าสุด

Validation หลัก:

- ต้องเลือก item
- ต้องเลือกปลายทาง
- ปลายทางต้องไม่ใช่สถานที่เดิม
- จำนวนต้องมากกว่า 0
- จำนวนต้องไม่เกิน stock ต้นทาง

## Flow 6: ตัดจ่าย / ทิ้งยา

1. เปิดจากหน้า stock item
2. เลือกเหตุผล เช่น เบิกใช้, หมดอายุ, ชำรุด, เสียหาย, อื่นๆ
3. ระบุจำนวนและ note ได้
4. submit ด้วย `disposeItem`
5. backend ลดจำนวน item
6. ถ้าคงเหลือ 0 จะปิด item เป็น `used` หรือ `disposed`
7. backend สร้าง transaction type `dispose`

Validation หลัก:

- ต้องเลือก item
- จำนวนต้องมากกว่า 0
- จำนวนต้องไม่เกินจำนวนที่มี

## Flow 7: ตรวจนับและปรับยอด

1. เข้า settings > stock audit
2. เลือกสถานที่
3. ระบบโหลด active item ในสถานที่นั้น
4. กรอกจำนวนจริงที่นับได้
5. submit ด้วย `adjustItem`
6. backend ปรับ qty และ status
7. backend สร้าง transaction type `adjust`

Business rule:

- ถ้าจำนวนจริงเท่ากับในระบบ ให้ตอบว่าไม่มีการเปลี่ยนแปลง
- ถ้าจำนวนจริงเป็น 0 ให้ item เป็น `disposed`
- ถ้าจำนวนจริงมากกว่า 0 ให้ item เป็น `active`

## Flow 8: Master Data

### สถานที่เก็บยา

Feature:

- เพิ่ม/แก้ไข/ลบแบบ soft delete
- ตั้ง icon และสี
- ตั้ง default receive location
- จัดลำดับ
- auto-save บาง field ใน SvelteKit settings

### รายการยา

Feature:

- เพิ่ม/แก้ไข/ลบแบบ soft delete
- ตั้ง barcode/code
- ตั้ง unit
- ตั้ง default location
- เปิด/ปิด require lot
- ตั้ง min qty สำหรับ low stock
- upload รูปยา
- HID/camera scan สำหรับ barcode ในหน้า add/edit

## Flow 9: Settings และ Admin

Settings ที่มีตอนนี้:

- account/change password
- hospital config
- logo upload/remove
- display settings: dark mode และปี พ.ศ.
- users management
- locations management
- drugs management
- Lot required list
- notification settings
- export data
- history
- stock audit
- print report

เมนู settings ถูกซ่อน/เปิดตาม permission ของ user

## Flow 10: ประวัติการเคลื่อนไหว

1. โหลด transaction ด้วย `getHistory`
2. default limit ฝั่ง UI คือ 80 รายการ
3. filter ได้ตาม type หลัก
4. แสดงยา, type, route จาก/ไป, Lot, จำนวน, เหตุผล, เวลา และผู้ทำรายการ

Transaction type:

- `receive`
- `exchange`
- `dispose`
- `adjust`

## Flow 11: Export และ Print Report

Export:

- รับเข้าในช่วงวันที่
- movement ทั้งหมดในช่วงวันที่
- stock คงเหลือปัจจุบัน
- receive today shortcut จากหน้า receive
- settings export มี preset วันนี้/เดือนนี้

Print report:

- near expiry report
- stock report
- A4/browser print friendly
- ใช้ชื่อโรงพยาบาลในหัวรายงาน
- รองรับ save as PDF ผ่าน browser print

## Flow 12: Notification

Config:

- เปิด/ปิด notification
- channel: Telegram หรือ LINE
- notify time
- Telegram bot token/chat id
- LINE channel access token

Feature:

- admin ตั้งค่า notification ได้
- token ที่ตั้งแล้วไม่ควรถูกส่งออกเป็น plain text ใน config response
- test notification ผ่าน API
- production run endpoint: `/api/notifications/run`
- endpoint ป้องกันด้วย `NOTIFY_RUN_SECRET` หรือ `CRON_SECRET`
- dispatch สรุป near-expiry และ low-stock

สิ่งที่ต้องตั้งค่าก่อนใช้งานจริง:

- token/channel id จริง
- environment secret สำหรับ cron
- cron schedule บน Vercel หรือ worker ที่เรียก endpoint

## Flow 13: Scanner และ Mobile

รองรับ:

- HID scanner แบบ keyboard wedge
- กล้องมือถือผ่าน `html5-qrcode`
- camera ใช้ `facingMode: environment`
- PWA manifest/service worker
- mobile bottom navigation
- desktop sidebar

หน้าที่เกี่ยวข้อง:

- receive: scan เพื่อเลือกยา
- settings/drugs: scan เพื่อใส่ barcode

## API Contract หลัก

ทุกคำสั่งใช้รูปแบบ action-based API:

```json
{
  "action": "getDashboard",
  "token": "...",
  "field": "payload เฉพาะ action"
}
```

ตัวอย่าง action หลัก:

- `branding`
- `login`
- `logout`
- `me`
- `getDashboard`
- `searchItems`
- `getLocations`
- `saveLocation`
- `getDrugs`
- `saveDrug`
- `receiveItem`
- `exchangeItem`
- `disposeItem`
- `adjustItem`
- `getHistory`
- `exportData`
- `getUsers`
- `saveUser`
- `getNotifyConfig`
- `saveNotifyConfig`
- `testNotification`

รายละเอียด action ทั้งหมดอยู่ใน `req.md`

## เอกสารที่ควรอ่านต่อ

- `req.md`: รายละเอียด requirement และ business rules
- `docs/migration-plan.md`: แผน migration และสถานะ technical
- `docs/ui-parity-checklist.md`: สถานะ UI parity รายหน้า
- `docs/design.md`: กติกา legacy-first UI
