<script>
  export let data;

  const summary = data.summary || {};
  const near = data.near || [];
  const lowStock = data.lowStock || [];
  const cards = [
    { label: `ภายใน ${data.thresholds.critical || 35} วัน`, value: summary.within35 || 0, tone: 'crit' },
    { label: `ภายใน ${data.thresholds.high || 60} วัน`, value: summary.within60 || 0, tone: 'high' },
    { label: `ภายใน ${data.thresholds.medium || 120} วัน`, value: summary.within120 || 0, tone: 'med' },
    { label: `มากกว่า ${data.thresholds.medium || 120} วัน`, value: summary.over120 || 0, tone: 'safe' }
  ];
</script>

<main class="dashboard-shell">
  <section class="page-head">
    <div>
      <p class="eyebrow">ภาพรวม</p>
      <h1>Dashboard</h1>
    </div>
    <div class="user-chip">{data.user?.name || data.user?.username}</div>
  </section>

  <section class="stat-grid" aria-label="สรุปวันหมดอายุ">
    {#each cards as card}
      <article class={card.tone}>
        <strong>{card.value}</strong>
        <span>{card.label}</span>
      </article>
    {/each}
  </section>

  {#if lowStock.length}
    <section class="alert-line">
      <strong>สต็อกต่ำ</strong>
      <span>{lowStock.length} รายการต่ำกว่าขั้นต่ำ</span>
    </section>
  {/if}

  <section class="list-section">
    <h2>รายการใกล้หมดอายุ</h2>
    {#if near.length}
      <div class="rows">
        {#each near.slice(0, 8) as item}
          <article class="row">
            <div>
              <strong>{item.drug_name}</strong>
              <span>{item.location_name || 'ไม่ระบุ'} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</span>
            </div>
            <em>{item.days} วัน</em>
          </article>
        {/each}
      </div>
    {:else}
      <p class="empty">ไม่มีรายการใกล้หมดอายุ</p>
    {/if}
  </section>
</main>

<style>
  .dashboard-shell {
    width: min(1040px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 86px;
  }

  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
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
  h2 {
    margin: 0;
  }

  .user-chip {
    padding: 8px 10px;
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
    font-weight: 700;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  article {
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .stat-grid article {
    padding: 16px;
  }

  .stat-grid strong {
    display: block;
    font-size: 2rem;
  }

  .stat-grid span {
    color: #635e70;
  }

  .crit strong {
    color: #b42318;
  }

  .high strong {
    color: #b54708;
  }

  .med strong {
    color: #5b3fc2;
  }

  .safe strong {
    color: #067647;
  }

  .alert-line {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin: 16px 0 0;
    padding: 14px 16px;
    border-radius: 8px;
    background: #fff7ed;
    color: #9a3412;
  }

  .list-section {
    margin-top: 24px;
  }

  .rows {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
  }

  .row span {
    display: block;
    margin-top: 3px;
    color: #666174;
  }

  .row em {
    white-space: nowrap;
    color: #5b3fc2;
    font-style: normal;
    font-weight: 800;
  }

  .empty {
    color: #666174;
  }

  @media (min-width: 780px) {
    .dashboard-shell {
      padding-left: 196px;
    }
  }

  @media (max-width: 720px) {
    .stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .page-head,
    .row,
    .alert-line {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
