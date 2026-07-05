# Local Docker Database

เอกสารนี้อธิบายวิธีรัน PostgreSQL สำหรับ development ด้วย Docker

## สิ่งที่ push ขึ้น git ได้

- `docker-compose.yml`
- `db/schema.sql`
- migration SQL
- เอกสารวิธี setup

## สิ่งที่ห้าม push ขึ้น git

- database volume/data จริง
- `.env`
- `.env.local`
- production dump
- backup ที่มีข้อมูลผู้ป่วย/ข้อมูลจริง/secret

## Start Database

```bash
npm run docker:db:up
```

หรือ:

```bash
docker compose up -d postgres
```

Postgres จะเปิดที่ local port `5433`

```text
DATABASE_URL=postgres://drugstore:drugstore_dev@localhost:5433/the_watcher
```

ครั้งแรกที่ volume ว่าง container จะรัน `db/schema.sql` อัตโนมัติ และ seed:

- config default
- default locations
- roles
- `admin/admin1234`

## ใช้กับ SvelteKit Local

ตั้งค่า `.env.local`:

```env
DATABASE_URL=postgres://drugstore:drugstore_dev@localhost:5433/the_watcher
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
```

แล้วรัน:

```bash
npm run dev:svelte
```

เปิด:

```text
http://127.0.0.1:5173/login
```

login:

```text
admin
admin1234
```

## Reset Database

คำสั่งนี้ลบ Docker volume และข้อมูลทั้งหมดใน local Docker DB:

```bash
npm run docker:db:reset
```

หลัง reset แล้ว `docker compose up` ครั้งถัดไปจะ init schema ใหม่จาก `db/schema.sql`

## Import Legacy Snapshot

ถ้าต้องการนำข้อมูล legacy JSON เข้า Docker DB:

```bash
DATABASE_URL=postgres://drugstore:drugstore_dev@localhost:5433/the_watcher npm run legacy:import:dry-run
DATABASE_URL=postgres://drugstore:drugstore_dev@localhost:5433/the_watcher npm run legacy:import
DATABASE_URL=postgres://drugstore:drugstore_dev@localhost:5433/the_watcher npm run legacy:reconcile
```

หมายเหตุ: `legacy-exports/` ถูก ignore เพราะเป็นข้อมูลจริงจากระบบเก่า

## Backup Local Docker DB

ถ้าต้องการ dump เฉพาะเครื่อง ให้เขียนออกนอก repo หรือเก็บใน path ที่ ignore แล้ว:

```bash
docker compose exec postgres pg_dump -U drugstore -d the_watcher > /tmp/the_watcher_local.sql
```

อย่า commit dump ที่มีข้อมูลจริง
