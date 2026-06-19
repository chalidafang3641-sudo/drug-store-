<script>
  export let data;
  export let form;

  $: values = form?.values || { item_id: '', to_location_id: '', qty: 1 };
</script>

<main class="exchange-shell">
  <section class="page-head">
    <div>
      <p class="eyebrow">แลกยา</p>
      <h1>Exchange stock</h1>
    </div>
    <p class="summary">ค้นหารายการ stock ที่ต้องการย้าย เลือกปลายทางและจำนวน ระบบจะรวม Lot เดิมที่ปลายทางให้เอง</p>
  </section>

  <section class="content-grid">
    <section class="move-panel">
      <form method="GET" class="search-form">
        <label>
          <span>ค้นหาชื่อยา, สถานที่, Lot</span>
          <div class="search-row">
            <input name="q" value={data.q || ''} autocomplete="off" placeholder="เช่น AZT, Main Stock, lot" />
            <button type="submit">ค้นหา</button>
          </div>
        </label>
      </form>

      <form method="POST" class="exchange-form">
        <fieldset>
          <legend>เลือกรายการยา</legend>
          {#if data.searchResults.length}
            <div class="result-list">
              {#each data.searchResults as item}
                <label class="result-row">
                  <input type="radio" name="item_id" value={item.id} checked={values.item_id === item.id} required />
                  <span>
                    <strong>{item.drug_name}</strong>
                    <small>{item.location_name || 'ไม่ระบุ'} · มี {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''} · หมดอายุ {item.expiry_date}</small>
                  </span>
                </label>
              {/each}
            </div>
          {:else if data.q}
            <p class="empty">ไม่พบรายการ active stock จากคำค้นนี้</p>
          {:else}
            <p class="empty">ค้นหาก่อนเพื่อเลือกรายการที่จะย้าย</p>
          {/if}
        </fieldset>

        <label>
          <span>ย้ายไปที่</span>
          <select name="to_location_id" required>
            <option value="">เลือกสถานที่ปลายทาง</option>
            {#each data.locations as location}
              <option value={location.id} selected={values.to_location_id === location.id}>{location.name}</option>
            {/each}
          </select>
        </label>

        <label>
          <span>จำนวนที่ย้าย</span>
          <input name="qty" type="number" min="1" inputmode="numeric" value={values.qty || 1} required />
        </label>

        {#if form?.message}
          <p class:ok={!form.values} class:error={!!form.values}>{form.message}</p>
        {/if}

        <button type="submit" disabled={!data.searchResults.length}>ยืนยันการย้าย</button>
      </form>
    </section>

    <section class="recent">
      <div class="section-head">
        <h2>ย้ายล่าสุด</h2>
        <span>{data.recent.length} รายการ</span>
      </div>
      {#if data.recent.length}
        <div class="rows">
          {#each data.recent as tx}
            <article>
              <div>
                <strong>{tx.drug_name}</strong>
                <span>{tx.from_location_name || 'ไม่ระบุ'} -> {tx.to_location_name || 'ไม่ระบุ'}</span>
              </div>
              <small>{tx.qty}</small>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">ยังไม่มีรายการย้าย</p>
      {/if}
    </section>
  </section>
</main>

<style>
  .exchange-shell {
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
    max-width: 470px;
    color: #666174;
    line-height: 1.5;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
    gap: 16px;
  }

  .move-panel,
  .recent {
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .search-form,
  .exchange-form,
  .recent {
    padding: 16px;
  }

  .search-form {
    border-bottom: 1px solid #eeeaf5;
  }

  label,
  .exchange-form {
    display: grid;
    gap: 12px;
  }

  label span,
  legend {
    font-weight: 800;
  }

  .search-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
  }

  input,
  select {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid #cfcadb;
    border-radius: 8px;
    background: #fff;
    font: inherit;
  }

  button {
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #5b3fc2;
    color: #fff;
    font: inherit;
    font-weight: 800;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  fieldset {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .result-list {
    display: grid;
    gap: 10px;
  }

  .result-row {
    grid-template-columns: auto 1fr;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid #eeeaf5;
    border-radius: 8px;
  }

  .result-row input {
    min-height: auto;
    margin-top: 4px;
  }

  .result-row small,
  .section-head span,
  article span,
  article small,
  .empty {
    color: #666174;
  }

  .result-row small {
    display: block;
    margin-top: 3px;
  }

  .error,
  .ok {
    padding: 10px 12px;
    border-radius: 8px;
    font-weight: 700;
  }

  .error {
    background: #fef3f2;
    color: #b42318;
  }

  .ok {
    background: #ecfdf3;
    color: #067647;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .rows {
    display: grid;
    gap: 10px;
  }

  article {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid #eeeaf5;
  }

  article:first-child {
    border-top: 0;
  }

  article span {
    display: block;
    margin-top: 3px;
  }

  article small {
    white-space: nowrap;
    font-weight: 800;
  }

  @media (min-width: 780px) {
    .exchange-shell {
      padding-left: 196px;
    }
  }

  @media (max-width: 820px) {
    .page-head,
    .content-grid {
      align-items: stretch;
      display: flex;
      flex-direction: column;
    }

    .search-row {
      grid-template-columns: 1fr;
    }
  }
</style>
