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
  db.close();

  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { GET } = await vite.ssrLoadModule('/src/routes/settings/report/+server.js');
    const response = await GET({
      locals: { user: { permissions: ['view'] } },
      url: new URL('http://localhost/settings/report?kind=near')
    });
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
  } finally {
    await vite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
