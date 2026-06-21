<script>
  import { browser } from '$app/environment';
  import { navigating, page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { closeSheet, sheetState } from '$lib/client/sheet.js';

  export let data;

  const navItems = [
    { href: '/dashboard', label: 'หน้าหลัก', icon: 'house-door-fill' },
    { href: '/stock', label: 'ยาแต่ละจุด', icon: 'geo-alt-fill' },
    { href: '/receive', label: 'รับเข้า', icon: 'upc-scan', fab: true },
    { href: '/exchange', label: 'แลกยา', icon: 'arrow-left-right' },
    { href: '/settings', label: 'ตั้งค่า', icon: 'gear-fill' }
  ];

  const roleLabels = {
    admin: 'ผู้ดูแลระบบ',
    pharmacist: 'เภสัชกร',
    staff: 'เจ้าหน้าที่'
  };

  function roleLabel(role) {
    return roleLabels[role] || role || '';
  }

  function userMeta(user) {
    const username = user?.username || '';
    const role = roleLabel(user?.role);
    if (username && role) return `${username} · ${role}`;
    return username || role;
  }

  function isActive(href) {
    const pathname = $page.url.pathname;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  let toasts = [];
  let lastToastKey = '';
  let toastSeq = 0;
  const toastTimers = new Map();

  function enqueueToast(message, type = 'ok') {
    const text = String(message || '').trim();
    if (!browser || !text) return;
    const key = `${type}:${text}`;
    if (key === lastToastKey) return;
    lastToastKey = key;

    const id = ++toastSeq;
    toasts = [...toasts, { id, message: text, type }];

    const timer = window.setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
      toastTimers.delete(id);
      if (!toasts.length) {
        lastToastKey = '';
      }
    }, 2600);

    toastTimers.set(id, timer);
  }

  $: if (browser) {
    const status = $page.status || 200;
    const formMessage = $page.form?.message;
    if (formMessage) {
      enqueueToast(formMessage, $page.form?.ok || status < 400 ? 'ok' : 'err');
    } else {
      const urlMessage = $page.url.searchParams.get('message');
      if (urlMessage) {
        enqueueToast(urlMessage, 'ok');
      }
    }
  }

  $: if (browser && $page.url.href) {
    closeSheet();
  }

  function handleSheetKeydown(event) {
    if (event.key === 'Escape') {
      closeSheet();
    }
  }

  onDestroy(() => {
    for (const timer of toastTimers.values()) {
      clearTimeout(timer);
    }
    toastTimers.clear();
  });
</script>

<svelte:head>
  <title>{data.branding?.hospital_name || 'The Watcher'}</title>
</svelte:head>

{#if data.user}
  <div id="main">
    <header id="appHeader">
      <a class="logo-box" id="hLogo" href="/dashboard" aria-label="กลับหน้าหลัก">
        {#if data.branding?.logo_url}
          <img src={data.branding.logo_url} alt="" />
        {:else}
          <i class="bi bi-capsule-pill"></i>
        {/if}
      </a>
      <div>
        <div class="h-title" id="hTitle">{data.branding?.hospital_name || 'The Watcher'}</div>
        <div class="h-sub">ระบบแจ้งเตือนวันหมดอายุของยา</div>
      </div>
    </header>

    <div id="view">
      <slot />
    </div>

    <div class="toast-host" id="toastHost" aria-live="polite" aria-atomic="true">
      {#each toasts as toast (toast.id)}
        <div class={`toast ${toast.type || ''}`}>{toast.message}</div>
      {/each}
    </div>

    <div id="loadingOverlay" class:show={!!$navigating} aria-live="polite" aria-hidden={!$navigating}>
      <div class="lo-card">
        <span class="spin spin-brand"></span>
        <div class="lo-text">กำลังโหลด</div>
      </div>
    </div>

    {#if $sheetState.open}
      <div
        class="sheet-overlay show"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        on:click={(event) => {
          if (event.target === event.currentTarget) {
            closeSheet();
          }
        }}
        on:keydown={handleSheetKeydown}
      >
        <div class="sheet">
          <div class="sheet-head">
            <span>{$sheetState.title}</span>
            <button class="sheet-x" type="button" aria-label="ปิด" on:click={closeSheet}>
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="sheet-body">
            {#if $sheetState.component}
              <svelte:component this={$sheetState.component} {...$sheetState.props} />
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <nav id="bottomNav" aria-label="เมนูหลัก">
      <div class="nav-brand" aria-hidden="true">
        <div class="nav-brand-mark">
          {#if data.branding?.logo_url}
            <img src={data.branding.logo_url} alt="" />
          {:else}
            <i class="bi bi-capsule-pill"></i>
          {/if}
        </div>
        <div class="nav-brand-copy">
          <strong>{data.branding?.hospital_name || 'The Watcher'}</strong>
          <span>ระบบแจ้งเตือนวันหมดอายุของยา</span>
        </div>
      </div>
      {#each navItems as item}
        {#if item.fab}
          <div class="fab-wrap">
            <a class="fab nav-btn" class:active={isActive(item.href)} href={item.href} aria-label={item.label}>
              <i class={`bi bi-${item.icon}`}></i>
            </a>
            <span class="fab-label">{item.label}</span>
          </div>
        {:else}
          <a class="nav-btn" class:active={isActive(item.href)} href={item.href}>
            <i class={`bi bi-${item.icon}`}></i>
            <span>{item.label}</span>
          </a>
        {/if}
      {/each}

      <div class="nav-footer">
        <a class="nav-meta-link" href="/settings?tab=account">
          <strong>{data.user?.name || data.user?.username || 'ผู้ใช้'}</strong>
          <span>{userMeta(data.user)}</span>
        </a>
        <a class="nav-logout" href="/logout">
          <i class="bi bi-box-arrow-right"></i>
          <span>ออกจากระบบ</span>
        </a>
      </div>
    </nav>
  </div>
{:else}
  <slot />
{/if}

<style>
  :global(body) {
    margin: 0;
    background: var(--bg, #f7f7fb);
    color: var(--ink, #1d1b25);
    font-family: "Sarabun", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    letter-spacing: 0.1px;
  }

  :global(.bi) {
    font-style: normal;
  }

  #bottomNav a,
  #appHeader a {
    text-decoration: none;
  }

  #view :global(main.dashboard-shell),
  #view :global(main.stock-shell),
  #view :global(main.receive-shell),
  #view :global(main.exchange-shell),
  #view :global(main.settings-shell) {
    width: 100%;
    margin: 0;
    padding: 0;
  }
</style>
