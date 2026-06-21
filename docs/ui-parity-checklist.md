# Drug Store UI Parity Checklist

เอกสารนี้ใช้เป็นรายการงานบังคับสำหรับการย้าย UI จาก legacy ไป SvelteKit

กติกา:

- legacy frontend (`index.html`, `css/app.css`, `js/*.js`) เป็น source of truth
- แต่ละหน้าให้ย้าย DOM, wording, spacing, color, font, interaction และ visual hierarchy จาก legacy ก่อน
- Svelte เปลี่ยนเฉพาะส่วนที่จำเป็นต่อ data binding, route, form action, conditional rendering, และ state flow
- ห้ามถือว่าหน้าใด parity แล้ว ถ้ายังใช้ DOM ใหม่ที่ตีความเองแทน legacy โดยไม่จำเป็น

สถานะ:

- `done` = parity ผ่านระดับโครงหน้าและ visual หลัก
- `partial` = ใช้งานได้ แต่ DOM/style ยัง drift จาก legacy
- `todo` = ยังไม่ได้ย้ายจริง

## A. Global Shell

| Area | Legacy source | Status | Notes |
| --- | --- | --- | --- |
| Login shell | `index.html`, `css/app.css`, `js/core.js` | `partial` | กลับมาใช้ DOM/class ตาม legacy มากขึ้นแล้ว; ยังต้อง fine-tune visual hierarchy และ shell spacing ต่อ |
| App header / topbar | `index.html`, `css/app.css`, `js/core.js` | `partial` | เปลี่ยนกลับมาใช้ DOM legacy แล้ว ต้องไล่ fine-tune สี/ฟอนต์/spacing ต่อ |
| Bottom nav / desktop side menu | `index.html`, `css/app.css`, `js/core.js` | `done` | sync `static/css/app.css` กับ legacy stylesheet แล้ว, desktop brand/user/logout block ทำงานจริง และ browser smoke ผ่านทั้ง desktop/mobile |
| Global loading / toast / sheet / dialog | `index.html`, `css/app.css`, `js/core.js` | `partial` | ดึง `toastHost`, `loadingOverlay` และ shared `sheet` host กลับมาใน Svelte layout แล้ว; ตอนนี้ `dashboard` low-stock ใช้ sheet กลางจริงแล้ว เหลือ dialog/flow อื่น |

## B. Main Navigation Views

| Page | Legacy source | Status | Notes |
| --- | --- | --- | --- |
| Dashboard / หน้าหลัก | `js/dashboard.js` | `partial` | ย้าย DOM/cards/search/list กลับมาใกล้ legacy แล้ว, live search auto-submit ผ่าน browser จริงแล้ว, แยกสถานที่กดต่อเข้า stock ได้ตรงแล้ว และ browser smoke ผ่าน flow หลักแล้ว; เหลือ spacing polish |
| Stock by location / ยาแต่ละจุด | `js/stock.js` | `done` | grid/detail ตาม legacy, dispose ใช้ shared sheet กลาง, submit state ใน sheet และปุ่มย้ายพาไป item เดิมตรงๆ แล้ว |
| Receive / รับเข้า | `js/receive.js` | `done` | flow เลือกยา -> ฟอร์ม -> รับเข้าล่าสุด, HID/camera scan, export วันนี้ และ redirect/toast หลังบันทึกกลับมาแล้ว |
| Exchange / แลกยา | `js/exchange.js` | `done` | search -> เลือกรายการ -> ฟอร์มย้าย -> recent พร้อม redirect/toast หลัง submit กลับมาแล้ว |
| Settings menu root | `js/settings.js` | `done` | ดึง root menu กลับมาใช้ menu-item/grouping/logout แบบ legacy แล้ว และซ่อนเมนูตามสิทธิ์จริงใน SvelteKit shell แล้ว |

## C. Settings Subviews

| Settings view | Legacy source | Status | Notes |
| --- | --- | --- | --- |
| Account / change password | `js/settings.js` | `partial` | card ข้อมูล read-only + form เปลี่ยนรหัสผ่านกลับมาใกล้ legacy แล้ว; ยังขาด validation/toast behavior แบบเดิม |
| General / hospital info | `js/settings.js` | `partial` | shell ของโลโก้ + ชื่อโรงพยาบาล + threshold กลับมาใกล้ legacy แล้ว; upload/delete logo flow ถูกดึงกลับมาแล้ว เหลือ polish feedback/preview interaction |
| Display settings | `js/settings.js` | `partial` | เปลี่ยนเป็น switch card 2 ใบตาม legacy แล้ว; ยังต้องเก็บ behavior revert/toggle state ให้เท่าเดิม |
| Users management | `js/settings.js` | `partial` | เปลี่ยนจาก inline CRUD เป็น list -> add/edit form ตาม legacy แล้ว; confirm delete และ return-to-list พร้อม toast ถูกดึงกลับมาแล้ว เหลือ polish validation/detail wording |
| Drugs management | `js/settings.js`, `js/manage.js` | `done` | flow list -> add/edit + image upload shell, confirm delete, HID/camera scan และ feedback หลัง upload/save/delete กลับมาแล้ว |
| Lot required list | `js/settings.js`, `js/manage.js` | `partial` | กลับมาเป็น subtitle + auto-save switch list เรียงตามชื่อใกล้ legacy แล้ว; failure rollback และ toast message แบบเปิด/ปิด Lot บังคับถูกดึงกลับมาแล้ว |
| Locations management | `js/settings.js`, `js/manage.js` | `partial` | กลับมาเป็น add bar + location card list + edit shell แยกจาก list แล้ว; confirm delete และ auto-save ในหน้า edit ถูกดึงกลับมาแล้ว เหลือ interaction รายการย่อยให้เท่า legacy |
| Notification settings | `js/settings.js` | `done` | แยก field ตาม channel, save/test redirect/toast กลับมาแล้ว และมี production endpoint สำหรับ cron/worker แล้ว |
| Export data | `js/export.js`, `js/settings.js` | `done` | export shell มี preset วันนี้/เดือนนี้, preview table และ download CSV ผ่าน SvelteKit แล้ว |
| History | `js/settings.js` | `partial` | กลับมาเป็นรายการประวัติแบบมี icon/type/route/lot/time ใกล้ legacy แล้ว และโหลด 80 รายการตามเดิม; filter chip และ feedback shell ยังต้องเก็บต่อ |
| Stock audit | `js/settings.js` | `partial` | กลับมาเป็นเลือกสถานที่แล้วโหลดทันที + save inline ใกล้ legacy แล้ว; state รายแถวหลังบันทึกยังไม่เท่าเดิม |
| Print report | `js/settings.js` | `partial` | กลับมาเป็น select + ปุ่มพิมพ์ตาม legacy แล้ว; pre-print feedback และ shell รายงานยังเก็บต่อได้อีก |
| Manual | ไม่มีใน legacy ตรง ๆ | `todo` | เป็นหน้าช่วย migration; อย่าปล่อยให้แย่ง priority จาก legacy views |
| Settings menu overview | ไม่มีใน legacy ตรง ๆ | `partial` | ใช้ tab navigation เฉพาะตอนอยู่ subview เพื่อประคอง migration; root menu ใช้ legacy เป็นหลักแล้ว |

## D. Print / Export / Utility Views

| View | Legacy source | Status | Notes |
| --- | --- | --- | --- |
| Receive export today | `js/export.js`, receive flow | `done` | มี shortcut ส่งออกวันนี้จากหน้า receive แล้ว |
| Settings export screens | `js/export.js`, `js/settings.js` | `partial` | shell และ wording ยังต้องเก็บให้ตรง |
| Print report near expiry | `js/settings.js` | `partial` | print template ถูกจูน heading/table/subtitle ใกล้ legacy แล้ว; ยังไม่เก็บ pre-print toast ตอนไม่มีข้อมูล |
| Print report stock | `js/settings.js` | `partial` | print template ถูกจูน heading/table/subtitle ใกล้ legacy แล้ว; ยังไม่เก็บ pre-print toast ตอนไม่มีข้อมูล |

## Execution Order

1. Global shell: login, topbar, side menu, bottom nav
2. Dashboard
3. Stock
4. Receive
5. Exchange
6. Settings subviews ตามลำดับที่กระทบงานประจำมากที่สุด: general, locations, drugs, users, notify, history, audit, export, report

## Current UI Task List

รายการนี้ใช้เป็น task ย่อยสำหรับรอบถัดไป โดยอิงจาก status ปัจจุบันของแต่ละหน้า

- [~] Global shell: toast, dialog, sheet, loading
- [~] Global shell: fine-tune login และ topbar
- [~] Dashboard: shell interaction และ visual spacing
- [x] Stock: dispose sheet / global interaction
- [x] Receive: camera/HID interaction และ state หลังบันทึก
- [x] Exchange: state หลัง submit และ shell interaction
- [x] General: logo upload/delete flow
- [x] Display: toggle feedback/revert behavior
- [x] Users: save/delete feedback flow
- [x] Drugs: camera/HID scan + feedback หลัง upload/save/delete
- [x] Lot: toast/feedback หลัง auto-save
- [x] Locations: auto-save name/icon/color
- [x] Notify: save/test feedback + production notification path
- [x] Export: shell/format parity
- [x] History: filter chip + feedback shell
- [x] Audit: state รายแถวหลัง save
- [x] Report: pre-print feedback + report shell

## Latest Smoke Pass

- [x] login -> dashboard shell
- [x] dashboard by-location -> stock
- [x] stock dispose sheet open state
- [x] stock move link -> exchange พร้อม preselect item เดิม
- [x] receive form render หลัง login จริง
- [x] settings export shell
- [x] settings notify shell + production note
- [x] mobile smoke: dashboard / stock / receive / settings
- [x] settings write smoke: saveConfig / saveDisplay / saveNotification / exportData / changePassword
- [x] permission smoke: pharmacist / staff route access และ menu visibility พร้อม cleanup temp users
- [x] dashboard search auto-update ผ่าน browser จริง
- [x] report endpoint smoke: `near` / `stock`
- [x] export backend smoke: `stock` / `all` / `receive`

## Definition Of Done For Each Page

หน้าใดจะเปลี่ยนเป็น `done` ได้ ต่อเมื่อ:

- DOM structure ใกล้หรือเท่ากับ legacy ในส่วนหลักของหน้า
- สี ฟอนต์ spacing radius และ interaction state มาจาก legacy เป็นหลัก
- wording สำคัญตรงกับ legacy
- route/action ใหม่ทำงานแทน API เดิมได้ โดยไม่เปลี่ยนประสบการณ์ใช้งานหลัก
- ไม่มี CSS ใหม่ที่ไป override legacy style โดยไม่จำเป็น
