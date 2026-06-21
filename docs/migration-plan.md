# Drug Store Migration Plan

เป้าหมายคือย้ายโปรเจกต์จาก static frontend + Google Apps Script + Google Sheets ไปเป็นระบบ production-ready ที่ดูแลง่ายขึ้น

Target stack:

- Frontend: SvelteKit
- Hosting: Vercel
- Backend: SvelteKit API routes/server actions
- Database: Supabase Postgres
- Storage: Supabase Storage
- Notifications: Vercel Cron หรือ Supabase Edge Functions

## UI Migration Rule

ในการย้าย frontend ไป SvelteKit ให้ถือว่า legacy frontend เป็น source of truth ด้าน UI

- ใช้ style และ design จาก `index.html`, `css/app.css`, `js/*.js` ของระบบเดิมก่อน
- พยายามคง DOM structure, id, class และ visual hierarchy ของ legacy ให้มากที่สุด
- SvelteKit มีหน้าที่หลักคือแทนที่ data flow, session flow, route flow และ form submission เท่านั้น
- หลีกเลี่ยงการ redesign หรือ simplify DOM ระหว่างทาง เพราะทำให้ parity ของ menu, topbar, spacing, colors และ fonts drift จากของเดิม
- ถ้าต้องเพิ่ม CSS ใหม่ ให้เพิ่มเฉพาะส่วนที่จำเป็นต่อ Svelte integration และไม่ไป override legacy style โดยไม่จำเป็น

Checklist งาน UI parity อยู่ที่ `docs/ui-parity-checklist.md` และต้องใช้เป็นลำดับงานหลักของ frontend ก่อนงาน polish หรือ redesign ใด ๆ

## Current State

- Frontend ปัจจุบันเป็น `index.html` + vanilla JavaScript แยกไฟล์ใน `js/`
- Backend เดิมอยู่ใน `Code.gs` และใช้ Google Sheets เป็น database
- มี Node/Express local API draft ใน `server/index.js`
- มี PostgreSQL schema baseline ใน `db/schema.sql` ที่ปรับ indexing สำหรับ Supabase/Postgres แล้ว
- มี Supabase migrations แล้ว:
  - `supabase/migrations/20260619165255_init_drug_store_schema.sql`
  - `supabase/migrations/20260619170347_improve_database_design.sql`
- Apply schema ขึ้น Supabase project `qvbqoxfuqzzffryqkuva` แล้ว
- มี legacy export script ใน `scripts/export-old-api.mjs`
- มี legacy asset download script ใน `scripts/download-legacy-assets.mjs`
- มี Supabase Storage setup/upload script ใน `scripts/setup-supabase-storage.mjs`
- มี write workflow smoke script ใน `scripts/smoke-write-workflows.mjs`
- มี browser smoke script สำหรับ UI เดิมใน `scripts/smoke-legacy-ui.mjs`
- ดึง legacy snapshot ล่าสุดสำเร็จแล้วและเก็บใน `legacy-exports/` ซึ่งถูก `.gitignore`
- ดึง legacy logo จาก Google Drive มาเก็บใน `uploads/legacy-assets/` แล้ว ซึ่งถูก `.gitignore`
- มี requirement document ที่แกะจาก frontend/backend แล้วใน `req.md`
- มี SvelteKit scaffold ที่ build ได้แล้ว พร้อม adapter Vercel runtime `nodejs22.x`
- มี SvelteKit `POST /api` compatibility route ที่ reuse action handler เดิมจาก `server/index.js`
- เริ่มแยก shared backend logic ออกจาก `server/index.js` แล้วเป็น `src/lib/server/api-runtime.js`, `api-auth.js`, `api-config.js`, `api-helpers.js`
- SvelteKit root page เปลี่ยนเป็น redirect เข้าสู่ `/login` หรือ `/dashboard` ตาม session แล้ว
- มี SvelteKit login/protected layout ระยะสั้นผ่าน legacy `app_users` + `sessions` และ httpOnly cookie `tw_token`
- SvelteKit app shell ดึง bottom navigation แบบมี icon/FAB กลับมาใกล้เคียง UI เดิมแล้ว
- กติกาปัจจุบันของงาน UI คือให้ดึง style/design จาก legacy ให้หมด และปรับ DOM เท่าที่จำเป็นเพื่อให้ทำงานกับ SvelteKit เท่านั้น
- มี checklist กลางสำหรับไล่ parity ตามหน้าของ legacy แล้วใน `docs/ui-parity-checklist.md`
- หน้า `/login` ถูกดึงกลับมาใช้ DOM/class ตาม legacy มากขึ้นแล้ว; functional flow ใช้ได้และ visual drift ลดลง แต่ branding hierarchy/spacing ยังต้อง fine-tune ต่อ
- SvelteKit `/dashboard` อ่านข้อมูล `getDashboard` จริงจาก Postgres แล้ว
- SvelteKit `/stock` อ่าน `getLocationStock`/`getLocationItems` และ submit `disposeItem` จริงจาก Postgres แล้ว
- SvelteKit shared shell มี `toast`, `loading` และ `sheet` กลางแล้ว โดย `dashboard` low-stock และ `stock dispose` ถูกย้ายมาใช้ shared sheet แล้ว และ desktop sidebar มี brand/user/logout block กลับมาแล้ว
- SvelteKit `/receive` โหลด `getDrugs`, `getLocations`, `recentReceives`, ค้น/ยิง barcode ผ่าน `findDrugByCode`, รองรับ HID/camera scan ฝั่ง browser, export รับเข้าวันนี้ และ submit `receiveItem` ด้วย form action แล้ว
- SvelteKit `/exchange` ค้นหา active stock ผ่าน `searchItems`, โหลด `recentExchanges` และ submit `exchangeItem` ด้วย form action แล้ว
- SvelteKit `/settings` มีหน้าเมนู overview แบบระบบเดิมกลับมาแล้ว พร้อม account/change password, manual, display, config, users, history filters, stock audit, master data ยา/สถานที่, lot required, upload รูปยา, export CSV, notification config และ print report route แล้ว
- settings subviews ที่ขยับกลับมาใกล้ legacy เพิ่มแล้ว: `account`, `general`, `display`, `users`, `locations`, `drugs`, `lot`, `history`, `notify`, `audit`, `report` โดย `users`, `locations` และ `drugs` กลับมาเป็น flow list -> detail/add/edit ใกล้ของเดิมแล้ว, `general` ดึง upload/delete logo กลับมาแล้ว, `users` ดึง confirm delete + return-to-list feedback กลับมาแล้ว, `drugs`/`locations` ดึง confirm delete กลับมาแล้ว, `locations` มี auto-save ในหน้า edit แล้ว, `drugs` มี HID/camera barcode scan แล้ว และ `lot` มี rollback พร้อม feedback แบบเปิด/ปิด Lot บังคับเมื่อ auto-save
- SvelteKit มี permission helper กลางและบังคับสิทธิ์ที่ชั้น route/action แล้วสำหรับ `dashboard`, `stock`, `receive`, `exchange`, `settings`, `settings/export`, `settings/report`
- API pattern ปัจจุบันเป็น action-based:

```js
api('getDrugs')
api('receiveItem', params)
api('getDashboard')
```

ให้คง contract นี้ไว้ระหว่าง migration เพื่อลดความเสี่ยงจากการแก้ frontend ทั้งระบบพร้อมกัน

## Latest Legacy Snapshot

Snapshot ล่าสุดถูกดึงจาก Google Apps Script API เดิมเมื่อ `2026-06-19T16:31:27.577Z`

ไฟล์ local:

```text
legacy-exports/legacy-snapshot-latest.json
legacy-exports/legacy-snapshot-summary.json
```

`legacy-exports/` เป็นข้อมูลจริงและถูก ignore ไม่ให้ commit

สรุปข้อมูล:

| Dataset | Count |
| --- | ---: |
| config | 1 |
| locations | 12 |
| drugs | 16 |
| active stock items | 26 |
| transactions | 54 |
| users | 2 |
| dashboard near-expiry rows | 4 |
| dashboard total qty | 26 |

รัน export ซ้ำได้ด้วย:

```bash
OLD_ADMIN_USER=admin OLD_ADMIN_PASSWORD=... npm run legacy:export
```

## Latest Legacy Assets

ดึง asset จาก field รูป/โลโก้ใน legacy snapshot ด้วย:

```bash
npm run legacy:assets
```

ผลลัพธ์ล่าสุด:

| Asset group | Downloaded | หมายเหตุ |
| --- | ---: | --- |
| branding logo | 1 | พบจาก `config.logo_file_id` |
| drug images | 0 | snapshot ล่าสุดไม่พบรูปยาใน `drugs` |
| item images | 0 | snapshot ล่าสุดไม่พบรูปใน `active_items` |

ไฟล์ local:

```text
uploads/legacy-assets/manifest.json
uploads/legacy-assets/branding/branding_1dVzYk8_DZ-z7FoD02KPX0GmI8W22eWvF.jpg
```

`uploads/legacy-assets/` เป็น asset จริงและถูก ignore ไม่ให้ commit

## Supabase Remote Status

Project ref: `qvbqoxfuqzzffryqkuva`

สถานะล่าสุด:

- [x] Apply initial schema migration แล้ว
- [x] Apply improved database design migration แล้ว
- [x] Verify tables หลักแล้ว: `app_config`, `locations`, `drugs`, `items`, `transactions`, `app_users`, `sessions`, `errors`, `roles`, `profiles`, `legacy_id_map`, `audit_logs`
- [x] Seed role baseline แล้ว: `admin`, `pharmacist`, `staff`
- [x] เปิด RLS ทุกตาราง public แล้ว
- [x] Import legacy snapshot เข้า Supabase แล้ว
- [x] Reconcile legacy import ผ่าน: active locations 12, active drugs 16, active items 26, total qty 26, transactions 54, near-expiry 4
- [x] เพิ่ม placeholder สำหรับประวัติที่อ้างข้อมูลเก่าที่ไม่อยู่ใน active snapshot: inactive drugs 8, closed items 10, transaction FK null 0
- [x] สร้าง Supabase Storage buckets `branding` และ `drug-images`
- [x] Upload legacy logo เข้า bucket `branding` แล้ว และ update `app_config.logo_file_id` เป็น public Storage URL
- [ ] เพิ่ม RLS policies ตาม role หรือเลือก server-only access ด้วย service role

## Phase 0: Foundation

- [x] ยืนยัน stack เป้าหมาย: `SvelteKit + Vercel + Supabase`
- [ ] สร้าง branch สำหรับ migration เช่น `codex/sveltekit-migration`
- [x] สรุป feature เดิมที่ต้อง preserve ใน `req.md`
- [x] แกะ API contract, data model, validation และ business rules จาก frontend/backend ใน `req.md`
- [ ] แยกงาน implementation เป็น batch ขนาดเล็ก ตรวจง่าย และ rollback ได้

Feature เดิมที่ต้อง preserve:

- [x] Login/logout/session
- [x] Dashboard สรุปยาใกล้หมดอายุและ stock ต่ำ
- [x] รับยาเข้า stock
- [x] ดู stock ตามสถานที่
- [x] ย้าย/แลกยาระหว่างสถานที่
- [x] ตัดจ่าย/ทิ้งยา
- [x] ตรวจนับและปรับยอด
- [x] ตั้งค่าโรงพยาบาล โลโก้ และช่วงแจ้งเตือน
- [x] จัดการสถานที่เก็บยา
- [x] จัดการรายการยา รูปยา barcode และ Lot required
- [x] จัดการผู้ใช้และ role
- [x] ประวัติการเคลื่อนไหว
- [x] Export Excel / print report
- [x] Telegram/LINE notification
- [x] PWA/mobile-friendly behavior

หมายเหตุ: เครื่องหมาย checked ในส่วนนี้หมายถึง "ถอด requirement แล้ว" ไม่ได้หมายถึง migrate implementation เสร็จแล้ว

## Phase 1: Scaffold SvelteKit

- [x] สร้าง SvelteKit project structure
- [x] ติดตั้ง TypeScript/Svelte check/build scripts
- [x] ย้าย static assets: `icons/`, `manifest.json`, `sw.js`
- [x] ตัดสินใจว่าจะใช้ `css/app.css` เดิมชั่วคราวระหว่าง migration
- [x] สร้าง app shell ผ่าน `src/app.html`
- [x] สร้าง protected layout สำหรับหน้าในระบบ
- [x] สร้าง bottom navigation
- [x] สร้าง placeholder routes หลัก

Routes หลัก:

```text
/login
/dashboard
/receive
/stock
/exchange
/settings
```

## Phase 2: API Compatibility Layer

- [x] สร้าง endpoint `POST /api`
- [ ] คง action contract เดิมไว้:

```json
{
  "action": "getDashboard",
  "token": "...",
  "params": "..."
}
```

- [~] ย้าย logic จาก `server/index.js` เข้า server modules บางส่วนแล้ว (`api-runtime`, `api-auth`, `api-config`, `api-helpers`) แต่ business handlers ยังอยู่รวมในไฟล์หลักจำนวนมาก
- [x] แยก action handler จาก `server/index.js` ให้ SvelteKit route reuse ได้ชั่วคราว
- [ ] แยก server modules:

```text
src/lib/server/db.ts
src/lib/server/auth.ts
src/lib/server/actions/
src/routes/api/+server.ts
```

- [x] ทำ error response ให้เข้ากับ frontend เดิมใน compatibility route
- [x] ทำ auth expired response ให้ยังใช้ `code: "AUTH"` ได้ผ่าน action handler เดิม

## Phase 3: Supabase/Postgres

- [x] ปรับ `db/schema.sql` ให้เป็น Supabase/Postgres baseline พร้อม indexing ตาม query path หลัก
- [x] แปลง `db/schema.sql` เป็น Supabase migration
- [x] เพิ่ม Supabase migrations
- [x] Apply migrations ไปยัง Supabase remote
- [x] ตั้ง public Supabase env สำหรับ frontend/client helper:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

- [x] ตั้ง server env ที่จำเป็นสำหรับ local import/storage/smoke ใน `.env.local` แล้ว:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

- [x] ออกแบบและสร้าง Supabase Storage buckets:

```text
branding
drug-images
```

- [x] เปิด RLS baseline ทุกตาราง public
- [ ] วาง RLS/Auth strategy ราย action/role
- [ ] ทำ reconciliation queries สำหรับ stock และ transactions

Indexing baseline ที่ใส่แล้ว:

- internal primary key ใช้ `BIGINT GENERATED ALWAYS AS IDENTITY`
- public/API id ใช้ `code_id` แยกจาก internal id ทุก entity หลัก
- เพิ่ม `roles` และ `profiles` สำหรับ Supabase Auth ระยะยาว โดยยังคง `app_users` เป็น legacy/local auth ชั่วคราว
- เพิ่ม `legacy_id_map` สำหรับ import จาก Google Apps Script/Sheets แบบ idempotent
- เพิ่ม `audit_logs` สำหรับบันทึกการเปลี่ยน master/config
- เพิ่ม lifecycle fields ใน `items`: `closed_at`, `closed_reason`, `last_transaction_id`
- `pg_trgm` สำหรับค้นหาชื่อยา ชื่อสถานที่ และ Lot ด้วย `LIKE '%...%'`
- partial indexes บน `items` สำหรับ stock active ที่ `status = 'active' AND qty > 0`
- covering indexes สำหรับ dashboard, stock-by-location, low-stock และ export
- FK indexes สำหรับ `transactions` location/user/session paths
- unique partial index ให้มี default receive location ได้เพียง 1 จุด
- lower-case unique index สำหรับ username เพื่อกันชื่อซ้ำต่างตัวพิมพ์
- เปิด RLS ทุกตาราง public เพื่อเตรียมใช้บน Supabase

## Phase 4: Auth

- [x] ทำ login/logout/session ใน SvelteKit
- [x] ระยะสั้นใช้ `app_users` เดิมแบบ hashed password
- [x] ตั้ง httpOnly cookie สำหรับ token (`secure` เมื่อ production)
- [x] ทำ `hooks.server.js` สำหรับโหลด user/session
- [x] ทำ protected routes สำหรับ `/dashboard`
- [ ] ตรวจ permission ตาม role
- [ ] ระยะยาวย้ายไป Supabase Auth + RLS

## Phase 5: UI Migration

ย้ายทีละหน้าโดย preserve behavior เดิมก่อน redesign

- [x] Login
- [x] Dashboard
- [x] Receive
- [x] Stock by location
- [x] Exchange/move
- [~] Settings basic
- [ ] Drug/location management
- [~] Users
- [~] History
- [x] Export/report
- [x] Notifications

หมายเหตุสถานะล่าสุดของ Phase 5:

- `settings` root menu กลับมาใช้ DOM/wording แบบ legacy แล้ว
- `account`, `general`, `display` และ `users` ถูกดึงกลับมาใกล้ legacy แล้ว
- `users` เปลี่ยนจาก inline CRUD เป็น flow `list -> add/edit form` แบบ legacy แล้ว
- ส่วนที่ยังต้องเก็บต่อใน settings เหลือหลักๆ เป็น visual polish ของ shell และงานนอก settings มากกว่า interaction หลักของแต่ละแท็บ

## Phase 6: Legacy Data Migration

- [x] ทำ script ดึงข้อมูลจาก Google Apps Script API เดิม
- [x] ดึง legacy snapshot จาก API เดิมมาเก็บใน `legacy-exports/`
- [x] ทำ script ดึงรูป/โลโก้จาก legacy snapshot มาเก็บใน `uploads/legacy-assets/`
- [x] ดาวน์โหลด legacy logo ลง local asset folder แล้ว
- [x] ทำ import script จาก `legacy-exports/legacy-snapshot-latest.json` เข้า Postgres/Supabase
- [x] ดึงและ upsert ข้อมูล:

```text
config
locations
drugs
items
transactions
```

- [x] เก็บ source id เดิมเท่าที่ API ส่งมาใน `code_id` และ `legacy_id_map`
- [x] ทำ dry run mode สำหรับ import
- [x] ทำ idempotent upsert เพื่อให้ import ซ้ำแล้วข้อมูลไม่ซ้ำ
- [x] ตัดสินใจเรื่อง users: ไม่ย้าย plaintext password, ใช้ admin seed และให้สร้าง/reset password ใหม่หรือใช้ Supabase Auth ภายหลัง
- [x] ทำ transaction placeholders สำหรับประวัติเก่าที่อ้าง drug/item ที่ไม่มีใน active snapshot
- [x] ตัดสินใจเรื่องรูปยา/โลโก้: download จาก Google Drive มาเก็บ local ignored ก่อน
- [x] Upload legacy assets เข้า Supabase Storage หลังสร้าง buckets และมี service role key
- [x] Update `app_config.logo_file_id` เป็น public Storage URL หลัง upload เข้า Supabase Storage
- [x] ทำ reconciliation หลัง import:
  - จำนวน locations
  - จำนวน active drugs
  - จำนวน active stock items
  - stock quantity รวม
  - transaction count
  - near-expiry count
  - placeholder counts
  - transaction FK null checks

Import/reconcile commands:

```bash
npm run legacy:import:dry-run
npm run legacy:import
npm run legacy:reconcile
```

ผลล่าสุดบน Supabase project `qvbqoxfuqzzffryqkuva`:

| Check | Expected | Actual |
| --- | ---: | ---: |
| active locations | 12 | 12 |
| active drugs | 16 | 16 |
| active items | 26 | 26 |
| total qty | 26 | 26 |
| transactions | 54 | 54 |
| dashboard near-expiry | 4 | 4 |
| placeholder drugs | 8 | 8 |
| placeholder items | 10 | 10 |
| transaction null drug refs | 0 | 0 |
| transaction null item refs | 0 | 0 |

## Phase 6.5: Legacy UI/API Smoke Test

เป้าหมายของ phase นี้คือพิสูจน์ว่า UI เดิมสามารถคุยกับ backend ใหม่ที่ใช้ Supabase Postgres ได้โดยคง action API contract เดิมไว้ก่อน

สถานะ function parity:

- [x] Read-only API หลักทำงานกับ Supabase data แล้ว
- [x] Legacy data ถูก import/reconcile แล้ว
- [x] Write workflow ผ่าน smoke test พร้อม cleanup test rows
- [x] Browser smoke test ของ UI เดิมผ่านกับ backend ใหม่
- [ ] ยังไม่ claim production parity 100% จนกว่า QA เชิงลึก, permission, export, notification และ SvelteKit cutover ผ่านครบ

- [x] รัน Node/Express API เดิมกับ Supabase Postgres remote
- [x] Smoke test `branding`
- [x] Smoke test `login` ด้วย admin seed
- [x] Smoke test `me`
- [x] Smoke test `getLocations`
- [x] Smoke test `getDrugs`
- [x] Smoke test `getDashboard`
- [x] Smoke test `getLocationStock`
- [x] Smoke test `getLocationItems`
- [x] Smoke test `searchItems`
- [x] Smoke test `recentReceives`
- [x] Smoke test `recentExchanges`
- [x] Smoke test `getLowStock`
- [x] Smoke test write workflows โดยใช้ `SMOKE-` lot, remote guard, captured ids cleanup และ post-check:
  - `receiveItem`
  - `exchangeItem`
  - `disposeItem`
  - `adjustItem`
- [x] Smoke test frontend เดิมใน browser โดย point `window.TW_API_URL` ไป backend ใหม่

Acceptance criteria ก่อนถือว่า UI เดิมทำงานเหมือนเดิม:

- [x] Login/session ทำงานใน browser จริง
- [x] Dashboard แสดงข้อมูล imported data ใน browser จริง
- [x] รับยาเข้าแล้ว stock และ transaction เปลี่ยนถูกต้องใน smoke workflow
- [x] ย้ายยาแล้วต้นทาง/ปลายทางและ transaction ถูกต้องใน smoke workflow
- [x] ตัดจ่ายแล้ว item lifecycle และ transaction ถูกต้องใน smoke workflow
- [x] ตรวจนับแล้ว qty/status/transaction ถูกต้องใน smoke workflow
- [ ] Settings read/write ไม่ลบ notification secret โดยไม่ตั้งใจ
- [x] Upload logo/drug image ใช้ Supabase Storage เมื่อมี service role env และ fallback เป็น local `uploads/` สำหรับ dev
- [x] History filters รวม `adjust` ทำงานกับข้อมูล Supabase ผ่าน SvelteKit settings แล้ว
- [x] Export CSV สำหรับ receive/all/stock ทำงานผ่าน SvelteKit settings แล้ว
- [ ] Search/export Excel parity และ export QA เชิงลึกยังต้องตรวจเพิ่ม
- [x] Browser console ไม่มี error สำคัญใน smoke test หลัก
- [x] Browser smoke ฝั่ง SvelteKit shell ผ่านสำหรับ login, dashboard, stock -> exchange handoff, receive, settings/export และ settings/notify
- [x] Mobile smoke หลักผ่านสำหรับ dashboard, stock, receive และ settings
- [x] Dashboard search auto-update ผ่าน browser จริงหลังแก้ reactive data + debounce navigation

## Phase 7: QA

- [x] Smoke test login/session
- [x] รับเข้า 1 รายการ
- [x] ย้ายยา 1 รายการ
- [x] ตัดจ่าย 1 รายการ
- [x] ปรับยอดจากตรวจนับ
- [x] ตรวจ dashboard summary
- [x] ตรวจ search ใน read-only smoke
- [ ] ตรวจ mobile viewport

## Current Remaining Tasks

ลำดับนี้คือ task คงค้างที่ควรใช้ปิด version ปัจจุบันก่อน โดยแยกเป็นงานที่กระทบผู้ใช้จริงก่อนงานโครงสร้างภายใน

### P0 UI parity ที่ยังค้าง

- [~] ดึง global `toast / dialog / sheet / loading` จาก legacy กลับมาใช้ใน SvelteKit shell (`toast` + `loading` + shared `sheet` แล้ว, `dashboard` low-stock และ `stock dispose` ผูกแล้ว; `dialog` และ flow อื่นยังเหลือ)
- [~] เก็บ `login`, `topbar`, `side menu`, `bottom nav` ให้ตรง legacy มากขึ้นทั้งสี ฟอนต์ spacing และ hierarchy (`side menu`/`bottom nav` ผ่านโครงสร้างและ smoke แล้ว; เหลือ login/topbar fine-tune)
- [x] เก็บ state หลัง submit ของ `receive`, `exchange`, `stock` ให้ใกล้ legacy มากขึ้น

### P1 Settings interaction parity

- [x] `locations`: ทำ auto-save icon/color/name ในหน้า edit ให้เหมือน legacy baseline
- [x] `drugs`: เพิ่ม camera scan / HID scan flow ให้ครบ
- [x] `drugs`: เก็บ feedback หลัง upload/save/delete ให้ใกล้ legacy
- [x] `lot`: เพิ่ม toast/feedback หลัง auto-save ให้ใกล้ legacy
- [x] `users`: เก็บ toast/return flow หลัง save/delete
- [x] `general`: เก็บ upload/delete logo flow
- [x] `display`: เก็บ toggle feedback/revert behavior
- [x] `notify`: เก็บ feedback หลัง save/test และเพิ่ม cron endpoint `/api/notifications/run`
- [x] `audit`: เก็บ state รายแถวหลัง save ให้เท่าของเดิม
- [x] `report`: เก็บ pre-print feedback และ shell รายงาน
- [x] `history`: เก็บ filter chip และ feedback shell
- [x] smoke test settings write flows หลัก (`saveConfig`, `saveDisplay`, `saveNotification`, `exportData`, `changePassword`)

### P2 Backend / Supabase hardening

- [ ] แยก business handlers ที่ยังค้างออกจาก `server/index.js`
- [ ] ปิด permission audit ให้ครบทุก route/action
- [ ] ตัดสินใจและลงมือเรื่อง RLS/Auth strategy ระยะยาว
- [ ] ทำ reconciliation queries เพิ่มสำหรับ stock และ transaction edge cases

### P3 QA ปิดงาน

- [x] ตรวจ mobile viewport สำหรับหน้าหลักของ workflow (`dashboard`, `stock`, `receive`, `settings`)
- [x] smoke test settings write flows หลัก
- [~] QA export/report/search parity เพิ่ม (search browser flow ผ่านแล้ว, report endpoint `near`/`stock` ผ่าน, export backend `stock`/`all`/`receive` ผ่าน; เหลือ UI polish/CSV download QA)
- [~] ตรวจ export (action/backend ผ่านแล้ว; เหลือ download UX QA)
- [~] ตรวจ permission ตาม role (route/tab/menu หลักผ่านแล้วด้วย temp users; ยังไม่เก็บทุก action เชิงลึก)
- [x] ตรวจ browser console errors ใน smoke test หลัก

หมายเหตุสถานะล่าสุด:

- workflow หลักฝั่งใช้งานประจำ (`login`, `dashboard`, `stock`, `receive`, `exchange`, `notify`, `export`) ผ่านระดับ smoke/UAT แล้ว
- settings write flows หลักผ่านแล้ว และ mobile smoke ของ workflow หลักผ่านแล้ว
- สิ่งที่ยังไม่ควร claim ว่าปิด 100% คือ visual parity รายละเอียดของ login/topbar/dashboard, CSV download/UI polish บางจุด และ permission audit ระดับ action edge case

## Phase 8: Deploy

- [x] Push GitHub baseline migration work ไป `drug-store-`
- [ ] Connect Vercel
- [ ] ตั้ง Vercel env vars
- [ ] Deploy preview
- [ ] Test preview
- [ ] Promote production

## Recommended Next Tasks

1. ดึงหน้า `/login` ให้ parity กับ UI เดิมก่อน ทั้ง branding, spacing, form shell, action states และ mobile layout
2. ตัดสินใจ RLS/Auth strategy ระยะสั้น: server-only service role + `app_users` หรือเริ่มผูก Supabase Auth
3. Move current Node/Postgres API จาก compatibility import เข้า SvelteKit server modules ทีละ action group
4. เพิ่ม negative/permission tests สำหรับ write workflows แบบเบา ไม่เพิ่ม process เกินจำเป็น
5. ทดสอบ export/report UI และ settings save config เชิงลึก รวมถึงตัดสินใจว่าจะต้องคง `.xlsx` แทน CSV หรือไม่
6. ทำ notification worker/cron ใหม่แทน Apps Script trigger และต่อ testNotification ให้ส่งจริง
7. Deploy preview บน Vercel พร้อมตั้ง env production
