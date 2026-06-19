# Drug Store Migration Plan

เป้าหมายคือย้ายโปรเจกต์จาก static frontend + Google Apps Script + Google Sheets ไปเป็นระบบ production-ready ที่ดูแลง่ายขึ้น

Target stack:

- Frontend: SvelteKit
- Hosting: Vercel
- Backend: SvelteKit API routes/server actions
- Database: Supabase Postgres
- Storage: Supabase Storage
- Notifications: Vercel Cron หรือ Supabase Edge Functions

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
- ดึง legacy snapshot ล่าสุดสำเร็จแล้วและเก็บใน `legacy-exports/` ซึ่งถูก `.gitignore`
- ดึง legacy logo จาก Google Drive มาเก็บใน `uploads/legacy-assets/` แล้ว ซึ่งถูก `.gitignore`
- มี requirement document ที่แกะจาก frontend/backend แล้วใน `req.md`
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
- [ ] เพิ่ม RLS policies ตาม role หรือเลือก server-only access ด้วย service role
- [ ] สร้าง Supabase Storage buckets สำหรับ `branding` และ `drug-images`
- [ ] Import legacy snapshot เข้า Supabase

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

- [ ] สร้าง SvelteKit project structure
- [ ] ติดตั้ง TypeScript, lint/type-check/build scripts
- [ ] ย้าย static assets: `icons/`, `manifest.json`, `sw.js`
- [ ] ตัดสินใจว่าจะใช้ `css/app.css` เดิมชั่วคราวหรือย้ายเป็น component styles/Tailwind
- [ ] สร้าง root layout และ app shell
- [ ] สร้าง protected layout สำหรับหน้าในระบบ
- [ ] สร้าง bottom navigation
- [ ] สร้าง placeholder routes หลัก

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

- [ ] สร้าง endpoint `POST /api`
- [ ] คง action contract เดิมไว้:

```json
{
  "action": "getDashboard",
  "token": "...",
  "params": "..."
}
```

- [ ] ย้าย logic จาก `server/index.js` เข้า SvelteKit server route
- [ ] แยก server modules:

```text
src/lib/server/db.ts
src/lib/server/auth.ts
src/lib/server/actions/
src/routes/api/+server.ts
```

- [ ] ทำ error response ให้เข้ากับ frontend เดิม
- [ ] ทำ auth expired response ให้ยังใช้ `code: "AUTH"` ได้

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

- [ ] ตั้ง server env ที่จำเป็นก่อนทำ import/deploy:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

- [ ] ออกแบบ Supabase Storage buckets:

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

- [ ] ทำ login/logout/session ใน SvelteKit
- [ ] ระยะสั้นใช้ `app_users` เดิมแบบ hashed password
- [ ] ตั้ง httpOnly secure cookie
- [ ] ทำ `hooks.server.ts` สำหรับโหลด user/session
- [ ] ทำ protected routes
- [ ] ตรวจ permission ตาม role
- [ ] ระยะยาวย้ายไป Supabase Auth + RLS

## Phase 5: UI Migration

ย้ายทีละหน้าโดย preserve behavior เดิมก่อน redesign

- [ ] Login
- [ ] Dashboard
- [ ] Receive
- [ ] Stock by location
- [ ] Exchange/move
- [ ] Settings basic
- [ ] Drug/location management
- [ ] Users
- [ ] History
- [ ] Export/report
- [ ] Notifications

## Phase 6: Legacy Data Migration

- [x] ทำ script ดึงข้อมูลจาก Google Apps Script API เดิม
- [x] ดึง legacy snapshot จาก API เดิมมาเก็บใน `legacy-exports/`
- [x] ทำ script ดึงรูป/โลโก้จาก legacy snapshot มาเก็บใน `uploads/legacy-assets/`
- [x] ดาวน์โหลด legacy logo ลง local asset folder แล้ว
- [ ] ทำ import script จาก `legacy-exports/legacy-snapshot-latest.json` เข้า Postgres/Supabase
- [ ] ดึงและ upsert ข้อมูล:

```text
config
locations
drugs
items
transactions
users
```

- [ ] เก็บ source id เดิมเท่าที่ API ส่งมา
- [ ] ทำ dry run mode สำหรับ import
- [ ] ทำ idempotent upsert เพื่อให้ import ซ้ำแล้วข้อมูลไม่ซ้ำ
- [ ] ตัดสินใจเรื่อง users: ไม่ย้าย plaintext password, ให้สร้าง/reset password ใหม่หรือใช้ Supabase Auth
- [x] ตัดสินใจเรื่องรูปยา/โลโก้: download จาก Google Drive มาเก็บ local ignored ก่อน
- [ ] Upload legacy assets เข้า Supabase Storage หลังสร้าง buckets และมี service role key
- [ ] Update `app_config.logo_file_id` / `logo_url` หรือ storage path หลัง upload เข้า Supabase Storage
- [ ] ทำ reconciliation หลัง import:
  - จำนวน locations
  - จำนวน active drugs
  - จำนวน active stock items
  - stock quantity รวม
  - transaction count
  - near-expiry count

## Phase 7: QA

- [ ] Smoke test login/logout
- [ ] รับเข้า 1 รายการ
- [ ] ย้ายยา 1 รายการ
- [ ] ตัดจ่าย 1 รายการ
- [ ] ปรับยอดจากตรวจนับ
- [ ] ตรวจ dashboard summary
- [ ] ตรวจ search
- [ ] ตรวจ mobile viewport
- [ ] ตรวจ export
- [ ] ตรวจ permission ตาม role
- [ ] ตรวจ browser console/network errors

## Phase 8: Deploy

- [ ] Push GitHub
- [ ] Connect Vercel
- [ ] ตั้ง Vercel env vars
- [ ] Deploy preview
- [ ] Test preview
- [ ] Promote production

## Recommended Next Tasks

1. ทำ import script จาก legacy snapshot เข้า Supabase โดยใช้ `legacy_id_map` ให้ import ซ้ำได้
2. Import `config`, `locations`, `drugs`, `items`, `transactions`, `users` พร้อม dry-run mode
3. สร้าง reconciliation report เทียบ snapshot กับ Supabase: จำนวน record, stock qty รวม, transaction count, near-expiry count
4. สร้าง Supabase Storage buckets `branding` และ `drug-images`
5. Upload legacy assets จาก `uploads/legacy-assets/manifest.json` เข้า Supabase Storage และ update path ใน database
6. ตัดสินใจ RLS/Auth strategy ระยะสั้น: server-only service role + `app_users` หรือเริ่มผูก Supabase Auth
7. Scaffold SvelteKit structure in a reviewable branch
8. Add `/api` compatibility endpoint
9. Move current Node/Postgres API into SvelteKit server modules
10. Implement login + protected layout
11. Migrate dashboard page
