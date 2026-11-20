export const bangkokToday = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date";

export function expirySelection(filter, config) {
  const critical = config.expiry_critical_days;
  const high = config.expiry_high_days;
  const medium = config.expiry_medium_days;
  const ranges = new Map([
    ["crit", [critical]], ["high", [high, critical]], ["med", [medium, high]]
  ]);
  const params = ranges.get(filter) ?? [medium];
  let where = `i.status = 'active' AND i.qty > 0 AND i.expiry_date <= ${bangkokToday} + $1::int`;
  if (params.length === 2) where += ` AND i.expiry_date > ${bangkokToday} + $2::int`;
  return { where, params };
}
