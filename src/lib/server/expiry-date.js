const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function daysUntilExpiry(expiryDate, now = new Date()) {
  const parts = bangkokDate.formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return Math.round((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
