import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';

test('expiry print groups the complete selection, escapes values and orders lots by date', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'expiry-print-'));
  process.env.DATABASE_DRIVER = 'd1';
  process.env.D1_TEST_FILE = join(dir, 'fixture.sqlite');
  const db = new DatabaseSync(process.env.D1_TEST_FILE);
  db.exec(`
    CREATE TABLE locations(id,code_id,name);
    CREATE TABLE app_config(id INTEGER,hospital_name,default_receive_location_id,expiry_medium_days);
    CREATE TABLE transactions(id,code_id);
    CREATE TABLE drugs(id,code_id,name,image_file_id);
    CREATE TABLE items(id,drug_id,location_id,last_transaction_id,status,qty,expiry_date,lot_no);
    INSERT INTO app_config VALUES(1,'Test & Hospital',1,120);
    INSERT INTO locations VALUES(1,'l1','Site A <West>'),(2,'l2','Site B');
    INSERT INTO drugs VALUES(1,'d1','Drug <X>',NULL);
    WITH RECURSIVE lots(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM lots WHERE n<103)
    INSERT INTO items
      SELECT n,1,1+n%2,NULL,'active',1,
        date('now',CASE WHEN n%3=0 THEN '-1 day' ELSE '+1 day' END),'Lot-'||n
      FROM lots;
  `);
  db.exec(`
    ALTER TABLE app_config ADD COLUMN expiry_high_days DEFAULT 60;
    ALTER TABLE app_config ADD COLUMN expiry_critical_days DEFAULT 35;
    ALTER TABLE drugs ADD COLUMN active DEFAULT 1;
    ALTER TABLE drugs ADD COLUMN unit DEFAULT 'box';
    ALTER TABLE drugs ADD COLUMN min_qty DEFAULT 0;
    CREATE TABLE sessions(user_id,code_id,expires_at);
    CREATE TABLE app_users(id,code_id,username,role,name,permissions,active);
    INSERT INTO app_users VALUES(1,'u','viewer','viewer','Viewer','["view"]',1);
    INSERT INTO sessions VALUES(1,'fixture','2099-01-01');
    UPDATE items SET expiry_date=date('now','+7 hours','+36 days') WHERE id=103;
  `);
  db.close();

  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { GET } = await vite.ssrLoadModule('/src/routes/settings/report/+server.js');
    const response = await GET({
      locals: { user: { permissions: ['view'] } },
      url: new URL('http://localhost/settings/report?kind=near')
    });
    const { load } = await vite.ssrLoadModule('/src/routes/dashboard/+page.server.js');
    const locals = { user: { permissions: ['view'] }, token: 'fixture' };
    const dashboard = query => load({ locals, url: new URL('http://localhost/dashboard?' + query) });
    const last = await dashboard('page=3');
    assert.equal(last.pages, 3);
    assert.equal(last.near.length, 3);
    const selected = await dashboard('filter=high');
    assert.deepEqual(selected.near.map(item => item.lot_no), ['Lot-103']);
    const filteredPrint = await GET({ locals, url: new URL('http://localhost/settings/report?filter=high') });
    assert.deepEqual((await filteredPrint.text()).match(/Lot-\d+/g), ['Lot-103']);
    const stockReport = async query => (await GET({ locals, url: new URL('http://localhost/settings/report?kind=stock' + query) })).text();
    const lastStock = await stockReport('&size=10&page=11');
    assert.match(lastStock, /แสดง 101–103 จาก 103 รายการ/);
    assert.equal(lastStock.match(/<td>Lot-/g).length, 3);
    assert.doesNotMatch(lastStock, /window.print/);
    const fullStock = await stockReport('&print=all');
    assert.equal(fullStock.match(/<td>Lot-/g).length, 103);
    assert.match(fullStock, /window.print/);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /รวม 103 รายการ/);
    assert.match(html, /Site A &lt;West&gt;[^]*Site B/);
    assert.match(html, /Drug &lt;X&gt;/);
    assert.match(html, /Test &amp; Hospital/);
    assert.equal((html.match(/scope="rowgroup"/g) || []).length, 2);
    assert.equal((html.match(/<td>Lot-/g) || []).length, 103);
    for (const body of html.matchAll(/<tbody>([^]*?)<\/tbody>/g)) {
      const numbers = [...body[1].matchAll(/<tr><td>(\d+)<\/td>/g)].map(match => Number(match[1]));
      assert.ok(numbers.length > 50);
      assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
      const statuses = [...body[1].matchAll(/<td>Lot-\d+<\/td><td>[^<]+<\/td><td>([^<]+)<\/td>/g)].map(m => m[1]);
      assert.ok(statuses.length > 50);
      const firstUpcoming = statuses.findIndex(status => status !== 'หมดอายุ');
      assert.ok(firstUpcoming > 0);
      assert.ok(statuses.slice(firstUpcoming).every(status => status !== 'หมดอายุ'));
    }
    assert.match(html, /window\.print/);
    const download = await GET({
      locals: { user: { permissions: ['view'] } },
      url: new URL('http://localhost/settings/report?kind=near&format=xlsx')
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /attachment; filename="expiry-report.xlsx"/);
    const workbook = Buffer.from(await download.arrayBuffer());
    assert.equal(workbook.readUInt32LE(), 0x04034b50);
  } finally {
    await vite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
