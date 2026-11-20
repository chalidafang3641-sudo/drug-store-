const booleanColumns = new Set(['active', 'require_lot', 'is_default_receive', 'notification_enabled', 'telegram_enabled', 'line_enabled', 'notify_include_expired', 'display_be']);

function statement(sql, values) {
  const params = [];
  const bangkok = "date('now','+7 hours')";
  sql = sql.replace('s.expires_at > now()', "julianday(s.expires_at) > julianday('now')")
    .replaceAll("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date", bangkok)
    .replace(/(CURRENT_DATE|date\('now','\+7 hours'\)) \+ (\$\d+)::int/g, "date($1,$2 || ' days')")
    .replace(/\((\$\d+)::date \+ INTERVAL '1 day'\)/g, "date($1,'+1 day')")
    .replace(/= ANY\((\$\d+)\)/g, 'IN (SELECT value FROM json_each($1))')
    .replace(/::(?:int|text|boolean|date)\b/g, '').replace(/\bnow\(\)/gi,'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)/g, (_, n) => {
      let value = values[Number(n)-1];
      if (value instanceof Date) value = value.toISOString();
      if (Array.isArray(value)) value = JSON.stringify(value);
      if (typeof value === 'boolean') value = Number(value);
      params.push(value ?? null);
      return '?';
    });
  return {sql, params};
}

let local;
export const d1 = {
  async query(sql, values = []) {
    const stmt = statement(sql, values);
    let result;
    if (!process.env.VERCEL && process.env.D1_TEST_FILE) {
      const { DatabaseSync } = await import('node:sqlite');
      local ??= new DatabaseSync(process.env.D1_TEST_FILE);
      const results = local.prepare(stmt.sql).all(...stmt.params);
      result = {results, meta: {changes: local.prepare('SELECT changes() AS n').get().n}};
    } else {
      const { D1_SERVICE_URL, D1_SERVICE_KEY } = process.env;
      if (!D1_SERVICE_URL || !D1_SERVICE_KEY) throw new Error('Missing D1 configuration');
      const response = await fetch(D1_SERVICE_URL, {
        method:'POST', redirect:'error', headers:{authorization:'Bearer '+D1_SERVICE_KEY,'content-type':'application/json'}, body:JSON.stringify(stmt)
      });
      if (!response.ok) throw new Error('D1 query failed ('+response.status+')');
      result = await response.json();
      if (!result.success) throw new Error('D1 query failed');
    }
    for (const row of result.results) {
      for (const k of Object.keys(row)) if (booleanColumns.has(k) && row[k] != null) row[k] = Boolean(row[k]);
      if (typeof row.permissions === 'string') row.permissions = JSON.parse(row.permissions);
    }
    return {rows:result.results,rowCount:result.meta.changes};
  },
  async connect() { return { query:this.query.bind(this), release() {} }; }
};
