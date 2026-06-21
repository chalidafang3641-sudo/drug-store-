<script>
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';

  export let data;
  export let form;

  let searchForm;
  let searchInput;
  let lotInput;
  let qtyInput;
  let cameraBox;
  let cameraEnabled = false;
  let cameraApiReady = false;
  let cameraError = '';
  let scannerInstance = null;
  let searchBound = false;
  let lotBound = false;
  let listQuery = '';
  let selectedDrugId = form?.values?.drug_id || data.selectedDrugId || '';
  let receiveSubmitting = false;

  $: formValues = form?.values || {
    drug_id: data.selectedDrugId || '',
    lot_no: '',
    expiry_date: '',
    qty: 1,
    location_id: data.defaultLocationId || ''
  };

  $: selectedDrug = data.drugs.find((drug) => String(drug.id) === String(selectedDrugId || formValues.drug_id || data.selectedDrugId)) || null;
  $: availableDrugs = data.drugs.filter((drug) => {
    const query = listQuery.trim().toLowerCase();
    if (!query) return true;
    return drug.name.toLowerCase().includes(query) || String(drug.code || '').toLowerCase().includes(query);
  }).slice(0, 12);
  $: if (!selectedDrugId && (form?.values?.drug_id || data.selectedDrugId)) {
    selectedDrugId = form?.values?.drug_id || data.selectedDrugId;
  }

  function todayLocal() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  function bindScannerInput(input, onScan, options = {}) {
    if (!input || input.dataset.scanBound === 'true') return;

    const clearAfter = options.clear !== false;
    let lastTime = 0;
    let fastCount = 0;
    let total = 0;

    input.addEventListener('keydown', (event) => {
      const now = Date.now();

      if (event.key === 'Enter') {
        event.preventDefault();
        const code = input.value.trim();
        if (code) {
          onScan(code, total > 2 && fastCount / total > 0.6 ? 'hid' : 'manual');
          if (clearAfter) input.value = '';
        }
        lastTime = 0;
        fastCount = 0;
        total = 0;
        return;
      }

      if (event.key.length === 1) {
        if (lastTime && now - lastTime < 35) fastCount += 1;
        total += 1;
        lastTime = now;
      }
    });

    input.dataset.scanBound = 'true';
  }

  function expiryBucket(daysLeft) {
    if (daysLeft <= 30) return { cls: 'chip-crit', label: 'ใกล้หมดมาก' };
    if (daysLeft <= 60) return { cls: 'chip-high', label: 'ใกล้หมด' };
    if (daysLeft <= 120) return { cls: 'chip-med', label: 'ควรเฝ้าระวัง' };
    return { cls: 'chip-safe', label: 'ยังปลอดภัย' };
  }

  function daysToExpiry(value) {
    if (!value) return 9999;
    const now = new Date();
    const target = new Date(value);
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
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

  function adjustQty(delta) {
    const current = Number(qtyInput?.value || formValues.qty || 1);
    const next = Math.max(1, current + delta);
    if (qtyInput) {
      qtyInput.value = String(next);
    }
  }

  function pickDrug(drugId) {
    selectedDrugId = String(drugId);
    cameraError = '';
    stopCamera();
  }

  function clearSelectedDrug() {
    selectedDrugId = '';
    cameraError = '';
    if (searchInput) {
      searchInput.focus();
    }
  }

  async function stopCamera() {
    if (!scannerInstance) {
      cameraEnabled = false;
      return;
    }

    try {
      await scannerInstance.stop();
    } catch {}

    try {
      await scannerInstance.clear();
    } catch {}

    scannerInstance = null;
    cameraEnabled = false;
    if (cameraBox) {
      cameraBox.innerHTML = '';
    }
  }

  async function handleCameraScan(code) {
    cameraError = '';
    await stopCamera();
    if (searchInput) {
      searchInput.value = code;
    }
    searchForm?.requestSubmit();
  }

  async function toggleCamera() {
    if (!browser) return;

    cameraError = '';
    if (cameraEnabled) {
      await stopCamera();
      return;
    }

    const Html5Qrcode = window.Html5Qrcode;
    if (!Html5Qrcode) {
      cameraError = 'ไม่พบไลบรารีกล้อง';
      return;
    }
    if (!cameraBox) {
      cameraError = 'ไม่พบกล่องกล้อง';
      return;
    }

    await stopCamera();
    scannerInstance = new Html5Qrcode(cameraBox.id, { verbose: false });

    try {
      await scannerInstance.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 250, height: 160 }, aspectRatio: 1.3 },
        (decodedText) => {
          handleCameraScan(decodedText);
        },
        () => {}
      );
      cameraEnabled = true;
    } catch (error) {
      cameraError = error?.message || 'เปิดกล้องไม่ได้';
      await stopCamera();
    }
  }

  function enhanceReceive() {
    receiveSubmitting = true;

    return async ({ update }) => {
      await update();
      receiveSubmitting = false;
    };
  }

  onMount(() => {
    if (!browser) return;

    cameraApiReady = typeof window.Html5Qrcode !== 'undefined';
    if (!cameraApiReady) {
      const existing = document.querySelector('script[data-html5-qrcode]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
        script.async = true;
        script.dataset.html5Qrcode = 'true';
        script.onload = () => {
          cameraApiReady = true;
        };
        script.onerror = () => {
          cameraError = 'โหลดตัวสแกนกล้องไม่สำเร็จ';
        };
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', () => {
          cameraApiReady = true;
        });
      }
    }
  });

  $: if (searchInput && !searchBound) {
    bindScannerInput(searchInput, (code) => {
      searchInput.value = code;
      searchForm?.requestSubmit();
    });
    searchBound = true;
  }

  $: if (!searchInput) {
    searchBound = false;
  }

  $: if (lotInput && !lotBound) {
    bindScannerInput(
      lotInput,
      (code) => {
        lotInput.value = code;
      },
      { clear: false }
    );
    lotBound = true;
  }

  $: if (!lotInput) {
    lotBound = false;
  }

  onDestroy(() => {
    stopCamera();
  });
</script>

<svelte:head>
  <title>รับเข้า</title>
</svelte:head>

<main class="receive-shell">
  <div class="page-title">รับเข้า</div>

  {#if !selectedDrug}
    <div id="rcvBody">
      <div class="page-sub">ยิงบาร์โค้ด สแกนด้วยกล้อง หรือเลือกจากรายการ</div>

      <form method="GET" action="/receive" bind:this={searchForm}>
        <div class="scan-input-wrap">
          <i class="bi bi-upc-scan lead"></i>
          <input
            bind:this={searchInput}
            id="rScan"
            class="scan-input"
            name="q"
            value={data.q || ''}
            autocomplete="off"
            placeholder="ยิงบาร์โค้ดเพื่อเลือกยา"
          />
        </div>
      </form>

      <button
        id="rCam"
        class="btn-ghost camera-button"
        type="button"
        onclick={toggleCamera}
        disabled={!cameraApiReady && !cameraEnabled}
      >
        <i class={`bi ${cameraEnabled ? 'bi-x-lg' : 'bi-camera-fill'}`}></i>
        <span>{cameraEnabled ? 'ปิดกล้อง' : 'สแกนด้วยกล้อง'}</span>
      </button>

      <div bind:this={cameraBox} id="rCamBox" class:cam-active={cameraEnabled} class="cam-box"></div>

      {#if cameraError}
        <p class="status-note error">{cameraError}</p>
      {/if}

      {#if data.scanMessage}
        <p class:ok={!!data.selectedDrugId} class:error={!data.selectedDrugId} class="status-note">{data.scanMessage}</p>
      {/if}

      <div class="field pick-field">
        <label for="rSearch">หรือเลือกยาจากรายการ</label>
        <input id="rSearch" type="text" bind:value={listQuery} placeholder="ค้นหาชื่อยา" />
      </div>

      <div id="rDrugList">
        {#if availableDrugs.length}
          {#each availableDrugs as drug}
            {@const thumb = drugThumb(drug.image_url)}
            <button class="menu-item" type="button" onclick={() => pickDrug(drug.id)}>
              <div class="thumb" aria-hidden="true">
                <img src={thumb} alt="" loading="lazy" />
              </div>
              <div class="mi-body">
                <div class="mi-title">{drug.name}</div>
                <div class="mi-desc">
                  {#if drug.code}{drug.code} · {/if}
                  {drug.unit || 'หน่วย'}
                  {#if drug.require_lot} · <span class="lot-badge">Lot บังคับ</span>{/if}
                </div>
              </div>
              <i class="bi bi-chevron-right mi-arrow"></i>
            </button>
          {/each}
        {:else}
          <div class="hint">ไม่พบรายการที่ค้นหา</div>
        {/if}
      </div>
    </div>
  {:else}
    {@const thumb = drugThumb(selectedDrug.image_url)}
    <div id="rcvBody">
      <div class="card-soft picked-drug">
        <div class="thumb" aria-hidden="true">
          <img src={thumb} alt="" loading="lazy" />
        </div>
        <div class="picked-copy">
          <div class="picked-name">{selectedDrug.name}</div>
          <div class="hint">
            {#if selectedDrug.code}{selectedDrug.code} · {/if}
            {selectedDrug.unit || 'หน่วย'}
          </div>
        </div>
        <button class="btn-ghost change-btn" type="button" onclick={clearSelectedDrug}>เปลี่ยน</button>
      </div>

      <form method="POST" class="receive-form" use:enhance={enhanceReceive}>
        <input type="hidden" name="drug_id" value={selectedDrug.id} />

        <div class="field">
          <label for="rLot">
            Lot No.
            {#if selectedDrug.require_lot}
              <span class="req-mark">*</span>
            {:else}
              <span class="hint inline-hint">(ไม่บังคับ)</span>
            {/if}
          </label>
          <input
            bind:this={lotInput}
            id="rLot"
            name="lot_no"
            value={formValues.lot_no || ''}
            autocomplete="off"
            placeholder={selectedDrug.require_lot ? 'จำเป็นต้องกรอก' : 'เลขล็อต (ถ้ามี)'}
          />
        </div>

        <div class="field">
          <label for="rExp">วันหมดอายุ <span class="req-mark">*</span></label>
          <input id="rExp" name="expiry_date" type="date" value={formValues.expiry_date || ''} required />
        </div>

        <div class="field">
          <label for="rQty">จำนวน <span class="req-mark">*</span></label>
          <div class="qty-row">
            <button class="qty-btn" type="button" onclick={() => adjustQty(-1)}>-</button>
            <input bind:this={qtyInput} id="rQty" name="qty" type="number" min="1" inputmode="numeric" value={formValues.qty || 1} required />
            <span class="qty-unit">{selectedDrug.unit || 'หน่วย'}</span>
            <button class="qty-btn" type="button" onclick={() => adjustQty(1)}>+</button>
          </div>
        </div>

        <div class="field">
          <label for="rLoc">สถานที่เก็บ</label>
          <select id="rLoc" name="location_id" required>
            {#each data.locations as location}
              <option value={location.id} selected={(formValues.location_id || data.defaultLocationId) === location.id}>
                {location.name}
              </option>
            {/each}
          </select>
        </div>

        {#if form?.message}
          <p class:error={true} class="status-note">{form.message}</p>
        {/if}

        <button class="btn-brand submit-btn" type="submit" disabled={receiveSubmitting}>
          <i class="bi bi-box-arrow-in-down"></i>
          <span>{receiveSubmitting ? 'กำลังบันทึก...' : 'บันทึกรับเข้า'}</span>
        </button>
      </form>
    </div>
  {/if}

  <div class="recent-head">
    <div class="section-label">รับเข้าล่าสุด</div>
    <a class="link-btn export-link" href={`/settings/export?kind=receive&from=${todayLocal()}&to=${todayLocal()}`}>ส่งออกวันนี้</a>
  </div>

  <div id="rRecent">
    {#if data.recent.length}
      {#each data.recent as tx}
        {@const thumb = drugThumb(tx.image_url)}
        {@const bucket = expiryBucket(daysToExpiry(tx.expiry_date))}
        <div class="scan-row">
          <div class="thumb" aria-hidden="true">
            <img src={thumb} alt="" loading="lazy" />
          </div>
          <div class="recent-copy">
            <div class="recent-name">{tx.drug_name}</div>
            <div class="hint">+{tx.qty} · {tx.to_location_name || ''}{tx.lot_no ? ` · Lot ${tx.lot_no}` : ''}</div>
          </div>
          <div class="recent-meta">
            <span class={`chip ${bucket.cls}`}>{bucket.label}</span>
            <div class="hint">{formatDate(tx.expiry_date)}</div>
          </div>
        </div>
      {/each}
    {:else}
      <div class="hint">ยังไม่มีรายการ</div>
    {/if}
  </div>
</main>

<style>
  .receive-shell {
    padding-bottom: 86px;
  }

  .camera-button {
    width: auto;
    margin-top: 12px;
  }

  .status-note {
    margin: 12px 0 0;
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

  .pick-field {
    margin-top: 18px;
  }

  .lot-badge {
    color: var(--brand-strong);
  }

  .picked-drug {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }

  .picked-copy {
    min-width: 0;
    flex: 1;
  }

  .picked-name {
    font-weight: 600;
  }

  .change-btn {
    width: auto;
  }

  .inline-hint {
    display: inline;
    margin-left: 4px;
  }

  .req-mark {
    color: var(--danger);
  }

  .submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: auto;
  }

  .recent-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 22px 4px 12px;
  }

  .export-link {
    text-decoration: none;
  }

  .recent-copy {
    min-width: 0;
    flex: 1;
  }

  .recent-name {
    font-weight: 600;
  }

  .recent-meta {
    text-align: right;
  }

  @media (max-width: 720px) {
    .picked-drug {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .change-btn,
    .submit-btn {
      width: 100%;
      justify-content: center;
    }

    .recent-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .recent-meta {
      text-align: left;
    }
  }
</style>
