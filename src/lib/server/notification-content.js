export function validExpiryDays(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3650;
}

export function expiryNotificationSections(items = []) {
  const sorted = [...items].sort((a, b) => a.days - b.days || String(a.drug_name).localeCompare(String(b.drug_name), 'th'));
  const upcoming = sorted.filter((item) => item.days >= 0);
  const expired = sorted.filter((item) => item.days < 0);
  const section = (title, rows) => [
    `${title} ${rows.length} รายการ`,
    ...rows.map((item, index) => {
      const days = item.days < 0 ? `หมดอายุแล้ว ${Math.abs(item.days)} วัน`
        : item.days === 0 ? 'หมดอายุวันนี้' : `เหลือ ${item.days} วัน`;
      return `${index + 1}. ${item.drug_name}${item.lot_no ? ` Lot ${item.lot_no}` : ''} @ ${item.location_name || '-'}\n   หมดอายุ ${item.expiry_date} | ${days} | คงเหลือ ${item.qty}`;
    })
  ].join('\n');
  return `${section('ใกล้หมดอายุ', upcoming)}\n\n${section('หมดอายุแล้ว', expired)}`;
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
