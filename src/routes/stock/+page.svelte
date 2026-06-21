<script>
  import DisposeSheet from '$lib/components/stock/DisposeSheet.svelte';
  import { openSheet } from '$lib/client/sheet.js';

  export let data;
  export let form;

  function expiryBucket(days) {
    if (days <= 30) return { cls: 'chip-crit', label: 'ใกล้หมดมาก' };
    if (days <= 60) return { cls: 'chip-high', label: 'ใกล้หมด' };
    if (days <= 120) return { cls: 'chip-med', label: 'ควรเฝ้าระวัง' };
    return { cls: 'chip-safe', label: 'ยังปลอดภัย' };
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  function drugThumb(imageUrl) {
    return imageUrl || '/images/drug-placeholder.svg';
  }

  function showDisposeSheet(item) {
    openSheet({
      title: 'ตัดจ่าย / ทิ้งยา',
      component: DisposeSheet,
      props: {
        item,
        selectedLocationId: data.selected?.id || 'all'
      }
    });
  }
</script>

<main class="stock-shell">
  {#if !data.selected}
    <div class="page-title">ยาแต่ละจุด</div>
    <div class="page-sub">เลือกสถานที่เพื่อจัดการรายการ</div>

    <div id="stockGrid" class="loc-grid" aria-label="สถานที่เก็บยา">
      {#each data.locations as location}
        <a class="loc-tile" href={`/stock?location_id=${encodeURIComponent(location.id)}`} aria-label={`ดูรายการใน ${location.name}`}>
          <div class="lt-top">
            <div
              class="mi-icon lt-ic"
              style={`background:${location.color ? `${location.color}20` : 'var(--brand-soft)'};color:${location.color || 'var(--brand-strong)'}`}
            >
              <i class={`bi ${location.id === 'all' ? 'bi-box-seam' : 'bi-geo-alt'}`}></i>
            </div>
            <div class="lt-count num">{location.count}</div>
          </div>
          <div class="lt-name">{location.name}</div>
          <div class="lt-qty">รวมจำนวน {location.qty}</div>
        </a>
      {/each}
    </div>
  {:else}
    <a class="btn-ghost back-btn" href="/stock">
      <i class="bi bi-chevron-left"></i>
      <span>กลับ</span>
    </a>

    <div class="page-title">{data.selected.name}</div>
    <div class="page-sub">รายการยาในจุดนี้ เรียงตามวันใกล้หมดอายุ</div>

    {#if data.message || form?.message}
      <p class:ok={!!data.message} class:error={!data.message} class="status-note">{data.message || form.message}</p>
    {/if}

    <div id="stItems">
      {#if data.items.length}
        {#each data.items as item}
          {@const thumb = drugThumb(item.image_url)}
          {@const bucket = expiryBucket(item.days)}
          <article class="card-soft stock-card">
            <div class="stock-head">
              <div class="stock-main">
                <div class="thumb" aria-hidden="true">
                  <img src={thumb} alt="" loading="lazy" />
                </div>
                <div class="stock-copy">
                  <div class="stock-name">{item.drug_name}</div>
                  <div class="hint">
                    {item.location_name || data.selected.name} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}
                  </div>
                </div>
              </div>

              <div class="stock-meta">
                <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
                <div class="hint">{formatDate(item.expiry_date)}</div>
              </div>
            </div>

            <div class="stock-actions">
              <a class="btn-ghost stock-btn" href={`/exchange?q=${encodeURIComponent(item.drug_name)}&item_id=${encodeURIComponent(item.id)}`}>
                <i class="bi bi-arrow-left-right"></i>
                <span>ย้าย</span>
              </a>
              <button
                class="btn-ghost stock-btn danger-btn"
                type="button"
                onclick={() => showDisposeSheet(item)}
              >
                <i class="bi bi-dash-circle"></i>
                <span>ตัดจ่าย / ทิ้ง</span>
              </button>
            </div>
          </article>
        {/each}
      {:else}
        <div class="empty-state">
          <div class="es-title">ยังไม่มียาในจุดนี้</div>
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  .stock-shell {
    padding-bottom: 86px;
  }

  .back-btn {
    width: auto;
    margin-bottom: 16px;
    text-decoration: none;
  }

  .loc-tile {
    text-decoration: none;
    color: inherit;
  }

  .status-note {
    margin: 0 0 12px;
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

  #stItems {
    margin-top: 4px;
  }

  .stock-card {
    padding: 14px 16px;
    margin-bottom: 12px;
  }

  .stock-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .stock-main {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex: 1;
  }

  .stock-copy {
    min-width: 0;
  }

  .stock-name {
    font-weight: 600;
  }

  .stock-meta {
    text-align: right;
  }

  .stock-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .stock-btn {
    width: auto;
    text-decoration: none;
  }

  .danger-btn {
    color: var(--danger);
    background: transparent;
  }

  @media (max-width: 720px) {
    .stock-head {
      flex-direction: column;
    }

    .stock-meta {
      text-align: left;
    }

    .stock-actions {
      flex-wrap: wrap;
    }
  }
</style>
