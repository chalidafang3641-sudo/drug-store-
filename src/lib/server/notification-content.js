export function validExpiryDays(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3650;
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
