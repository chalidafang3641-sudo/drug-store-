<script>
  export let data;

  const branding = data.branding || {};
  const counts = data.counts || {};
</script>

<svelte:head>
  <title>{branding.hospital_name || 'The Watcher'} | Drug Store</title>
</svelte:head>

<main class="migration-shell">
  <section class="migration-hero">
    {#if branding.logo_url}
      <img class="brand-logo" src={branding.logo_url} alt="" />
    {/if}
    <div>
      <p class="eyebrow">SvelteKit migration</p>
      <h1>{branding.hospital_name || 'The Watcher'}</h1>
      <p class="summary">หน้า SvelteKit แรกเชื่อมกับข้อมูล Drug Store แล้ว และ API เดิมพร้อมใช้งานที่ <code>/api</code></p>
    </div>
  </section>

  <section class="metric-grid" aria-label="ภาพรวมข้อมูล">
    <article>
      <span>สถานที่เก็บยา</span>
      <strong>{counts.locations ?? 0}</strong>
    </article>
    <article>
      <span>รายการยา</span>
      <strong>{counts.drugs ?? 0}</strong>
    </article>
    <article>
      <span>Stock active</span>
      <strong>{counts.activeItems ?? 0}</strong>
    </article>
  </section>

  <nav class="route-list" aria-label="Routes ถัดไป">
    <a href="/api?action=branding">ทดสอบ API branding</a>
    <a href="/dashboard">Dashboard route placeholder</a>
    <a href="/receive">Receive route placeholder</a>
  </nav>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f7f7fb;
    color: #1d1b25;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .migration-shell {
    width: min(960px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 40px 0;
  }

  .migration-hero {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px 0 28px;
    border-bottom: 1px solid #dedbe8;
  }

  .brand-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #dedbe8;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: #5b3fc2;
    font-size: 0.84rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    line-height: 1.1;
  }

  .summary {
    margin: 10px 0 0;
    max-width: 620px;
    color: #5f5a6b;
    line-height: 1.6;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 24px 0;
  }

  article {
    padding: 16px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #dedbe8;
  }

  article span {
    display: block;
    color: #6b6675;
    font-size: 0.9rem;
  }

  article strong {
    display: block;
    margin-top: 8px;
    font-size: 2rem;
  }

  .route-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .route-list a {
    color: #463098;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .migration-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .metric-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
