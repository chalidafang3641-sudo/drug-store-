<script>
  import { enhance } from '$app/forms';

  export let data;
  export let form;

  let selectedItemId = form?.values?.item_id || data.selectedItemId || '';
  let exchangeSubmitting = false;

  $: values = form?.values || { item_id: '', to_location_id: '', qty: 1 };
  $: if (!selectedItemId && (form?.values?.item_id || data.selectedItemId)) {
    selectedItemId = form?.values?.item_id || data.selectedItemId;
  }
  $: selectedItem = data.searchResults.find((item) => String(item.id) === String(selectedItemId || values.item_id)) || null;
  $: destinationOptions = selectedItem
    ? data.locations.filter((location) => String(location.id) !== String(selectedItem.location_id))
    : data.locations;

  function expiryBucket(days) {
    if (days <= 30) return { cls: 'chip-crit', label: 'ใกล้หมดมาก' };
    if (days <= 60) return { cls: 'chip-high', label: 'ใกล้หมด' };
    if (days <= 120) return { cls: 'chip-med', label: 'ควรเฝ้าระวัง' };
    return { cls: 'chip-safe', label: 'ยังปลอดภัย' };
  }

  function drugThumb(imageUrl) {
    return imageUrl || '/images/drug-placeholder.svg';
  }

  function enhanceExchange() {
    exchangeSubmitting = true;

    return async ({ update }) => {
      await update();
      exchangeSubmitting = false;
    };
  }
</script>

<main class="exchange-shell">
  <div class="page-title">แลกยา</div>

  <div id="exBody">
    {#if !selectedItem}
      <div class="page-sub">ค้นหายาที่ต้องการย้าย แล้วเลือกสถานที่ปลายทาง</div>

      <form method="GET">
        <div class="search-wrap">
          <i class="bi bi-search"></i>
          <input name="q" value={data.q || ''} autocomplete="off" placeholder="ค้นหาชื่อยา, สถานที่, Lot" />
        </div>
      </form>

      <div id="exList" class="exchange-list">
        {#if data.searchResults.length}
          {#each data.searchResults as item}
            {@const thumb = drugThumb(item.image_url)}
            {@const bucket = expiryBucket(item.days)}
            <button class="menu-item" type="button" onclick={() => (selectedItemId = item.id)}>
              <div class="thumb" aria-hidden="true">
                <img src={thumb} alt="" loading="lazy" />
              </div>
              <div class="mi-body">
                <div class="mi-title">{item.drug_name}</div>
                <div class="mi-desc">{item.location_name || ''} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</div>
              </div>
              <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
            </button>
          {/each}
        {:else if data.q}
          <div class="hint">ไม่พบรายการ</div>
        {:else}
          <div class="hint">พิมพ์เพื่อค้นหารายการที่จะย้าย</div>
        {/if}
      </div>
    {:else}
      {@const thumb = drugThumb(selectedItem.image_url)}
      {@const bucket = expiryBucket(selectedItem.days)}

      <button class="btn-ghost back-btn" type="button" onclick={() => (selectedItemId = '')}>
        <i class="bi bi-chevron-left"></i>
        <span>กลับ</span>
      </button>

      <div class="card-soft picked-item">
        <div class="thumb" aria-hidden="true">
          <img src={thumb} alt="" loading="lazy" />
        </div>
        <div class="picked-copy">
          <div class="picked-name">{selectedItem.drug_name}</div>
          <div class="hint">จาก {selectedItem.location_name || ''} · มี {selectedItem.qty}{selectedItem.lot_no ? ` · Lot ${selectedItem.lot_no}` : ''}</div>
        </div>
        <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
      </div>

      <form method="POST" class="exchange-form" use:enhance={enhanceExchange}>
        <input type="hidden" name="item_id" value={selectedItem.id} />

        <div class="field">
          <label for="exDest">ย้ายไปที่ <span class="req-mark">*</span></label>
          <select id="exDest" name="to_location_id" required>
            {#if destinationOptions.length}
              {#each destinationOptions as location}
                <option value={location.id} selected={values.to_location_id === location.id}>{location.name}</option>
              {/each}
            {:else}
              <option value="">ไม่มีสถานที่อื่น</option>
            {/if}
          </select>
        </div>

        <div class="field">
          <label for="exQty">จำนวนที่ย้าย <span class="req-mark">*</span></label>
          <div class="qty-row">
            <button
              class="qty-btn"
              type="button"
              onclick={() => {
                const input = document.getElementById('exQty');
                input.value = String(Math.max(1, (parseInt(input.value, 10) || 1) - 1));
              }}
            >
              -
            </button>
            <input id="exQty" name="qty" type="number" min="1" max={selectedItem.qty} inputmode="numeric" value={values.qty || selectedItem.qty} required />
            <span class="qty-unit">/ {selectedItem.qty}</span>
            <button
              class="qty-btn"
              type="button"
              onclick={() => {
                const input = document.getElementById('exQty');
                input.value = String(Math.min(selectedItem.qty, (parseInt(input.value, 10) || 0) + 1));
              }}
            >
              +
            </button>
          </div>
        </div>

        {#if form?.message}
          <p class:ok={!form.values} class:error={!!form.values} class="status-note">{form.message}</p>
        {/if}

        <button class="btn-brand submit-btn" type="submit" disabled={exchangeSubmitting}>
          <i class="bi bi-arrow-left-right"></i>
          <span>{exchangeSubmitting ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}</span>
        </button>
      </form>
    {/if}
  </div>

  <div class="section-label">ย้ายล่าสุด</div>
  <div id="exRecent">
    {#if data.recent.length}
      {#each data.recent as tx}
        <div class="scan-row">
          <div class="recent-copy">
            <div class="recent-name">{tx.drug_name}</div>
            <div class="hint">{tx.from_location_name || ''} <i class="bi bi-arrow-right"></i> {tx.to_location_name || ''}</div>
          </div>
          <div class="num recent-qty">{tx.qty}</div>
        </div>
      {/each}
    {:else}
      <div class="hint">ยังไม่มีรายการ</div>
    {/if}
  </div>
</main>

<style>
  .exchange-shell {
    padding-bottom: 86px;
  }

  .exchange-list {
    margin-top: 14px;
  }

  .back-btn {
    width: auto;
    margin-bottom: 16px;
  }

  .picked-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }

  .picked-copy {
    min-width: 0;
    flex: 1;
  }

  .picked-name,
  .recent-name {
    font-weight: 600;
  }

  .req-mark {
    color: var(--danger);
  }

  .status-note {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    font-weight: 700;
  }

  .ok {
    background: #ecfdf3;
    color: #067647;
  }

  .error {
    background: #fef3f2;
    color: #b42318;
  }

  .submit-btn {
    width: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .recent-copy {
    min-width: 0;
    flex: 1;
  }

  .recent-qty {
    color: var(--brand-strong);
  }

  @media (max-width: 720px) {
    .picked-item {
      flex-wrap: wrap;
    }

    .submit-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
