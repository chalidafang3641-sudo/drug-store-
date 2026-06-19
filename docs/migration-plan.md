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
- มี PostgreSQL schema draft ใน `db/schema.sql`
- API pattern ปัจจุบันเป็น action-based:

```js
api('getDrugs')
api('receiveItem', params)
api('getDashboard')
```

ให้คง contract นี้ไว้ระหว่าง migration เพื่อลดความเสี่ยงจากการแก้ frontend ทั้งระบบพร้อมกัน

## Phase 0: Foundation

- [ ] ยืนยัน stack เป้าหมาย: `SvelteKit + Vercel + Supabase`
- [ ] สร้าง branch สำหรับ migration เช่น `codex/sveltekit-migration`
- [ ] สรุป feature เดิมที่ต้อง preserve
- [ ] แยกงานเป็น batch ขนาดเล็ก ตรวจง่าย และ rollback ได้

Feature เดิมที่ต้อง preserve:

- [ ] Login/logout/session
- [ ] Dashboard สรุปยาใกล้หมดอายุและ stock ต่ำ
- [ ] รับยาเข้า stock
- [ ] ดู stock ตามสถานที่
- [ ] ย้าย/แลกยาระหว่างสถานที่
- [ ] ตัดจ่าย/ทิ้งยา
- [ ] ตรวจนับและปรับยอด
- [ ] ตั้งค่าโรงพยาบาล โลโก้ และช่วงแจ้งเตือน
- [ ] จัดการสถานที่เก็บยา
- [ ] จัดการรายการยา รูปยา barcode และ Lot required
- [ ] จัดการผู้ใช้และ role
- [ ] ประวัติการเคลื่อนไหว
- [ ] Export Excel / print report
- [ ] Telegram/LINE notification
- [ ] PWA/mobile-friendly behavior

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

- [ ] ปรับ `db/schema.sql` ให้เป็น Supabase migration
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

- [ ] ทำ script ดึงข้อมูลจาก Google Apps Script API เดิม
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
- [ ] ทำ dry run mode
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

1. Scaffold SvelteKit structure in a reviewable branch
2. Add `/api` compatibility endpoint
3. Move current Node/Postgres API into SvelteKit server modules
4. Connect Supabase Postgres
5. Implement login + protected layout
6. Migrate dashboard page
