<script>
  export let data;

  function expiryTone(days) {
    if (days <= 35) return 'crit';
    if (days <= 60) return 'high';
    if (days <= 120) return 'med';
    return 'safe';
  }
</script>

<main class="stock-shell">
  <section class="page-head">
    <div>
      <p class="eyebrow">ยาแต่ละจุด</p>
      <h1>Stock by location</h1>
    </div>
    <p class="summary">เลือกสถานที่เพื่อดูรายการ active stock ที่เรียงตามวันใกล้หมดอายุ</p>
  </section>

  <section class="loc-grid" aria-label="สถานที่เก็บยา">
    {#each data.locations as location}
      <a
        class:selected={location.id === data.selected.id}
        href={`/stock?location_id=${encodeURIComponent(location.id)}`}
        style={`--loc-color:${location.color || '#5b3fc2'}`}
      >
        <span>{location.name}</span>
        <strong>{location.count}</strong>
        <small>รวมจำนวน {location.qty}</small>
      </a>
    {/each}
  </section>

  <section class="item-section">
    <div class="section-head">
      <h2>{data.selected.name}</h2>
      <span>{data.items.length} รายการ</span>
    </div>

    {#if data.items.length}
      <div class="item-list">
        {#each data.items as item}
          <article>
            {#if item.image_url}
              <img src={item.image_url} alt="" />
            {/if}
            <div class="item-main">
              <strong>{item.drug_name}</strong>
              <span>{item.location_name || 'ไม่ระบุ'} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</span>
              <small>หมดอายุ {item.expiry_date}</small>
            </div>
            <em class={expiryTone(item.days)}>{item.days} วัน</em>
          </article>
        {/each}
      </div>
    {:else}
      <p class="empty">ยังไม่มียาในจุดนี้</p>
    {/if}
  </section>
</main>

<style>
  .stock-shell {
    width: min(1120px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 86px;
  }

  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 18px;
  }

  .eyebrow {
    margin: 0 0 4px;
    color: #5b3fc2;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .summary {
    max-width: 430px;
    color: #666174;
    line-height: 1.5;
  }

  .loc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .loc-grid a {
    display: grid;
    gap: 8px;
    min-height: 112px;
    padding: 16px;
    border: 1px solid #dedbe8;
    border-left: 5px solid var(--loc-color);
    border-radius: 8px;
    background: #fff;
    color: inherit;
    text-decoration: none;
  }

  .loc-grid a.selected {
    border-color: var(--loc-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--loc-color), transparent 78%);
  }

  .loc-grid strong {
    font-size: 2rem;
  }

  .loc-grid small {
    color: #666174;
  }

  .item-section {
    margin-top: 26px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .section-head span {
    color: #666174;
    font-weight: 700;
  }

  .item-list {
    display: grid;
    gap: 10px;
  }

  article {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  article img {
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
    object-fit: cover;
    border-radius: 8px;
    background: #f0eef7;
  }

  .item-main {
    flex: 1;
    min-width: 0;
  }

  .item-main span,
  .item-main small {
    display: block;
    margin-top: 3px;
    color: #666174;
  }

  article em {
    white-space: nowrap;
    font-style: normal;
    font-weight: 800;
  }

  .crit {
    color: #b42318;
  }

  .high {
    color: #b54708;
  }

  .med {
    color: #5b3fc2;
  }

  .safe {
    color: #067647;
  }

  .empty {
    padding: 18px;
    border: 1px dashed #cfcadb;
    border-radius: 8px;
    color: #666174;
  }

  @media (min-width: 780px) {
    .stock-shell {
      padding-left: 196px;
    }
  }

  @media (max-width: 720px) {
    .page-head,
    article {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
