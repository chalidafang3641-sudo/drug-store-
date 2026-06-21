<script>
  export let items = [];

  function drugThumb(imageUrl) {
    return imageUrl || '/images/drug-placeholder.svg';
  }

  function lowStockLabel(item) {
    return item.min_qty ? `ขั้นต่ำ ${item.min_qty} ${item.unit || ''}` : 'ต่ำกว่าขั้นต่ำ';
  }
</script>

{#if items.length}
  <div class="low-sheet-list">
    {#each items as item}
      {@const thumb = drugThumb(item.image_url)}
      <div class="scan-row">
        <div class="thumb" aria-hidden="true">
          <img src={thumb} alt="" loading="lazy" />
        </div>
        <div class="low-sheet-copy">
          <div class="low-sheet-name">{item.name}</div>
          <div class="hint">{lowStockLabel(item)}</div>
        </div>
        <div class="low-sheet-meta">
          <div class="num low-sheet-total">{item.total}</div>
          <div class="hint">คงเหลือ</div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="hint">ไม่มี</div>
{/if}

<style>
  .low-sheet-list {
    display: grid;
    gap: 12px;
  }

  .low-sheet-copy {
    flex: 1;
    min-width: 0;
  }

  .low-sheet-name {
    font-weight: 600;
  }

  .low-sheet-meta {
    text-align: right;
  }

  .low-sheet-total {
    color: var(--danger);
    font-weight: 700;
  }
</style>
