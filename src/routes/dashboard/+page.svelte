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

  $: filter = data.filter;
  $: reportUrl = '/settings/report?kind=near&filter=' + filter;
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
    if (days <= (thresholds.critical ?? 35)) return { cls: 'chip-crit', label: `${days} วัน` };
    if (days <= (thresholds.high ?? 60)) return { cls: 'chip-high', label: `${days} วัน` };
    if (days <= (thresholds.medium ?? 120)) return { cls: 'chip-med', label: `${days} วัน` };
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
    { id: 'crit', icon: 'bi-exclamation-triangle-fill', label: `ภายใน ${thresholds.critical ?? 35} วัน`, value: summary.within35 || 0, tone: 'crit' },
    { id: 'high', icon: 'bi-calendar-event-fill', label: `${(thresholds.critical ?? 35) + 1}–${thresholds.high ?? 60} วัน`, value: summary.within60 || 0, tone: 'high' },
    { id: 'med', icon: 'bi-calendar3', label: `${(thresholds.high ?? 60) + 1}–${thresholds.medium ?? 120} วัน`, value: summary.within120 || 0, tone: 'med' },
    { id: '', icon: 'bi-check2-circle', label: `มากกว่า ${thresholds.medium ?? 120} วัน`, value: summary.over120 || 0, tone: 'safe' }
  ];

  $: listTitle = data.q
    ? 'ผลการค้นหา'
    : byLocView
      ? 'ใกล้หมดอายุ แยกสถานที่'
      : filter === 'crit'
        ? `ใกล้หมดอายุ ภายใน ${thresholds.critical ?? 35} วัน`
        : filter === 'high'
          ? `ใกล้หมดอายุ ${(thresholds.critical ?? 35) + 1}-${thresholds.high ?? 60} วัน`
          : filter === 'med'
            ? `ใกล้หมดอายุ ${(thresholds.high ?? 60) + 1}-${thresholds.medium ?? 120} วัน`
            : 'รายการใกล้หมดอายุ';
</script>

<svelte:head><link rel="stylesheet" href="/css/pagination.css" /></svelte:head>

<main class="dashboard-shell">
  <header class="overview-header">
    <div class="page-title">ภาพรวม</div>
    <a class="btn-ghost" href={reportUrl + '&format=xlsx'} download="expiry-report.xlsx">
      <i class="bi bi-download" aria-hidden="true"></i> ดาวน์โหลด Excel
    </a>
    <div class="page-sub">{today}</div>
  </header>

  <div id="statGrid" class="stat-grid">
    {#each cards as card}
      <button
        type="button"
        class={`stat-card ${card.tone} ${card.id ? 'tappable' : ''} ${filter === card.id ? 'on' : ''}`}
        onclick={() => {
          if (!card.id) return;
          goto('/dashboard?filter=' + (filter === card.id ? 'all' : card.id) + '&size=' + data.size, { noScroll: true });
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

  {#if !data.q && !byLocView}
    <nav class="pager pager-inline" aria-label="หน้ารายการยาใกล้หมดอายุ">
      <select aria-label="จำนวนรายการต่อหน้า" value={data.size}
        onchange={(event) => goto(`/dashboard?filter=${filter}&size=${event.currentTarget.value}`, { noScroll: true, keepFocus: true })}>
        {#each [10, 25, 50, 100] as size}<option value={size}>{size} / หน้า</option>{/each}
      </select>
      <div class="pager-position">
        <strong>{data.total ? (data.page - 1) * data.size + 1 : 0}–{Math.min(data.page * data.size, data.total)} / {data.total}</strong>
      <div class="pager-steps">
        <a class="pager-arrow" aria-label="ก่อนหน้า" aria-disabled={data.page <= 1} href={data.page > 1 ? `/dashboard?filter=${filter}&size=${data.size}&page=${data.page - 1}` : undefined}>‹</a>
        <span aria-current="page" aria-label={`หน้า ${data.page} จาก ${data.pages}`}><b>{data.page}</b>/{data.pages}</span>
        <a class="pager-arrow" aria-label="ถัดไป" aria-disabled={data.page >= data.pages} href={data.page < data.pages ? `/dashboard?filter=${filter}&size=${data.size}&page=${data.page + 1}` : undefined}>›</a>
      </div>
      </div>
    </nav>
  {/if}
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
    {:else if near.length}
      {#each near as item}
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
  .overview-header { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 12px; margin-bottom: 14px; }
  .overview-header .page-title, .overview-header .page-sub { margin: 0; }
  .overview-header .page-sub { grid-column: 1 / -1; }
  .overview-header a { justify-self: end; white-space: nowrap; }
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
