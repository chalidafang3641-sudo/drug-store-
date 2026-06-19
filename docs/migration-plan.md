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
- มี PostgreSQL schema draft ใน `db/schema.sql` ที่ปรับ indexing สำหรับ Supabase/Postgres แล้ว
- มี legacy export script ใน `scripts/export-old-api.mjs`
- ดึง legacy snapshot ล่าสุดสำเร็จแล้วและเก็บใน `legacy-exports/` ซึ่งถูก `.gitignore`
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
- [ ] แปลง `db/schema.sql` เป็น Supabase migration ด้วย Supabase CLI
- [ ] เพิ่ม Supabase migrations
- [ ] ตั้ง env ที่จำเป็น:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PUBLIC_SUPABASE_URL
```

- [ ] ออกแบบ Supabase Storage buckets:

```text
branding
drug-images
```

- [ ] วาง RLS/Auth strategy
- [ ] ทำ reconciliation queries สำหรับ stock และ transactions

Indexing baseline ที่ใส่แล้ว:

- internal primary key ใช้ `BIGINT GENERATED ALWAYS AS IDENTITY`
- public/API id ใช้ `code_id` แยกจาก internal id ทุก entity หลัก
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
- [ ] ตัดสินใจเรื่องรูปยา/โลโก้: download จาก Google Drive แล้ว upload เข้า Supabase Storage หรือคง URL เดิมชั่วคราว
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

1. แตก `req.md` เป็น implementation tickets/batches สำหรับ SvelteKit migration
2. ทำ import script จาก legacy snapshot เข้า Postgres/Supabase
3. ทำ reconciliation report เทียบ snapshot กับ target database
4. Scaffold SvelteKit structure in a reviewable branch
5. Add `/api` compatibility endpoint
6. Move current Node/Postgres API into SvelteKit server modules
7. Connect Supabase Postgres
8. Implement login + protected layout
9. Migrate dashboard page
