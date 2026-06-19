<script>
  export let data;

  const navItems = [
    { href: '/dashboard', label: 'ภาพรวม' },
    { href: '/stock', label: 'ยาแต่ละจุด' },
    { href: '/receive', label: 'รับเข้า' },
    { href: '/exchange', label: 'แลกยา' },
    { href: '/settings', label: 'ตั้งค่า' }
  ];
</script>

<svelte:head>
  <title>{data.branding?.hospital_name || 'The Watcher'}</title>
</svelte:head>

{#if data.user}
  <header class="app-top">
    <a class="brand" href="/dashboard">
      {#if data.branding?.logo_url}
        <img src={data.branding.logo_url} alt="" />
      {/if}
      <span>{data.branding?.hospital_name || 'The Watcher'}</span>
    </a>
    <a class="logout" href="/logout">ออก</a>
  </header>
{/if}

<slot />

{#if data.user}
  <nav class="bottom-nav" aria-label="เมนูหลัก">
    {#each navItems as item}
      <a href={item.href}>{item.label}</a>
    {/each}
  </nav>
{/if}

<style>
  :global(body) {
    margin: 0;
    background: #f7f7fb;
    color: #1d1b25;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .app-top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 56px;
    padding: 0 20px;
    background: rgba(255, 255, 255, 0.92);
    border-bottom: 1px solid #dedbe8;
    backdrop-filter: blur(12px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    font-weight: 800;
    text-decoration: none;
  }

  .brand img {
    width: 34px;
    height: 34px;
    object-fit: contain;
    border-radius: 6px;
  }

  .logout {
    color: #5b3fc2;
    font-weight: 700;
    text-decoration: none;
  }

  .bottom-nav {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: #fff;
    border-top: 1px solid #dedbe8;
  }

  .bottom-nav a {
    min-height: 54px;
    display: grid;
    place-items: center;
    color: #4d4858;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
  }

  @media (min-width: 780px) {
    .bottom-nav {
      right: auto;
      bottom: auto;
      left: 0;
      top: 56px;
      width: 180px;
      height: calc(100vh - 56px);
      grid-template-columns: 1fr;
      grid-auto-rows: 52px;
      align-content: start;
      border-top: 0;
      border-right: 1px solid #dedbe8;
    }
  }
</style>
