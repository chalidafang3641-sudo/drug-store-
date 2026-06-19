<script>
  export let data;
  export let form;

  $: values = form?.values || {
    drug_id: data.selectedDrugId || '',
    lot_no: '',
    expiry_date: '',
    qty: 1,
    location_id: data.defaultLocationId || ''
  };

  function todayLocal() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }
</script>

<main class="receive-shell">
  <section class="page-head">
    <div>
      <p class="eyebrow">รับเข้า</p>
      <h1>Receive stock</h1>
    </div>
    <p class="summary">เลือกยา กรอก Lot วันหมดอายุ จำนวน และสถานที่เก็บ ระบบจะรวมกับ Lot เดิมถ้าข้อมูลตรงกัน</p>
  </section>

  <section class="content-grid">
    <section class="quick-tools">
      <form method="GET" action="/receive" class="scan-form">
        <label>
          <span>ยิงบาร์โค้ด / ค้นหายา</span>
          <input name="q" value={data.q || ''} autocomplete="off" placeholder="ยิง barcode หรือพิมพ์ชื่อยา" />
        </label>
        <button type="submit">ค้นหา</button>
      </form>
      <a class="export-link" href={`/settings/export?kind=receive&from=${todayLocal()}&to=${todayLocal()}`}>Export วันนี้</a>
      {#if data.scanMessage}
        <p class:ok={!!data.selectedDrugId} class:error={!data.selectedDrugId}>{data.scanMessage}</p>
      {/if}
    </section>

    <form method="POST" class="receive-form">
      <label>
        <span>รายการยา</span>
        <select name="drug_id" required>
          <option value="">เลือกยา</option>
          {#each data.drugs as drug}
            <option value={drug.id} selected={(values.drug_id || data.selectedDrugId) === drug.id}>
              {drug.name}{drug.code ? ` · ${drug.code}` : ''}{drug.require_lot ? ' · Lot บังคับ' : ''}
            </option>
          {/each}
        </select>
      </label>

      <label>
        <span>Lot No.</span>
        <input name="lot_no" value={values.lot_no || ''} autocomplete="off" placeholder="เลขล็อต" />
      </label>

      <label>
        <span>วันหมดอายุ</span>
        <input name="expiry_date" type="date" value={values.expiry_date || ''} required />
      </label>

      <label>
        <span>จำนวน</span>
        <input name="qty" type="number" min="1" inputmode="numeric" value={values.qty || 1} required />
      </label>

      <label>
        <span>สถานที่เก็บ</span>
        <select name="location_id" required>
          <option value="">เลือกสถานที่</option>
          {#each data.locations as location}
            <option value={location.id} selected={(values.location_id || data.defaultLocationId) === location.id}>
              {location.name}
            </option>
          {/each}
        </select>
      </label>

      {#if form?.message}
        <p class:ok={!!form.item} class:error={!form.item}>{form.message}</p>
      {/if}

      <button type="submit">บันทึกรับเข้า</button>
    </form>

    <section class="recent">
      <div class="section-head">
        <h2>รับเข้าล่าสุด</h2>
        <span>{data.recent.length} รายการ</span>
      </div>
      {#if data.recent.length}
        <div class="rows">
          {#each data.recent as tx}
            <article>
              <div>
                <strong>{tx.drug_name}</strong>
                <span>+{tx.qty} · {tx.to_location_name || 'ไม่ระบุ'}{tx.lot_no ? ` · Lot ${tx.lot_no}` : ''}</span>
              </div>
              <small>{tx.expiry_date}</small>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">ยังไม่มีรายการรับเข้า</p>
      {/if}
    </section>
  </section>
</main>

<style>
  .receive-shell {
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
    max-width: 460px;
    color: #666174;
    line-height: 1.5;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
    gap: 16px;
  }

  .quick-tools {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
    padding: 16px;
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .scan-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
  }

  .receive-form,
  .recent {
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .receive-form {
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  label {
    display: grid;
    gap: 7px;
    font-weight: 700;
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
    min-height: 46px;
    border: 0;
    border-radius: 8px;
    background: #5b3fc2;
    color: #fff;
    font: inherit;
    font-weight: 800;
  }

  .export-link {
    display: inline-grid;
    place-items: center;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 8px;
    background: #067647;
    color: #fff;
    font-weight: 800;
    text-decoration: none;
    white-space: nowrap;
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

  .recent {
    padding: 16px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .section-head span,
  article span,
  article small,
  .empty {
    color: #666174;
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
  }

  @media (min-width: 780px) {
    .receive-shell {
      padding-left: 196px;
    }
  }

  @media (max-width: 820px) {
    .page-head,
    .content-grid,
    .quick-tools,
    .scan-form,
    article {
      align-items: stretch;
      display: flex;
      flex-direction: column;
    }
  }
</style>
