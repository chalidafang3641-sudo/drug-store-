<script>
  export let location, printed, stock, adjustments;
  const date = (value) => new Date(value).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
</script>

<h1>รายงานตรวจนับสต็อกยา</h1>
<p>{location} · พิมพ์เมื่อ {printed}</p>
<button type="button" id="print-report">พิมพ์</button>
<h2>ยอดคงเหลือ ณ เวลาพิมพ์</h2>
<table>
  <thead><tr><th>ยา</th><th>Lot</th><th>หมดอายุ</th><th>หน่วย</th><th>ยอดระบบ</th><th>นับจริง</th></tr></thead>
  <tbody>
    {#each stock as item}
      <tr><td>{item.name}</td><td>{item.lot_no || '–'}</td><td>{date(item.expiry_date)}</td><td>{item.unit}</td><td>{item.qty}</td><td></td></tr>
    {:else}
      <tr><td colspan="6">ไม่มียาคงเหลือ</td></tr>
    {/each}
  </tbody>
</table>
<h2>รายการปรับยอดจากการตรวจนับวันนี้</h2>
<table>
  <thead><tr><th>ยา</th><th>Lot</th><th>นับจริง</th><th>รายละเอียด</th><th>ผู้บันทึก</th></tr></thead>
  <tbody>
    {#each adjustments as row}
      <tr><td>{row.name}</td><td>{row.lot_no || '–'}</td><td>{row.qty}</td><td>{row.note}</td><td>{row.by_username}</td></tr>
    {:else}
      <tr><td colspan="5">ไม่มีรายการปรับยอดในวันนี้</td></tr>
    {/each}
  </tbody>
</table>
