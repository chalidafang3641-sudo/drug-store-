export function validExpiryDays(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3650;
}

const thaiOrder = new Intl.Collator('th', { numeric: true });

export function expiryByLocation(items) {
  const locations = new Map();
  for (const item of items) {
    const name = item.location_name || 'ไม่ระบุสถานที่';
    const key = item.location_id || name;
    if (!locations.has(key)) locations.set(key, { name, items: [] });
    locations.get(key).items.push(item);
  }
  for (const group of locations.values()) {
    group.items.sort((a, b) =>
      String(a.expiry_date).localeCompare(String(b.expiry_date)) ||
      a.days - b.days ||
      thaiOrder.compare(a.drug_name, b.drug_name) ||
      thaiOrder.compare(a.lot_no || '', b.lot_no || '')
    );
  }
  return [...locations.values()].sort((a, b) => thaiOrder.compare(a.name, b.name));
}

export function expiryNotificationSections(items = []) {
  const expired = items.filter(item => item.days < 0).length;
  const summary = `ใกล้หมดอายุ ${items.length - expired} รายการ\n\nหมดอายุแล้ว ${expired} รายการ`;
  const sections = expiryByLocation(items).map(({ name, items }) => {
    const lines = items.map((item, index) => {
      const days = item.days < 0 ? `หมดอายุแล้ว ${Math.abs(item.days)} วัน`
        : item.days === 0 ? 'หมดอายุวันนี้' : `เหลือ ${item.days} วัน`;
      return `${index + 1}. ${item.drug_name}${item.lot_no ? ` Lot ${item.lot_no}` : ''}\n   หมดอายุ ${item.expiry_date} | ${days} | คงเหลือ ${item.qty}`;
    });
    return [`สถานที่: ${name} (${items.length} รายการ)`, ...lines].join('\n');
  });
  return [summary, sections.join('\n\n────────────\n\n')].filter(Boolean).join('\n\n');
}

export function notificationExpiryWhere() {
  return `i.status = 'active' AND i.qty > 0
    AND i.expiry_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date + $1::int
    AND ($2::boolean OR i.expiry_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date)`;
}

// Keep line boundaries where possible, without dropping text or splitting surrogate pairs.
export function splitNotificationText(text, limit = 4000) {
  const parts = [];
  while (text.length > limit) {
    let end = text.lastIndexOf('\n', limit - 1) + 1;
    if (!end) end = limit;
    const last = text.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end--;
    parts.push(text.slice(0, end));
    text = text.slice(end);
  }
  if (text) parts.push(text);
  return parts;
}
