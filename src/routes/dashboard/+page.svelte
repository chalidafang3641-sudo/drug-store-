<script>
  import { goto } from '$app/navigation';
  import LowStockSheet from '$lib/components/dashboard/LowStockSheet.svelte';
  import { openSheet } from '$lib/client/sheet.js';
  import { onDestroy } from 'svelte';

  export let data;

  let summary = {};
  let thresholds = {};
  let near = [];
  let lowStock = [];
  let byLocation = [];
  let searchResults = [];

  let filter = 'all';
  let byLocView = false;
  let searchInput;
  let searchTimer;

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  let cards = [];

  function expiryBucket(days) {
    if (days <= (thresholds.critical || 35)) return { cls: 'chip-crit', label: `${days} วัน` };
    if (days <= (thresholds.high || 60)) return { cls: 'chip-high', label: `${days} วัน` };
    if (days <= (thresholds.medium || 120)) return { cls: 'chip-med', label: `${days} วัน` };
    return { cls: 'chip-safe', label: `${days} วัน` };
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function drugThumb(imageUrl) {
    return imageUrl
      ? { image: imageUrl, placeholder: false }
      : { image: '', placeholder: true };
  }

  function lowStockLabel(item) {
    return item.min_qty ? `ขั้นต่ำ ${item.min_qty} ${item.unit || ''}` : 'ต่ำกว่าขั้นต่ำ';
  }

  function showLowStockSheet() {
    openSheet({
      title: 'ยาสต็อกต่ำ',
      component: LowStockSheet,
      props: {
        items: lowStock
      }
    });
  }

  function queueSearchSubmit() {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const q = searchInput?.value?.trim() || '';
      const nextUrl = q ? `/dashboard?q=${encodeURIComponent(q)}` : '/dashboard';
      goto(nextUrl, {
        keepFocus: true,
        noScroll: true,
        replaceState: true
      });
    }, 300);
  }

  onDestroy(() => {
    clearTimeout(searchTimer);
  });

  $: summary = data.summary || {};
  $: thresholds = data.thresholds || {};
  $: near = data.near || [];
  $: lowStock = data.lowStock || [];
  $: byLocation = data.byLocation || [];
  $: searchResults = data.searchResults || [];
  $: cards = [
    { id: 'crit', icon: 'bi-exclamation-triangle-fill', label: `ภายใน ${thresholds.critical || 35} วัน`, value: summary.within35 || 0, tone: 'crit' },
    { id: 'high', icon: 'bi-calendar-event-fill', label: `ภายใน ${thresholds.high || 60} วัน`, value: summary.within60 || 0, tone: 'high' },
    { id: 'med', icon: 'bi-calendar3', label: `ภายใน ${thresholds.medium || 120} วัน`, value: summary.within120 || 0, tone: 'med' },
    { id: '', icon: 'bi-check2-circle', label: `มากกว่า ${thresholds.medium || 120} วัน`, value: summary.over120 || 0, tone: 'safe' }
  ];

  $: filteredNear = near.filter((item) => {
    if (filter === 'crit') return item.days <= (thresholds.critical || 35);
    if (filter === 'high') return item.days > (thresholds.critical || 35) && item.days <= (thresholds.high || 60);
    if (filter === 'med') return item.days > (thresholds.high || 60) && item.days <= (thresholds.medium || 120);
    return true;
  });

  $: listTitle = data.q
    ? 'ผลการค้นหา'
    : byLocView
      ? 'ใกล้หมดอายุ แยกสถานที่'
      : filter === 'crit'
        ? `ใกล้หมดอายุ ภายใน ${thresholds.critical || 35} วัน`
        : filter === 'high'
          ? `ใกล้หมดอายุ ${(thresholds.critical || 35) + 1}-${thresholds.high || 60} วัน`
          : filter === 'med'
            ? `ใกล้หมดอายุ ${(thresholds.high || 60) + 1}-${thresholds.medium || 120} วัน`
            : 'รายการใกล้หมดอายุ';
</script>

<main class="dashboard-shell">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;gap:12px;flex-wrap:wrap">
    <div>
      <div class="page-title" style="margin-bottom:0">ภาพรวม</div>
      <div class="page-sub" style="margin:2px 0 0">{today}</div>
    </div>
  </div>

  <div id="statGrid" class="stat-grid">
    {#each cards as card}
      <button
        type="button"
        class={`stat-card ${card.tone} ${card.id ? 'tappable' : ''} ${filter === card.id ? 'on' : ''}`}
        onclick={() => {
          if (!card.id) return;
          filter = filter === card.id ? 'all' : card.id;
          byLocView = false;
        }}
      >
        <i class={`bi ${card.icon} stat-ic`}></i>
        <div class="stat-num">{card.value}</div>
        <div class="stat-label">{card.label}</div>
      </button>
    {/each}
  </div>

  <div id="lowStockBox">
    {#if lowStock.length}
      <button class="low-banner" type="button" onclick={showLowStockSheet}>
        <i class="bi bi-box-seam-fill"></i>
        <span>สต็อกต่ำกว่าขั้นต่ำ {lowStock.length} รายการ</span>
        <i class="bi bi-chevron-right"></i>
      </button>
    {/if}
  </div>

  <form class="search-wrap" method="GET">
    <i class="bi bi-search"></i>
    <input
      bind:this={searchInput}
      name="q"
      autocomplete="off"
      placeholder="ค้นหาชื่อยา, สถานที่, Lot"
      value={data.q || ''}
      oninput={queueSearchSubmit}
    />
    {#if data.q}
      <a class="clear-link" href="/dashboard" aria-label="ล้างคำค้น">
        <i class="bi bi-x-circle-fill clear"></i>
      </a>
    {/if}
  </form>

  <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 4px 12px;gap:12px;flex-wrap:wrap">
    <div class="section-label" style="margin:0">{listTitle}</div>
    {#if !data.q}
      <button id="byLocToggle" class="link-btn" type="button" onclick={() => { byLocView = !byLocView; }}>
        {byLocView ? 'ดูเป็นรายการ' : 'ดูแยกสถานที่'}
      </button>
    {/if}
  </div>

  <div id="dashList">
    {#if data.q}
      {#if searchResults.length}
        {#each searchResults as item}
          {@const thumb = drugThumb(item.image_url)}
          {@const bucket = expiryBucket(item.days)}
          <div class="scan-row">
            {#if thumb.placeholder}
              <div class="thumb thumb-ph"><i class="bi bi-capsule-pill"></i></div>
            {:else}
              <div class="thumb"><img src={thumb.image} alt="" /></div>
            {/if}
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{item.drug_name}</div>
              <div class="hint" style="margin:2px 0 0">{item.location_name || ''} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</div>
            </div>
            <div style="text-align:right">
              <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
              <div class="hint" style="margin:3px 0 0">{formatDate(item.expiry_date)}</div>
            </div>
          </div>
        {/each}
      {:else}
        <div class="empty-state">
          <div class="es-title">ไม่พบรายการ</div>
          <div>ลองคำค้นอื่น</div>
        </div>
      {/if}
    {:else if summary.total_items === 0}
      <div class="empty-state" style="padding:54px 20px">
        <div class="es-icon"><i class="bi bi-capsule"></i></div>
        <div class="es-title">ยังไม่มีรายการยา</div>
        <div>แตะปุ่มรับเข้าเพื่อเพิ่มรายการแรก</div>
      </div>
    {:else if byLocView}
      {#if byLocation.length}
        {#each byLocation as item}
          <a class="menu-item byloc-link" href={`/stock?location_id=${encodeURIComponent(item.location_id || item.id || '')}`}>
            <div class="mi-icon"><i class="bi bi-geo-alt-fill"></i></div>
            <div class="mi-body">
              <div class="mi-title">{item.location_name || 'ไม่ระบุ'}</div>
              <div class="mi-desc">ใกล้หมดอายุ {item.count} รายการ · รวม {item.qty}</div>
            </div>
            <div class="num" style="color:var(--brand-strong)">{item.count}</div>
          </a>
        {/each}
      {:else}
        <div class="hint">ไม่มีรายการใกล้หมดอายุ</div>
      {/if}
    {:else if filteredNear.length}
      {#each filteredNear as item}
        {@const thumb = drugThumb(item.image_url)}
        {@const bucket = expiryBucket(item.days)}
        <div class="scan-row">
          {#if thumb.placeholder}
            <div class="thumb thumb-ph"><i class="bi bi-capsule-pill"></i></div>
          {:else}
            <div class="thumb"><img src={thumb.image} alt="" /></div>
          {/if}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">{item.drug_name}</div>
            <div class="hint" style="margin:2px 0 0">{item.location_name || ''} · จำนวน {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</div>
          </div>
          <div style="text-align:right">
            <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
            <div class="hint" style="margin:3px 0 0">{formatDate(item.expiry_date)}</div>
          </div>
        </div>
      {/each}
    {:else}
      <div class="empty-state">
        <div class="es-title">ไม่มีรายการในช่วงนี้</div>
      </div>
    {/if}
  </div>
</main>

<style>
  .dashboard-shell {
    padding: 0;
  }

  #lowStockBox {
    margin-bottom: 18px;
  }

  .clear-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .byloc-link {
    text-decoration: none;
    color: inherit;
  }

  @media (max-width: 720px) {
    #dashList .scan-row {
      align-items: flex-start;
    }
  }
</style>
