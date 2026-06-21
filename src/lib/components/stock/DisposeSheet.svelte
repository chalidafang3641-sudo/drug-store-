<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';

  export let item;
  export let selectedLocationId = 'all';

  const reasons = ['เบิกใช้', 'หมดอายุ', 'ชำรุด/เสียหาย', 'อื่นๆ'];

  let qty = 1;
  let submitting = false;

  function decQty() {
    qty = Math.max(1, Number(qty || 1) - 1);
  }

  function incQty() {
    qty = Math.min(Number(item?.qty || 1), Number(qty || 0) + 1);
  }

  function enhanceDispose() {
    submitting = true;

    return async ({ update }) => {
      await update();
      submitting = false;
    };
  }

  $: maxQty = Number(item?.qty || 1);
  $: errorMessage = $page.form?.item_id === item?.id ? $page.form?.message || '' : '';
</script>

<div class="dispose-sheet">
  <div class="dispose-title">{item.drug_name}</div>
  <div class="hint dispose-hint">{item.location_name || ''} · มี {item.qty}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</div>

  {#if errorMessage}
    <p class="dispose-error">{errorMessage}</p>
  {/if}

  <form method="POST" action="?/dispose" class="dispose-form-sheet" use:enhance={enhanceDispose}>
    <input type="hidden" name="item_id" value={item.id} />
    <input type="hidden" name="selected_location_id" value={selectedLocationId} />

    <div class="field">
      <label for={`ds-reason-${item.id}`}>เหตุผล</label>
      <select id={`ds-reason-${item.id}`} name="reason">
        {#each reasons as reason}
          <option>{reason}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for={`ds-qty-${item.id}`}>จำนวน</label>
      <div class="qty-row">
        <button type="button" class="qty-btn" onclick={decQty}>-</button>
        <input id={`ds-qty-${item.id}`} name="qty" type="number" min="1" max={maxQty} bind:value={qty} inputmode="numeric" />
        <span class="qty-unit">/ {item.qty}</span>
        <button type="button" class="qty-btn" onclick={incQty}>+</button>
      </div>
    </div>

    <div class="field">
      <label for={`ds-note-${item.id}`}>หมายเหตุ (ถ้ามี)</label>
      <input id={`ds-note-${item.id}`} name="note" type="text" autocomplete="off" />
    </div>

    <button class="btn-brand dispose-submit-sheet" type="submit" disabled={submitting}>
      <i class="bi bi-check2"></i>
      <span>{submitting ? 'กำลังบันทึก...' : 'ยืนยันตัดจ่าย'}</span>
    </button>
  </form>
</div>

<style>
  .dispose-sheet {
    display: grid;
    gap: 12px;
  }

  .dispose-title {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .dispose-hint {
    margin: -6px 0 0;
  }

  .dispose-error {
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: #fef3f2;
    color: #b42318;
    font-weight: 700;
  }

  .dispose-form-sheet {
    display: grid;
    gap: 12px;
  }

  .dispose-submit-sheet {
    width: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
</style>
