<script>
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';

  export let data;
  export let form;

  const roleLabels = {
    admin: 'ผู้ดูแลระบบ',
    pharmacist: 'เภสัชกร',
    staff: 'เจ้าหน้าที่'
  };

  function roleLabel(role) {
    return roleLabels[role] || role || '';
  }

  const tabs = [
    { id: 'menu', label: 'เมนู' },
    { id: 'account', label: 'บัญชี' },
    { id: 'manual', label: 'คู่มือ' },
    { id: 'general', label: 'ระบบ', visible: data.canAdmin },
    { id: 'display', label: 'แสดงผล' },
    { id: 'users', label: 'ผู้ใช้', visible: data.canAdmin },
    { id: 'drugs', label: 'ยา', visible: data.canDrug },
    { id: 'lot', label: 'Lot', visible: data.canDrug },
    { id: 'locations', label: 'สถานที่', visible: data.canDrug },
    { id: 'notify', label: 'แจ้งเตือน', visible: data.canAdmin },
    { id: 'export', label: 'ส่งออก' },
    { id: 'history', label: 'ประวัติ' },
    { id: 'audit', label: 'ตรวจนับ', visible: data.canStock },
    { id: 'report', label: 'รายงาน' }
  ].filter((tab) => tab.visible !== false);

  const menuItems = [
    { id: 'account', label: 'บัญชีผู้ใช้', desc: 'ดูข้อมูลผู้ใช้และเปลี่ยนรหัสผ่าน', icon: 'person-circle', color: 'teal' },
    { id: 'manual', label: 'คู่มือการใช้งาน', desc: 'สรุป flow หลักและวิธีใช้เมนูต่าง ๆ', icon: 'book-fill', color: 'indigo' },
    { id: 'general', label: 'ข้อมูลโรงพยาบาล', desc: 'ชื่อหน่วยงาน โลโก้ และช่วงเตือน', icon: 'hospital-fill', color: 'indigo', visible: data.canAdmin },
    { id: 'display', label: 'การแสดงผล', desc: 'โหมดมืดและการแสดงปี พ.ศ.', icon: 'palette-fill', color: 'violet' },
    { id: 'locations', label: 'สถานที่เก็บยา', desc: 'เพิ่ม แก้ไข สี ไอคอน และจุดรับเข้า', icon: 'geo-alt-fill', color: 'amber', visible: data.canDrug },
    { id: 'drugs', label: 'รายการยา', desc: 'รหัสยา รูปยา หน่วย และค่าตั้งต้น', icon: 'capsule-pill', color: 'coral', visible: data.canDrug },
    { id: 'lot', label: 'รายการที่ต้องบันทึก Lot', desc: 'เปิดหรือปิดการบังคับ Lot No. รายยา', icon: 'upc-scan', color: 'indigo', visible: data.canDrug },
    { id: 'notify', label: 'การแจ้งเตือน', desc: 'Telegram หรือ LINE สำหรับยาใกล้หมดอายุ', icon: 'bell-fill', color: 'teal', visible: data.canAdmin },
    { id: 'export', label: 'ส่งออกข้อมูล', desc: 'เตรียมข้อมูลสำหรับ Excel หรือ CSV', icon: 'file-earmark-excel-fill', color: 'indigo' },
    { id: 'history', label: 'ประวัติการเคลื่อนไหว', desc: 'รับเข้า ย้าย ตัดจ่าย และปรับยอด', icon: 'clock-history', color: 'amber' },
    { id: 'audit', label: 'ตรวจนับสต็อก', desc: 'นับจริงและปรับยอดคงเหลือ', icon: 'clipboard-check-fill', color: 'teal', visible: data.canStock },
    { id: 'report', label: 'พิมพ์รายงาน', desc: 'เปิดหน้ารายงานสำหรับพิมพ์หรือบันทึก PDF', icon: 'printer-fill', color: 'amber' },
    { id: 'users', label: 'จัดการผู้ใช้', desc: 'เพิ่ม แก้ไข ปิดใช้งาน และเปลี่ยน role', icon: 'people-fill', color: 'indigo', visible: data.canAdmin }
  ].filter((item) => item.visible !== false);

  const manualSections = [
    {
      title: 'ภาพรวมระบบ',
      body: 'เมนูหลักมี 5 ส่วนเหมือนระบบเดิม: หน้าหลัก, ยาแต่ละจุด, รับเข้า, แลกยา, ตั้งค่า โดย flow หลักที่ migrate แล้วใช้งานได้คือ dashboard, stock, receive, exchange และ settings.'
    },
    {
      title: 'การรับเข้า',
      body: 'ใช้ช่องค้นหาเพื่อยิง barcode หรือค้นหาชื่อยา เลือกสถานที่ กรอก Lot วันหมดอายุ และจำนวน จากนั้นกดบันทึกรับเข้า ระบบจะรวมเข้าล็อตเดิมอัตโนมัติเมื่อยา จุดเก็บ Lot และวันหมดอายุตรงกัน.'
    },
    {
      title: 'ยาแต่ละจุดและการย้ายยา',
      body: 'หน้า ยาแต่ละจุด ใช้ดู stock แยกสถานที่ เลือกจุดเก็บเพื่อดูรายการ active และตัดจ่ายได้ ส่วนหน้า แลกยา ใช้ค้นหา item เดิมแล้วย้ายไปยังสถานที่ปลายทางพร้อมบันทึกประวัติ.'
    },
    {
      title: 'ตั้งค่าพื้นฐาน',
      body: 'เริ่มจากข้อมูลโรงพยาบาล สถานที่เก็บยา รายการยา และ Lot required จากนั้นค่อยตั้งค่าการแจ้งเตือนและส่งออกข้อมูล ผู้ดูแลระบบเท่านั้นที่แก้ config ผู้ใช้ และ notification ได้.'
    },
    {
      title: 'รายงานและการส่งออก',
      body: 'ใช้เมนู ส่งออกข้อมูล เพื่อดาวน์โหลด CSV และเมนู พิมพ์รายงาน เพื่อเปิดหน้า print-friendly สำหรับรายงานยาใกล้หมดอายุหรือ stock คงเหลือ แล้วบันทึกเป็น PDF จาก dialog พิมพ์ของเบราว์เซอร์.'
    }
  ];

  let darkMode = false;
  let notificationChannel = data.notification?.channel || 'telegram';
  let reportType = 'near';
  let reportPending = false;
  let exportKind = form?.exportResult?.kind || 'all';
  let exportFrom = form?.exportResult?.from || today();
  let exportTo = form?.exportResult?.to || today();
  let drugCodeInput;
  let drugCameraBox;
  let drugCameraEnabled = false;
  let drugCameraApiReady = false;
  let drugCameraError = '';
  let drugScannerInstance = null;
  let drugCodeBound = false;
  let drugScanMessage = '';

  onMount(() => {
    darkMode = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('tw_theme') === 'dark';
    if (!browser) return;

    drugCameraApiReady = typeof window.Html5Qrcode !== 'undefined';
    if (!drugCameraApiReady) {
      const existing = document.querySelector('script[data-html5-qrcode]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
        script.async = true;
        script.dataset.html5Qrcode = 'true';
        script.onload = () => {
          drugCameraApiReady = true;
        };
        script.onerror = () => {
          drugCameraError = 'โหลดตัวสแกนกล้องไม่สำเร็จ';
        };
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', () => {
          drugCameraApiReady = true;
        });
      }
    }
  });

  const historyFilters = [
    { id: '', label: 'ทั้งหมด' },
    { id: 'receive', label: 'รับเข้า' },
    { id: 'exchange', label: 'ย้าย' },
    { id: 'dispose', label: 'ตัดจ่าย' },
    { id: 'adjust', label: 'ปรับยอด' }
  ];
  const locationIconPicker = ['box', 'archive', 'firstaid', 'building', 'injection', 'bed', 'asterisk', 'cart', 'people', 'bolt'];
  const locationColorPalette = ['#16A34A', '#2563EB', '#06B6D4', '#F97316', '#EAB308', '#EF4444', '#8B5CF6', '#64748B'];
  const locationIcons = {
    box: 'bi-box-seam-fill',
    bolt: 'bi-lightning-charge-fill',
    archive: 'bi-archive-fill',
    building: 'bi-building-fill',
    cart: 'bi-cart-fill',
    bed: 'bi-hospital',
    asterisk: 'bi-asterisk',
    people: 'bi-people-fill',
    injection: 'bi-eyedropper',
    firstaid: 'bi-bag-plus-fill',
    default: 'bi-geo-alt-fill'
  };

  function formatDate(value) {
    return value ? new Date(value).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportHref(result) {
    if (!result) return '';
    const params = new URLSearchParams({ kind: result.kind || 'receive' });
    if (result.from) params.set('from', result.from);
    if (result.to) params.set('to', result.to);
    return `/settings/export?${params.toString()}`;
  }

  function uploadedFor(drugId) {
    return data.uploadedImage?.drugId === drugId ? data.uploadedImage : null;
  }

  function imageFileIdFor(drug) {
    return uploadedFor(drug.id)?.fileId || drug.image_file_id || '';
  }

  function imageUrlFor(drug) {
    return uploadedFor(drug.id)?.url || drug.image_url || '';
  }

  function filteredDrugs(drugs, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return drugs;
    return drugs.filter((drug) => {
      return (drug.name || '').toLowerCase().includes(q) || (drug.code || '').toLowerCase().includes(q);
    });
  }

  function sortedDrugsByName(drugs) {
    return [...drugs].sort((left, right) => (left.name || '').localeCompare(right.name || '', 'th'));
  }

  function iconClass(key) {
    return locationIcons[key] || locationIcons.default;
  }

  function hexToSoft(hex) {
    if (!hex || hex[0] !== '#') return 'var(--brand-soft)';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.13)`;
  }

  function reorderedLocationIds(locationId, direction) {
    const ids = data.locations.map((location) => location.id);
    const index = ids.indexOf(locationId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids.join(',');
    const swapped = [...ids];
    const current = swapped[index];
    swapped[index] = swapped[nextIndex];
    swapped[nextIndex] = current;
    return swapped.join(',');
  }

  function historyMeta(type) {
    return {
      receive: { icon: 'bi-box-arrow-in-down', color: 'var(--brand-strong)', label: 'รับเข้า' },
      exchange: { icon: 'bi-arrow-left-right', color: '#2563eb', label: 'ย้าย' },
      dispose: { icon: 'bi-dash-circle', color: 'var(--danger)', label: 'ตัดจ่าย' },
      adjust: { icon: 'bi-sliders', color: '#8b5cf6', label: 'ปรับยอด' }
    }[type] || { icon: 'bi-dot', color: 'var(--muted)', label: type || '-' };
  }

  function historyRoute(item) {
    if (item.type === 'receive') return item.to_location_name ? `→ ${item.to_location_name}` : '';
    if (item.type === 'exchange') return `${item.from_location_name || '-'} → ${item.to_location_name || '-'}`;
    if (item.type === 'dispose') return `${item.from_location_name || '-'}${item.reason ? ` · ${item.reason}` : ''}`;
    if (item.type === 'adjust') return `${item.from_location_name || '-'}${item.note ? ` · ${item.note}` : ''}`;
    return '';
  }

  function sortedLocations(locations) {
    return [...locations].sort((left, right) => {
      const leftOrder = Number(left.sort_order || 0);
      const rightOrder = Number(right.sort_order || 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (left.name || '').localeCompare(right.name || '', 'th');
    });
  }

  function auditLocationHref(locationId) {
    const params = new URLSearchParams({ tab: 'audit' });
    if (locationId) params.set('location_id', locationId);
    return `/settings?${params.toString()}`;
  }

  function openReport() {
    reportPending = true;
    window.setTimeout(() => {
      reportPending = false;
    }, 1200);
  }

  function setExportPreset(preset) {
    if (preset === 'today') {
      exportFrom = today();
      exportTo = today();
      return;
    }

    if (preset === 'month') {
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60000;
      const localNow = new Date(now.getTime() - offsetMs);
      exportFrom = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-01`;
      exportTo = localNow.toISOString().slice(0, 10);
    }
  }

  async function changeAuditLocation(event) {
    await goto(auditLocationHref(event.currentTarget.value), {
      keepFocus: true,
      noScroll: true
    });
  }

  function setTheme(enabled) {
    darkMode = enabled;
    if (!browser) return;
    document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    localStorage.setItem('tw_theme', enabled ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', enabled ? '#1f2430' : '#5b3fc2');
    }
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

  async function stopDrugCamera() {
    if (!drugScannerInstance) {
      drugCameraEnabled = false;
      return;
    }

    try {
      await drugScannerInstance.stop();
    } catch {}

    try {
      await drugScannerInstance.clear();
    } catch {}

    drugScannerInstance = null;
    drugCameraEnabled = false;
    if (drugCameraBox) {
      drugCameraBox.innerHTML = '';
    }
  }

  async function handleDrugCameraScan(code) {
    drugCameraError = '';
    drugScanMessage = `รับบาร์โค้ด: ${code}`;
    if (drugCodeInput) {
      drugCodeInput.value = code;
    }
    await stopDrugCamera();
  }

  async function toggleDrugCamera() {
    if (!browser) return;

    drugCameraError = '';
    if (drugCameraEnabled) {
      await stopDrugCamera();
      return;
    }

    const Html5Qrcode = window.Html5Qrcode;
    if (!Html5Qrcode) {
      drugCameraError = 'ไม่พบไลบรารีกล้อง';
      return;
    }
    if (!drugCameraBox) {
      drugCameraError = 'ไม่พบกล่องกล้อง';
      return;
    }

    await stopDrugCamera();
    drugScannerInstance = new Html5Qrcode(drugCameraBox.id, { verbose: false });

    try {
      await drugScannerInstance.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 250, height: 160 }, aspectRatio: 1.3 },
        (decodedText) => {
          handleDrugCameraScan(decodedText);
        },
        () => {}
      );
      drugCameraEnabled = true;
    } catch (error) {
      drugCameraError = error?.message || 'เปิดกล้องไม่ได้';
      await stopDrugCamera();
    }
  }

  function confirmDanger(message) {
    return ({ cancel }) => {
      if (browser && !window.confirm(message)) {
        cancel();
      }
    };
  }

  function enhanceLotToggle({ formElement }) {
    const checkbox = formElement.querySelector('input[name="value"]');
    const previousChecked = checkbox instanceof HTMLInputElement ? !checkbox.checked : false;

    return async ({ result, update }) => {
      await update();
      if (result.type === 'failure' && checkbox instanceof HTMLInputElement) {
        checkbox.checked = previousChecked;
      }
    };
  }

  function enhanceDisplayToggle({ formElement }) {
    const checkbox = formElement.querySelector('input[name="display_be"]');
    const previousChecked = checkbox instanceof HTMLInputElement ? !checkbox.checked : false;

    return async ({ result, update }) => {
      await update();
      if (result.type === 'failure' && checkbox instanceof HTMLInputElement) {
        checkbox.checked = previousChecked;
      }
    };
  }

  function enhanceAuditRow({ formElement }) {
    const input = formElement.querySelector('input[name="actual_qty"]');
    const button = formElement.querySelector('button[type="submit"]');

    function resetButton() {
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.textContent = 'บันทึก';
      }
    }

    if (input instanceof HTMLInputElement && button instanceof HTMLButtonElement) {
      input.addEventListener('input', resetButton, { once: true });
    }

    return async ({ result, update }) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = true;
        button.textContent = 'กำลังบันทึก...';
      }

      await update();

      if (!(button instanceof HTMLButtonElement)) return;
      if (result.type === 'success') {
        button.innerHTML = '<i class="bi bi-check2"></i>';
        if (input instanceof HTMLInputElement) {
          input.value = '';
          input.placeholder = 'บันทึกแล้ว';
          input.addEventListener('input', resetButton, { once: true });
        }
        return;
      }

      resetButton();
    };
  }

  function queueLocationAutosave(formElement) {
    if (!(formElement instanceof HTMLFormElement)) return;
    const saveMode = formElement.querySelector('input[name="save_mode"]');
    if (!(saveMode instanceof HTMLInputElement)) return;
    saveMode.value = 'autosave';
    formElement.requestSubmit();
  }

  function enhanceLocationAutosave() {
    return async ({ result, update, formElement }) => {
      await update();
      const saveMode = formElement.querySelector('input[name="save_mode"]');
      if (saveMode instanceof HTMLInputElement) {
        saveMode.value = 'manual';
      }
      if (result.type === 'failure') return;
    };
  }

  $: if (drugCodeInput && !drugCodeBound) {
    bindScannerInput(
      drugCodeInput,
      (code) => {
        drugCodeInput.value = code;
        drugCameraError = '';
        drugScanMessage = `รับบาร์โค้ด: ${code}`;
      },
      { clear: false }
    );
    drugCodeBound = true;
  }

  $: if (!drugCodeInput) {
    drugCodeBound = false;
  }

  $: if (data.tab !== 'drugs' || !(data.mode === 'new' || data.managedDrug)) {
    drugScanMessage = '';
    stopDrugCamera();
  }

  onDestroy(() => {
    stopDrugCamera();
  });
</script>

<main class="settings-shell">
  <div class="page-title">ตั้งค่า</div>
  {#if data.tab === 'menu'}
    <div class="page-sub">ข้อมูลบัญชี คู่มือ และการตั้งค่าต่าง ๆ</div>
  {:else}
    <div class="settings-nav-top">
      <a class="btn-ghost back-link" href="/settings?tab=menu">
        <i class="bi bi-chevron-left"></i>
        <span>กลับ</span>
      </a>
      <nav class="tabs" aria-label="เมนูตั้งค่า">
        {#each tabs as tab}
          <a class:selected={data.tab === tab.id} href={`/settings?tab=${tab.id}`}>{tab.label}</a>
        {/each}
      </nav>
    </div>
  {/if}

  {#if data.message || form?.message}
    <p class:ok={!!data.message || form?.ok} class:error={!!form?.message && !form?.ok} class="status-note">{data.message || form.message}</p>
  {/if}

  {#if data.tab === 'menu'}
    <a class="menu-item root-menu-item" href="/settings?tab=account">
      <div class="mi-icon c-teal"><i class="bi bi-person-circle"></i></div>
      <div class="mi-body">
        <div class="mi-title">{data.user.name || 'บัญชีผู้ใช้'}</div>
        <div class="mi-desc">{data.user.username} {#if data.user.role}· {roleLabel(data.user.role)}{/if}</div>
      </div>
      <i class="bi bi-chevron-right mi-arrow"></i>
    </a>

    <a class="menu-item root-menu-item" href="/settings?tab=manual">
      <div class="mi-icon c-indigo"><i class="bi bi-book-fill"></i></div>
      <div class="mi-body">
        <div class="mi-title">คู่มือการใช้งาน</div>
        <div class="mi-desc">วิธีใช้งาน The Watcher</div>
      </div>
      <i class="bi bi-chevron-right mi-arrow"></i>
    </a>

    <div class="section-label">การตั้งค่าต่าง ๆ</div>

    <section class="menu-list" aria-label="เมนูตั้งค่าเดิม">
      {#each menuItems as item}
        {#if item.id !== 'account' && item.id !== 'manual'}
          <a class="menu-item root-menu-item" href={`/settings?tab=${item.id}`}>
            <span class={`mi-icon c-${item.color}`}>
              <i class={`bi bi-${item.icon}`}></i>
            </span>
            <span class="mi-body">
              <span class="mi-title">{item.label}</span>
              <span class="mi-desc">{item.desc}</span>
            </span>
            <i class="bi bi-chevron-right mi-arrow"></i>
          </a>
        {/if}
      {/each}
    </section>

    <a class="btn-line logout-link" href="/logout">
      <i class="bi bi-box-arrow-right"></i>
      <span>ออกจากระบบ</span>
    </a>
  {:else if data.tab === 'account'}
    <section class="panel">
      <div class="page-sub">ข้อมูลบัญชีและการเปลี่ยนรหัสผ่าน</div>
      <div class="card-soft account-legacy">
        <div class="field">
          <label for="account-name">ชื่อ</label>
          <input id="account-name" type="text" value={data.user.name || ''} disabled />
        </div>
        <div class="field">
          <label for="account-username">ชื่อผู้ใช้</label>
          <input id="account-username" type="text" value={data.user.username || ''} disabled />
        </div>
        <div class="field account-last">
          <label for="account-role">บทบาท</label>
          <input id="account-role" type="text" value={data.user.role || ''} disabled />
        </div>
      </div>

      <div class="section-label account-label">เปลี่ยนรหัสผ่าน</div>
      <form method="POST" action="?/changePassword" class="account-form">
        <div class="field">
          <label for="old-password">รหัสผ่านเดิม</label>
          <input id="old-password" name="old_password" type="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label for="new-password">รหัสผ่านใหม่</label>
          <input id="new-password" name="new_password" type="password" autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="confirm-password">ยืนยันรหัสผ่านใหม่</label>
          <input id="confirm-password" name="confirm_password" type="password" autocomplete="new-password" />
        </div>
        <button type="submit">เปลี่ยนรหัสผ่าน</button>
      </form>
    </section>
  {:else if data.tab === 'manual'}
    <section class="panel">
      <div class="section-head">
        <h2>คู่มือการใช้งาน</h2>
        <span>สรุป flow หลัก</span>
      </div>
      <div class="manual-list">
        {#each manualSections as section, index}
          <details open={index === 0}>
            <summary>{section.title}</summary>
            <p>{section.body}</p>
          </details>
        {/each}
      </div>
    </section>
  {:else if data.tab === 'general'}
    <section class="panel">
      <div class="page-sub">ชื่อโรงพยาบาล โลโก้ และช่วงแจ้งเตือน</div>
      {#if data.canAdmin && data.config}
        <div class="card-soft hospital-brand">
          <div class="logo-preview">
            {#if data.config.logo_url}
              <img src={data.config.logo_url} alt="" />
            {:else}
              <i class="bi bi-hospital"></i>
            {/if}
          </div>
          <div class="hospital-brand-copy">
            <div class="hospital-brand-title">โลโก้</div>
            <div class="hint">PNG / JPG สำหรับแสดงในระบบ</div>
          </div>
        </div>

        <form method="POST" action="?/uploadLogo" enctype="multipart/form-data" class="logo-upload-form">
          <input id="hospital-logo-file" name="logo" type="file" accept="image/*" />
          <button type="submit" class="btn-ghost logo-upload-btn">
            <i class="bi bi-upload"></i>
            <span>อัปโหลดโลโก้</span>
          </button>
        </form>

        {#if data.config.logo_url}
          <form
            method="POST"
            action="?/removeLogo"
            class="logo-remove-form"
            use:enhance={confirmDanger('ลบโลโก้?')}
          >
            <button type="submit" class="btn-line logo-remove-btn">
              <i class="bi bi-trash3"></i>
              <span>ลบโลโก้</span>
            </button>
          </form>
        {/if}

        <form method="POST" action="?/saveConfig" class="general-form">
          <div class="field">
            <label for="hospital-name">ชื่อโรงพยาบาล</label>
            <input id="hospital-name" name="hospital_name" value={data.config.hospital_name || ''} autocomplete="off" />
          </div>

          <div class="section-label general-label">ช่วงแจ้งเตือนใกล้หมดอายุ (วัน)</div>
          <div class="threshold-grid">
            <div class="field">
              <label for="threshold-critical">เร่งด่วน (แดง)</label>
              <input id="threshold-critical" name="critical" type="number" min="1" value={data.config.expiry_thresholds?.critical || 35} />
            </div>
            <div class="field">
              <label for="threshold-high">เตือน (ส้ม)</label>
              <input id="threshold-high" name="high" type="number" min="1" value={data.config.expiry_thresholds?.high || 60} />
            </div>
            <div class="field">
              <label for="threshold-medium">เฝ้าระวัง (เหลือง)</label>
              <input id="threshold-medium" name="medium" type="number" min="1" value={data.config.expiry_thresholds?.medium || 120} />
            </div>
          </div>
          <div class="hint threshold-hint">ต้องเรียงจากน้อยไปมาก เช่น 35 &lt; 60 &lt; 120</div>

          <div class="field">
            <label for="default-receive-location">รับเข้าเริ่มต้น</label>
            <select id="default-receive-location" name="default_receive_location_id">
              <option value="">ไม่ระบุ</option>
              {#each data.locations as location}
                <option value={location.id} selected={location.id === data.config.default_receive_location_id}>{location.name}</option>
              {/each}
            </select>
          </div>

          <label class="check-line display-check">
            <input name="display_be" type="checkbox" checked={data.config.display_be} />
            <span>แสดงปีเป็น พ.ศ.</span>
          </label>

          <button type="submit">บันทึก</button>
        </form>
      {:else}
        <p class="empty">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขการตั้งค่าได้</p>
      {/if}
    </section>
  {:else if data.tab === 'display'}
    <section class="panel">
      <div class="page-sub">โหมดมืด และปีพุทธศักราช</div>
      <div class="card-soft switch-card">
        <div>
          <div class="switch-title">โหมดมืด</div>
          <div class="hint">ปรับธีมให้สบายตา</div>
        </div>
        <label class="auto-toggle switch-toggle" for="display-dark">
          <input id="display-dark" type="checkbox" checked={darkMode} onchange={(event) => setTheme(event.currentTarget.checked)} />
        </label>
      </div>

      {#if data.canAdmin}
        <form method="POST" action="?/saveDisplay" class="card-soft switch-card display-admin-form" use:enhance={enhanceDisplayToggle}>
          <div>
            <div class="switch-title">แสดงปีเป็น พ.ศ.</div>
            <div class="hint">เช่น 30/09/2569</div>
          </div>
          <label class="auto-toggle switch-toggle" for="display-be">
            <input
              id="display-be"
              name="display_be"
              type="checkbox"
              checked={data.config?.display_be}
              onchange={(event) => event.currentTarget.form?.requestSubmit()}
            />
          </label>
        </form>
      {/if}
    </section>
  {:else if data.tab === 'users'}
    <section class="panel">
      {#if data.canAdmin}
        {#if data.usersMode === 'new' || data.selectedUser}
          <div class="settings-subhead">
            <a class="btn-ghost back-link" href="/settings?tab=users">
              <i class="bi bi-chevron-left"></i>
              <span>กลับ</span>
            </a>
            <div class="page-sub">{data.selectedUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'}</div>
          </div>

          <form method="POST" action="?/saveUser" class="user-editor">
            {#if data.selectedUser}
              <input type="hidden" name="id" value={data.selectedUser.id} />
            {/if}

            <div class="field">
              <label for="user-username">ชื่อผู้ใช้ (สำหรับเข้าระบบ)</label>
              <input id="user-username" name="username" value={data.selectedUser?.username || ''} autocomplete="off" />
            </div>

            <div class="field">
              <label for="user-name">ชื่อ-สกุล</label>
              <input
                id="user-name"
                name="name"
                value={data.selectedUser?.name || ''}
                placeholder="เว้นว่างใช้ชื่อตามบทบาท"
                autocomplete="off"
              />
            </div>

            <div class="field">
              <label for="user-role">บทบาท</label>
              <select id="user-role" name="role">
                {#each data.roles as role}
                  <option value={role.id} selected={role.id === (data.selectedUser?.role || 'staff')}>{role.name}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="user-password">รหัสผ่าน{data.selectedUser ? ' (เว้นว่างถ้าไม่เปลี่ยน)' : ''}</label>
              <input
                id="user-password"
                name="password"
                type="text"
                placeholder={data.selectedUser ? 'ตั้งใหม่ถ้าต้องการ' : 'อย่างน้อย 4 ตัวอักษร'}
                autocomplete="off"
              />
            </div>

            {#if data.selectedUser}
              <div class="card-soft switch-card editor-switch">
                <div class="switch-title">เปิดใช้งาน</div>
                <label class="auto-toggle switch-toggle" for="user-active">
                  <input id="user-active" name="active" type="checkbox" checked={data.selectedUser.active} />
                </label>
              </div>
            {:else}
              <label class="check-line editor-check">
                <input name="active" type="checkbox" checked />
                <span>เปิดใช้งาน</span>
              </label>
            {/if}

            <button type="submit">{data.selectedUser ? 'บันทึก' : 'เพิ่มผู้ใช้'}</button>
          </form>

          {#if data.selectedUser}
            <form
              method="POST"
              action="?/deleteUser"
              class="user-delete-form"
              use:enhance={confirmDanger(`ลบผู้ใช้ "${data.selectedUser.username}"?`)}
            >
              <input type="hidden" name="id" value={data.selectedUser.id} />
              <button class="btn-line user-delete" type="submit">
                <i class="bi bi-trash3"></i>
                <span>ลบผู้ใช้</span>
              </button>
            </form>
          {/if}
        {:else}
          <div class="page-sub">เพิ่ม แก้ไข และรีเซ็ตรหัสผ่านผู้ใช้</div>
          <a class="btn-ghost add-user-link" href="/settings?tab=users&mode=new">
            <i class="bi bi-plus-lg"></i>
            <span>เพิ่มผู้ใช้</span>
          </a>

          <div class="user-menu-list">
            {#each data.users as user}
              <a class="menu-item user-menu-item" href={`/settings?tab=users&user_id=${user.id}`}>
                <div class="mi-icon"><i class="bi bi-person-fill"></i></div>
                <div class="mi-body">
                  <div class="mi-title">
                    {user.name || user.username}
                    {#if !user.active}
                      <span class="hint user-disabled">(ปิดใช้งาน)</span>
                    {/if}
                  </div>
                  <div class="mi-desc">{user.username} · {data.roles.find((role) => role.id === user.role)?.name || user.role}</div>
                </div>
                <i class="bi bi-chevron-right mi-arrow"></i>
              </a>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="empty">เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ได้</p>
      {/if}
    </section>
  {:else if data.tab === 'drugs'}
    <section class="panel">
      {#if data.canDrug}
        {#if data.mode === 'new' || data.managedDrug}
          <div class="settings-subhead">
            <a class="btn-ghost back-link" href="/settings?tab=drugs">
              <i class="bi bi-chevron-left"></i>
              <span>กลับ</span>
            </a>
            <div class="page-sub">{data.managedDrug ? 'แก้ไขยา' : 'เพิ่มยา'}</div>
          </div>

          <form method="POST" action="?/uploadDrugImage" enctype="multipart/form-data" class="card-soft drug-form-image">
            <input type="hidden" name="drug_id" value={data.managedDrug?.id || '__new__'} />
            <input type="hidden" name="redirect_mode" value={data.managedDrug ? '' : 'new'} />
            <div class="img-pick drug-form-preview">
              {#if data.managedDrug ? imageUrlFor(data.managedDrug) : uploadedFor('__new__')?.url}
                <img src={data.managedDrug ? imageUrlFor(data.managedDrug) : uploadedFor('__new__')?.url} alt="" />
              {:else}
                <i class="bi bi-camera"></i>
              {/if}
            </div>
            <div class="drug-form-copy">
              <div class="drug-form-title">รูปยา</div>
              <div class="drug-form-upload-actions">
                <input name="image" type="file" accept="image/*" />
                <button type="submit">อัปโหลดรูป</button>
              </div>
              <div class="hint">ถ่ายรูปหรือเลือกจากคลังภาพ</div>
            </div>
          </form>

          <form method="POST" action="?/saveDrug" class="drug-editor">
            {#if data.managedDrug}
              <input type="hidden" name="id" value={data.managedDrug.id} />
            {/if}
            <input type="hidden" name="redirect_to" value="/settings?tab=drugs&message=%E0%B8%9A%E0%B8%B1%E0%B8%99%E0%B8%97%E0%B8%B6%E0%B8%81%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A2%E0%B8%B2%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
            <input type="hidden" name="image_file_id" value={data.managedDrug ? imageFileIdFor(data.managedDrug) : uploadedFor('__new__')?.fileId || ''} />

            <div class="field">
              <label for="drug-name">ชื่อยา</label>
              <input id="drug-name" name="name" value={data.managedDrug?.name || ''} placeholder="เช่น Paracetamol 500mg" autocomplete="off" />
            </div>

            <div class="field">
              <label for="drug-code">บาร์โค้ด / รหัส</label>
              <div class="drug-code-row">
                <input
                  bind:this={drugCodeInput}
                  id="drug-code"
                  name="code"
                  value={data.managedDrug?.code || ''}
                  placeholder="ยิงหรือพิมพ์บาร์โค้ด"
                  autocomplete="off"
                />
                <button
                  class="btn-ghost drug-camera-btn"
                  type="button"
                  onclick={toggleDrugCamera}
                  disabled={!drugCameraApiReady && !drugCameraEnabled}
                  aria-label={drugCameraEnabled ? 'ปิดกล้อง' : 'สแกนด้วยกล้อง'}
                >
                  <i class={`bi ${drugCameraEnabled ? 'bi-x-lg' : 'bi-camera-fill'}`}></i>
                </button>
              </div>
              <div bind:this={drugCameraBox} id="drugCamBox" class:cam-active={drugCameraEnabled} class="cam-box"></div>
              {#if drugCameraError}
                <p class="status-note error">{drugCameraError}</p>
              {/if}
              {#if drugScanMessage}
                <p class="status-note ok">{drugScanMessage}</p>
              {/if}
              <div class="hint">ใช้เครื่องยิงยิงใส่ช่องนี้ได้เลย</div>
            </div>

            <div class="drug-two-col">
              <div class="field">
                <label for="drug-unit">หน่วย</label>
                <input id="drug-unit" name="unit" value={data.managedDrug?.unit || ''} placeholder="เม็ด / ขวด / แผง" autocomplete="off" />
              </div>
              <div class="field">
                <label for="drug-location">จุดเก็บเริ่มต้น</label>
                <select id="drug-location" name="default_location_id">
                  <option value="">ไม่ระบุ</option>
                  {#each data.locations as location}
                    <option value={location.id} selected={location.id === data.managedDrug?.default_location_id}>{location.name}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="field">
              <label for="drug-min">แจ้งเตือนเมื่อสต็อกรวมต่ำกว่า (0 = ปิด)</label>
              <input id="drug-min" name="min_qty" type="number" min="0" value={data.managedDrug?.min_qty || 0} inputmode="numeric" />
            </div>

            <div class="card-soft switch-card editor-switch">
              <div>
                <div class="switch-title">บังคับกรอก Lot No.</div>
                <div class="hint">ต้องกรอก Lot ก่อนบันทึกตอนรับเข้า</div>
              </div>
              <label class="auto-toggle switch-toggle" for="drug-lot">
                <input id="drug-lot" name="require_lot" type="checkbox" checked={data.managedDrug ? data.managedDrug.require_lot : true} />
              </label>
            </div>

            {#if data.managedDrug && imageUrlFor(data.managedDrug)}
              <label class="check-line editor-check">
                <input name="clear_image" type="checkbox" />
                <span>ลบรูป</span>
              </label>
            {/if}

            <button type="submit">{data.managedDrug ? 'บันทึก' : 'เพิ่มยา'}</button>
          </form>

          {#if data.managedDrug}
            <form
              method="POST"
              action="?/deleteDrug"
              class="user-delete-form"
              use:enhance={confirmDanger(`ลบ "${data.managedDrug.name}"?`)}
            >
              <input type="hidden" name="id" value={data.managedDrug.id} />
              <input type="hidden" name="redirect_to" value="/settings?tab=drugs&message=%E0%B8%A5%E0%B8%9A%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A2%E0%B8%B2%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
              <button class="btn-line user-delete" type="submit">
                <i class="bi bi-trash3"></i>
                <span>ลบรายการยานี้</span>
              </button>
            </form>
          {/if}
        {:else}
          <div class="page-sub">ปรับรายการยาที่ใช้ค้นหาและเลือกตอนรับเข้า</div>
          <form method="GET" action="/settings" class="drug-search-row">
            <input type="hidden" name="tab" value="drugs" />
            <input name="q" value={data.drugSearch} class="drug-search-input" placeholder="ค้นหาชื่อยา หรือบาร์โค้ด" autocomplete="off" />
            <button type="submit" class="btn-ghost drug-search-btn">
              <i class="bi bi-search"></i>
              <span>ค้นหา</span>
            </button>
            <a class="btn-ghost add-user-link" href="/settings?tab=drugs&mode=new">
              <i class="bi bi-plus-lg"></i>
              <span>เพิ่มยา</span>
            </a>
          </form>

          <div class="user-menu-list">
            {#if filteredDrugs(data.drugs, data.drugSearch).length}
              {#each filteredDrugs(data.drugs, data.drugSearch) as drug}
                <a class="menu-item user-menu-item" href={`/settings?tab=drugs&manage_drug_id=${drug.id}`}>
                  {#if imageUrlFor(drug)}
                    <div class="thumb"><img src={imageUrlFor(drug)} alt="" /></div>
                  {:else}
                    <div class="thumb thumb-ph"><i class="bi bi-capsule"></i></div>
                  {/if}
                  <div class="mi-body">
                    <div class="mi-title">{drug.name}</div>
                    <div class="mi-desc">
                      {#if drug.code}<i class="bi bi-upc"></i> {drug.code} · {/if}{drug.unit || 'หน่วย'}
                      {#if drug.require_lot} · <span class="drug-lot-flag">Lot บังคับ</span>{/if}
                    </div>
                  </div>
                  <i class="bi bi-chevron-right mi-arrow"></i>
                </a>
              {/each}
            {:else if data.drugs.length}
              <div class="empty-state">
                <div class="es-title">ไม่พบรายการที่ค้นหา</div>
              </div>
            {:else}
              <div class="empty-state">
                <div class="es-title">ยังไม่มีรายการยา</div>
                <div>แตะ เพิ่มยา เพื่อเริ่มต้น</div>
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์จัดการรายการยา</p>
      {/if}
    </section>
  {:else if data.tab === 'lot'}
    <section class="panel">
      <div class="section-head">
        <h2>รายการที่ต้องบันทึก Lot No.</h2>
        <span>{data.drugs.filter((drug) => drug.require_lot).length} รายการ</span>
      </div>
      <div class="page-sub">เปิดสวิตช์รายการที่ต้องบังคับกรอก Lot ก่อนบันทึก · บันทึกอัตโนมัติ</div>
      {#if data.canDrug}
        {#if data.drugs.length}
          <div class="lot-list">
            {#each sortedDrugsByName(data.drugs) as drug}
              <form
                method="POST"
                action="?/setRequireLot"
                class="card-soft switch-card lot-item form-toggle"
                use:enhance={enhanceLotToggle}
              >
                <input type="hidden" name="id" value={drug.id} />
                <div class="lot-copy">
                  <strong>{drug.name}</strong>
                  <small class="lot-meta">
                    {#if drug.code}
                      <i class="bi bi-upc"></i> {drug.code}
                    {:else}
                      ไม่มี barcode
                    {/if}
                    {#if drug.unit}
                      · {drug.unit}
                    {/if}
                  </small>
                </div>
                <label class="auto-toggle switch-toggle" for={`lot-required-${drug.id}`}>
                  <input
                    id={`lot-required-${drug.id}`}
                    name="value"
                    type="checkbox"
                    checked={drug.require_lot}
                    onchange={(event) => event.currentTarget.form?.requestSubmit()}
                  />
                </label>
              </form>
            {/each}
          </div>
        {:else}
          <p class="empty">ยังไม่มีรายการยา เพิ่มยาในเมนูรายการยาก่อน</p>
        {/if}
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์จัดการการบังคับ Lot</p>
      {/if}
    </section>
  {:else if data.tab === 'locations'}
    <section class="panel">
      {#if data.canDrug}
        {#if data.managedLocation}
          <div class="settings-subhead">
            <a class="btn-ghost back-link" href="/settings?tab=locations">
              <i class="bi bi-chevron-left"></i>
              <span>กลับ</span>
            </a>
            <div class="page-sub">เพิ่ม แก้ไข ไอคอน สี และจุดเริ่มต้นตอนรับเข้า · บันทึกอัตโนมัติ</div>
          </div>

          <form method="POST" action="?/saveLocation" class="location-editor" use:enhance={enhanceLocationAutosave}>
            <input type="hidden" name="id" value={data.managedLocation.id} />
            <input type="hidden" name="save_mode" value="manual" />
            <input type="hidden" name="redirect_to" value={`/settings?tab=locations&manage_location_id=${data.managedLocation.id}&message=${encodeURIComponent('บันทึกสถานที่แล้ว')}`} />

            <div class="card-soft loc-card">
              <div class="loc-card-head">
                <div class="mi-icon loc-chip" style={`background:${hexToSoft(data.managedLocation.color)};color:${data.managedLocation.color}`}>
                  <i class={`bi ${iconClass(data.managedLocation.icon)}`}></i>
                </div>
                <div class="loc-head-copy">
                  <div class="loc-name">{data.managedLocation.name}</div>
                  {#if data.managedLocation.is_default_receive}
                    <div class="hint loc-default">
                      <i class="bi bi-check-circle-fill"></i>
                      <span>จุดเริ่มต้นรับเข้า</span>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="field">
                <label for="location-name">ชื่อสถานที่</label>
                <input
                  id="location-name"
                  name="name"
                  value={data.managedLocation.name}
                  autocomplete="off"
                  onblur={(event) => queueLocationAutosave(event.currentTarget.form)}
                />
              </div>

              <div class="pick-label">เลือกไอคอน</div>
              <div class="icon-grid">
                {#each locationIconPicker as iconKey}
                  <label
                    class:selected={iconKey === (data.managedLocation.icon || 'box')}
                    class="icon-pick-wrap"
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={iconKey}
                      checked={iconKey === (data.managedLocation.icon || 'box')}
                      onchange={(event) => queueLocationAutosave(event.currentTarget.form)}
                    />
                    <span
                      class:selected={iconKey === (data.managedLocation.icon || 'box')}
                      class="icon-pick"
                      style={iconKey === (data.managedLocation.icon || 'box')
                        ? `background:${hexToSoft(data.managedLocation.color)};color:${data.managedLocation.color};border-color:${data.managedLocation.color}`
                        : ''}
                    >
                      <i class={`bi ${iconClass(iconKey)}`}></i>
                    </span>
                  </label>
                {/each}
              </div>

              <div class="pick-label">เลือกสี</div>
              <div class="color-row">
                {#each locationColorPalette as color}
                  <label class="color-dot-wrap">
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      checked={color.toLowerCase() === (data.managedLocation.color || '').toLowerCase()}
                      onchange={(event) => queueLocationAutosave(event.currentTarget.form)}
                    />
                    <span
                      class:selected={color.toLowerCase() === (data.managedLocation.color || '').toLowerCase()}
                      class="color-dot"
                      style={`background:${color}`}
                    ></span>
                  </label>
                {/each}
              </div>

              <div class="loc-editor-actions">
                <button type="submit">บันทึก</button>
              </div>
            </div>
          </form>

          <div class="loc-side-actions">
            {#if !data.managedLocation.is_default_receive}
              <form method="POST" action="?/setDefaultReceive">
                <input type="hidden" name="id" value={data.managedLocation.id} />
                <input type="hidden" name="redirect_to" value={`/settings?tab=locations&manage_location_id=${data.managedLocation.id}&message=${encodeURIComponent('ตั้งจุดรับเข้าแล้ว')}`} />
                <button type="submit" class="btn-ghost loc-side-btn">
                  <i class="bi bi-star"></i>
                  <span>ตั้งเป็นจุดเริ่มต้น</span>
                </button>
              </form>
            {/if}

            <form
              method="POST"
              action="?/deleteLocation"
              use:enhance={confirmDanger(`ลบ "${data.managedLocation.name}"?`)}
            >
              <input type="hidden" name="id" value={data.managedLocation.id} />
              <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B8%A5%E0%B8%9A%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
              <button type="submit" class="btn-line loc-delete-btn">
                <i class="bi bi-trash3"></i>
                <span>ลบ</span>
              </button>
            </form>
          </div>
        {:else}
          <div class="page-sub">เพิ่ม แก้ไข ไอคอน สี และจุดเริ่มต้นตอนรับเข้า · บันทึกอัตโนมัติ</div>

          <form method="POST" action="?/saveLocation" class="card-soft location-add-shell">
            <input type="hidden" name="icon" value="box" />
            <input type="hidden" name="color" value="#16A34A" />
            <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B9%80%E0%B8%9E%E0%B8%B4%E0%B9%88%E0%B8%A1%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
            <input name="name" class="location-add-input" placeholder="ชื่อสถานที่ใหม่" autocomplete="off" />
            <button type="submit" class="btn-ghost location-add-btn">
              <i class="bi bi-plus-lg"></i>
              <span>เพิ่ม</span>
            </button>
          </form>

          <div class="location-list">
            {#each data.locations as location, index}
              <div class="card-soft loc-card">
                <div class="loc-card-head">
                  <div class="mi-icon loc-chip" style={`background:${hexToSoft(location.color)};color:${location.color}`}>
                    <i class={`bi ${iconClass(location.icon)}`}></i>
                  </div>
                  <div class="loc-head-copy">
                    <div class="loc-name">{location.name}</div>
                    {#if location.is_default_receive}
                      <div class="hint loc-default">
                        <i class="bi bi-check-circle-fill"></i>
                        <span>จุดเริ่มต้นรับเข้า</span>
                      </div>
                    {/if}
                  </div>

                  <div class="loc-move-actions">
                    <form method="POST" action="?/reorderLocations">
                      <input type="hidden" name="ids" value={reorderedLocationIds(location.id, -1)} />
                      <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%A5%E0%B8%B3%E0%B8%94%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
                      <button class="btn-ghost loc-move-btn" type="submit" disabled={index === 0} aria-label="เลื่อนขึ้น">
                        <i class="bi bi-chevron-up"></i>
                      </button>
                    </form>
                    <form method="POST" action="?/reorderLocations">
                      <input type="hidden" name="ids" value={reorderedLocationIds(location.id, 1)} />
                      <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%A5%E0%B8%B3%E0%B8%94%E0%B8%B1%E0%B8%9A%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
                      <button class="btn-ghost loc-move-btn" type="submit" disabled={index === data.locations.length - 1} aria-label="เลื่อนลง">
                        <i class="bi bi-chevron-down"></i>
                      </button>
                    </form>
                  </div>
                </div>

                <div class="loc-list-actions">
                  <a class="btn-ghost loc-list-btn" href={`/settings?tab=locations&manage_location_id=${location.id}`}>
                    <i class="bi bi-pencil"></i>
                    <span>แก้ชื่อ</span>
                  </a>

                  <form
                    method="POST"
                    action="?/deleteLocation"
                    use:enhance={confirmDanger(`ลบ "${location.name}"?`)}
                  >
                    <input type="hidden" name="id" value={location.id} />
                    <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B8%A5%E0%B8%9A%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
                    <button class="btn-ghost loc-list-btn loc-danger" type="submit">
                      <i class="bi bi-trash3"></i>
                      <span>ลบ</span>
                    </button>
                  </form>

                  {#if !location.is_default_receive}
                    <form method="POST" action="?/setDefaultReceive">
                      <input type="hidden" name="id" value={location.id} />
                      <input type="hidden" name="redirect_to" value="/settings?tab=locations&message=%E0%B8%95%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B8%88%E0%B8%B8%E0%B8%94%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B9%80%E0%B8%82%E0%B9%89%E0%B8%B2%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7" />
                      <button class="btn-ghost loc-list-btn" type="submit">
                        <i class="bi bi-star"></i>
                        <span>ตั้งเป็นจุดเริ่มต้น</span>
                      </button>
                    </form>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์จัดการสถานที่</p>
      {/if}
    </section>
  {:else if data.tab === 'notify'}
    <section class="panel">
      <div class="section-head">
        <h2>การแจ้งเตือน</h2>
        <span>{data.notification?.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}</span>
      </div>
      {#if data.canAdmin && data.notification}
        <div class="page-sub">ตั้งค่าช่องทางและเวลาส่งสรุปยาใกล้หมดอายุประจำวัน</div>
        <form method="POST" action="?/saveNotification" class="notify-shell">
          <div class="card-soft switch-card notify-toggle">
            <div>
              <div class="switch-title">เปิดการแจ้งเตือน</div>
              <div class="hint">ส่งสรุปยาใกล้หมดอายุทุกวัน</div>
            </div>
            <label class="auto-toggle switch-toggle" for="notify-enabled">
              <input id="notify-enabled" name="enabled" type="checkbox" checked={data.notification.enabled} />
            </label>
          </div>

          <div class="notify-form">
            <label>
              <span>ช่องทาง</span>
              <select name="channel" bind:value={notificationChannel}>
                <option value="telegram">Telegram</option>
                <option value="line">LINE Messaging API</option>
              </select>
            </label>
            <label>
              <span>เวลาส่ง</span>
              <input name="notify_time" type="time" value={data.notification.notify_time || '08:00'} />
            </label>
          </div>

          {#if notificationChannel !== 'line'}
            <div class="notify-channel-block">
              <label>
                <span>Telegram Chat ID</span>
                <input name="telegram_chat_id" value={data.notification.telegram_chat_id || ''} autocomplete="off" placeholder="-1001234567890" />
              </label>
              <label>
                <span>Telegram Bot Token</span>
                <input
                  name="telegram_bot_token"
                  autocomplete="off"
                  placeholder={data.notification.has_telegram_token ? 'ตั้งค่าไว้แล้ว (เว้นว่างถ้าไม่เปลี่ยน)' : 'วาง bot token'}
                />
              </label>
              <div class="hint">สร้างบอทด้วย @BotFather แล้วเอา token กับ chat id มาวาง</div>
              <label class="check-line notify-clear">
                <input name="clear_telegram_token" type="checkbox" />
                <span>ลบ Telegram token</span>
              </label>
            </div>
          {:else}
            <div class="notify-channel-block">
              <label>
                <span>LINE Channel Access Token</span>
                <input
                  name="line_token"
                  autocomplete="off"
                  placeholder={data.notification.has_line_token ? 'ตั้งค่าไว้แล้ว (เว้นว่างถ้าไม่เปลี่ยน)' : 'วาง channel access token'}
                />
              </label>
              <div class="hint">ใช้ broadcast ของ Messaging API; LINE Notify ถูกยกเลิกแล้ว</div>
              <label class="check-line notify-clear">
                <input name="clear_line_token" type="checkbox" />
                <span>ลบ LINE token</span>
              </label>
            </div>
          {/if}

          <button type="submit">บันทึกการแจ้งเตือน</button>
        </form>
        <form method="POST" action="?/testNotification" class="test-form">
          <button type="submit">ส่งข้อความทดสอบ</button>
          <p class="empty">จะส่งจริงไปยัง channel ที่ตั้งไว้ในขณะนี้</p>
        </form>
        <p class="hint notify-setup-note">สำหรับ production ให้เรียก `POST /api/notifications/run` พร้อม `x-notify-secret` หรือ `?secret=` ที่ตรงกับ `NOTIFY_RUN_SECRET`</p>
      {:else}
        <p class="empty">เฉพาะผู้ดูแลระบบเท่านั้นที่ตั้งค่าการแจ้งเตือนได้</p>
      {/if}
    </section>
  {:else if data.tab === 'export'}
    <section class="panel">
      <div class="section-head">
        <h2>ส่งออกข้อมูล</h2>
        <span>{form?.exportResult?.count || 0} รายการ</span>
      </div>
      <form method="POST" action="?/exportData" class="export-form">
        <label>
          <span>ประเภทข้อมูล</span>
          <select name="kind" bind:value={exportKind}>
            <option value="receive">รับเข้า</option>
            <option value="all">การเคลื่อนไหวทั้งหมด</option>
            <option value="stock">สต็อกคงเหลือปัจจุบัน</option>
          </select>
        </label>
        {#if exportKind !== 'stock'}
          <label>
            <span>ตั้งแต่วันที่</span>
            <input name="from" type="date" bind:value={exportFrom} />
          </label>
          <label>
            <span>ถึงวันที่</span>
            <input name="to" type="date" bind:value={exportTo} />
          </label>
          <div class="export-presets">
            <button type="button" class="btn-ghost export-preset-btn" onclick={() => setExportPreset('today')}>วันนี้</button>
            <button type="button" class="btn-ghost export-preset-btn" onclick={() => setExportPreset('month')}>เดือนนี้</button>
          </div>
        {/if}
        <button type="submit">เตรียมข้อมูล</button>
      </form>

      {#if form?.exportResult}
        {#if form.exportResult.rows.length}
          <div class="export-actions">
            <a class="download" href={exportHref(form.exportResult)}>ดาวน์โหลด CSV</a>
            <span>{form.exportResult.count} รายการ · เปิดด้วย Excel หรือ Google Sheets ได้</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  {#each form.exportResult.columns as column}
                    <th>{column}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each form.exportResult.rows.slice(0, 40) as row}
                  <tr>
                    {#each row as cell}
                      <td>{cell}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">ไม่มีข้อมูลในช่วงที่เลือก</p>
        {/if}
      {/if}
    </section>
  {:else if data.tab === 'history'}
    <section class="panel">
      <div class="section-head">
        <h2>ประวัติการเคลื่อนไหว</h2>
        <span>{data.history.length} รายการ</span>
      </div>
      <div class="page-sub">รายการล่าสุดของการรับเข้า ย้าย ตัดจ่าย และปรับยอด</div>
      <div class="filter-row">
        {#each historyFilters as filter}
          <a
            class:selected={data.historyType === filter.id}
            href={`/settings?tab=history${filter.id ? `&type=${filter.id}` : ''}`}
          >
            {filter.label}
          </a>
        {/each}
      </div>
      {#if data.history.length}
        <div class="history-list">
          {#each data.history as item}
            {@const meta = historyMeta(item.type)}
            <article class="history-row">
              <div class="mi-icon history-icon" style={`background: transparent; color: ${meta.color};`}>
                <i class={`bi ${meta.icon}`}></i>
              </div>
              <div class="history-copy">
                <div class="history-title">
                  <strong>{item.drug_name || '-'}</strong>
                  <span class="history-kind">· {meta.label}</span>
                </div>
                <small class="history-route">
                  {historyRoute(item)}
                  {#if item.lot_no}
                    · Lot {item.lot_no}
                  {/if}
                </small>
              </div>
              <div class="history-right">
                <em>{item.qty}</em>
                <small>{formatDate(item.created_at)}</small>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">ยังไม่มีประวัติ</p>
      {/if}
    </section>
  {:else if data.tab === 'audit'}
    <section class="panel">
      <div class="page-sub">เลือกสถานที่ แล้วกรอกจำนวนที่นับได้จริง</div>
      {#if data.canStock}
        <form method="GET" action="/settings" class="field audit-location-field audit-location-form">
          <input type="hidden" name="tab" value="audit" />
          <label for="audit-location">สถานที่</label>
          <select
            id="audit-location"
            name="location_id"
            onchange={changeAuditLocation}
          >
            <option value="">เลือกสถานที่</option>
            {#each sortedLocations(data.locations) as location}
              <option value={location.id} selected={data.selectedLocation?.id === location.id}>{location.name}</option>
            {/each}
          </select>
          <noscript><button type="submit">โหลดรายการ</button></noscript>
        </form>

        {#if data.selectedLocation}
          <div class="audit-list">
            {#each data.selectedItems as item}
              <article class="audit-card">
                <div class="audit-copy">
                  <strong>{item.drug_name}</strong>
                  <span>
                    {#if item.lot_no}Lot {item.lot_no} · {/if}ระบบมี {item.qty}{#if item.expiry_date} · หมดอายุ {formatDate(item.expiry_date)}{/if}
                  </span>
                </div>
                <form method="POST" action="?/adjust" use:enhance={enhanceAuditRow} class="audit-form">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="selected_location_id" value={data.selectedLocation.id} />
                  <input name="actual_qty" type="number" min="0" inputmode="numeric" placeholder="นับจริง" />
                  <button type="submit" class="btn-ghost">บันทึก</button>
                </form>
              </article>
            {/each}
          </div>
          {#if !data.selectedItems.length}
            <p class="empty">ไม่มียาในจุดนี้</p>
          {/if}
        {:else}
          <p class="empty">เลือกสถานที่เพื่อเริ่มตรวจนับ</p>
        {/if}
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์ตรวจนับสต็อก</p>
      {/if}
    </section>
  {:else if data.tab === 'report'}
    <section class="panel">
      <form class="report-legacy" method="GET" action="/settings/report" target="_blank" rel="noreferrer" onsubmit={openReport}>
        <div class="field">
          <label for="report-type">ประเภทรายงาน</label>
          <select id="report-type" name="kind" bind:value={reportType}>
            <option value="near">ยาใกล้หมดอายุ (ภายใน {data.config.expiry_thresholds?.medium || 120} วัน)</option>
            <option value="stock">สต็อกคงเหลือทั้งหมด</option>
          </select>
        </div>
        <button class="btn-brand report-submit" type="submit">
          <i class="bi bi-printer"></i>
          <span>{reportPending ? 'กำลังเปิดรายงาน...' : 'สร้างรายงานและพิมพ์'}</span>
        </button>
        <p class="hint report-hint">ในหน้าต่างพิมพ์ เลือกปลายทางเป็น "บันทึกเป็น PDF" เพื่อได้ไฟล์ PDF</p>
      </form>
    </section>
  {/if}
</main>

<style>
  .settings-shell {
    padding-bottom: 86px;
  }

  .settings-nav-top {
    display: grid;
    gap: 14px;
    margin: 12px 0 16px;
  }

  .back-link {
    width: auto;
    text-decoration: none;
    justify-self: start;
  }

  .page-head,
  .section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }

  .page-head {
    margin-bottom: 18px;
  }

  .eyebrow {
    margin: 0 0 4px;
    color: #5b3fc2;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h2,
  p {
    margin: 0;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .tabs a,
  .filter-row a {
    padding: 10px 14px;
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
    color: #4d4858;
    font-weight: 800;
    text-decoration: none;
  }

  .tabs a.selected,
  .filter-row a.selected {
    border-color: #5b3fc2;
    color: #5b3fc2;
    box-shadow: 0 0 0 2px #e8e2ff;
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

  .menu-list {
    display: grid;
    gap: 12px;
  }

  .root-menu-item {
    width: 100%;
    text-decoration: none;
    margin-bottom: 12px;
  }

  .panel,
  .user-card,
  .history-list article,
  .audit-list article {
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .panel {
    padding: 18px;
  }

  .account-legacy,
  .hospital-brand {
    padding: 18px;
    margin-bottom: 18px;
  }

  .account-last {
    margin-bottom: 0;
  }

  .account-label,
  .general-label {
    margin-top: 0;
  }

  .account-form,
  .general-form {
    display: grid;
  }

  .hospital-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hospital-brand-copy {
    min-width: 0;
    flex: 1;
  }

  .hospital-brand-title {
    font-weight: 600;
    margin-bottom: 6px;
  }

  .logo-upload-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: -6px 0 18px;
  }

  .logo-upload-btn,
  .logo-remove-btn {
    width: auto;
    text-decoration: none;
  }

  .logo-remove-form {
    margin: -8px 0 18px;
  }

  .threshold-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .threshold-hint {
    margin: -6px 0 16px;
  }

  .display-check {
    margin: 2px 0 16px;
  }

  .panel.compact {
    padding: 16px 18px;
  }

  .section-head {
    margin-bottom: 14px;
  }

  .section-head span,
  .empty,
  small,
  .history-list span,
  .audit-list span {
    color: #666174;
  }

  .form-grid,
  .add-user,
  .master-form,
  .notify-form,
  .export-form {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .export-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .export-preset-btn {
    width: auto;
  }

  .notify-form {
    align-items: end;
  }

  .notify-shell {
    display: grid;
    gap: 12px;
  }

  .notify-toggle {
    margin-bottom: 0;
  }

  .notify-channel-block {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid #eeeaf5;
    border-radius: 14px;
    background: #fbfafc;
  }

  .notify-clear {
    margin: 0;
  }

  .notify-setup-note {
    margin: 12px 0 0;
  }

  .test-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }

  .logout-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 22px;
    text-decoration: none;
  }

  .manual-list {
    display: grid;
    gap: 10px;
  }

  .manual-list details {
    border: 1px solid #eeeaf5;
    border-radius: 12px;
    background: #fbfafc;
    padding: 12px 14px;
  }

  .manual-list summary {
    cursor: pointer;
    font-weight: 800;
  }

  .manual-list p {
    margin-top: 10px;
    color: #4d4858;
    line-height: 1.65;
  }

  .switch-card,
  .lot-list,
  .report-grid {
    display: grid;
    gap: 12px;
  }

  .switch-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px;
    border: 1px solid #eeeaf5;
    border-radius: 14px;
    background: #fbfafc;
  }

  .switch-card {
    margin-bottom: 12px;
  }

  .switch-title {
    font-weight: 600;
  }

  .lot-item {
    margin-bottom: 0;
  }

  .lot-copy {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .lot-meta {
    display: block;
  }

  .switch-toggle input[type='checkbox'] {
    width: 22px;
    height: 22px;
  }

  .auto-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .form-toggle {
    margin: 0;
  }

  .report-legacy {
    display: grid;
    gap: 12px;
  }

  .report-submit {
    width: fit-content;
    min-width: 0;
  }

  .report-hint {
    margin-top: 0;
  }

  .master-form {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid #eeeaf5;
    border-radius: 8px;
    background: #fbfafc;
  }

  .drug-upload-form {
    display: contents;
  }

  label {
    display: grid;
    gap: 6px;
    font-weight: 800;
  }

  label span {
    color: #666174;
    font-size: 0.82rem;
  }

  input,
  select {
    min-height: 40px;
    padding: 0 11px;
    border: 1px solid #cfcadb;
    border-radius: 8px;
    background: #fff;
    color: inherit;
    font: inherit;
  }

  .wide {
    grid-column: span 2;
  }

  .check-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
  }

  .check-line input {
    min-height: auto;
  }

  button {
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #5b3fc2;
    color: #fff;
    font: inherit;
    font-weight: 800;
  }

  .download {
    display: inline-grid;
    place-items: center;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 8px;
    background: #067647;
    color: #fff;
    font-weight: 800;
    text-decoration: none;
  }

  .danger {
    background: #b42318;
  }

  .error,
  .ok {
    margin-bottom: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    font-weight: 700;
  }

  .error {
    background: #fef3f2;
    color: #b42318;
  }

  .ok {
    background: #ecfdf3;
    color: #067647;
  }

  .user-list,
  .history-list,
  .audit-list {
    display: grid;
    gap: 10px;
  }

  .user-title {
    display: grid;
    gap: 3px;
  }

  .settings-subhead {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  .add-user-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: auto;
    margin: 0 0 16px;
    text-decoration: none;
  }

  .user-menu-list {
    display: grid;
    gap: 12px;
  }

  .user-menu-item {
    width: 100%;
    text-decoration: none;
  }

  .user-disabled {
    margin-left: 6px;
    font-weight: 400;
  }

  .user-editor {
    display: grid;
    gap: 12px;
  }

  .editor-switch {
    margin: 0;
  }

  .editor-check {
    margin: 0;
  }

  .user-delete-form {
    margin-top: 12px;
  }

  .user-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    text-decoration: none;
  }

  .location-add-shell {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
    padding: 14px;
  }

  .location-add-input {
    flex: 1;
  }

  .location-add-btn {
    width: auto;
    text-decoration: none;
  }

  .location-list {
    display: grid;
    gap: 16px;
  }

  .location-editor {
    display: grid;
    gap: 16px;
  }

  .loc-card {
    padding: 16px;
  }

  .loc-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .loc-chip {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
  }

  .loc-head-copy {
    min-width: 0;
    flex: 1;
  }

  .loc-name {
    font-weight: 600;
  }

  .loc-default {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    color: #5b3fc2;
  }

  .loc-move-actions,
  .loc-list-actions,
  .loc-side-actions,
  .loc-editor-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .loc-move-actions {
    margin-left: auto;
  }

  .loc-move-btn,
  .loc-list-btn,
  .loc-side-btn {
    width: auto;
    text-decoration: none;
  }

  .loc-danger {
    background: transparent;
    color: #b42318;
  }

  .loc-editor-actions {
    margin-top: 4px;
  }

  .loc-side-actions {
    margin-top: 14px;
  }

  .loc-delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: auto;
    text-decoration: none;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .icon-pick-wrap,
  .color-dot-wrap {
    display: contents;
  }

  .icon-pick-wrap input,
  .color-dot-wrap input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .drug-search-row {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .drug-search-input {
    flex: 1;
  }

  .drug-search-btn {
    width: auto;
  }

  .drug-editor {
    display: grid;
    gap: 12px;
  }

  .drug-form-image {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    padding: 14px 16px;
  }

  .drug-form-preview {
    flex: 0 0 auto;
  }

  .drug-form-copy {
    min-width: 0;
    flex: 1;
  }

  .drug-form-title {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .drug-form-upload-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .drug-two-col {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .drug-code-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .drug-code-row input {
    flex: 1;
  }

  .drug-camera-btn {
    width: auto;
    flex: 0 0 auto;
  }

  .drug-lot-flag {
    color: #5b3fc2;
  }

  .inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .export-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 16px 0 12px;
  }

  .export-actions span {
    color: #666174;
    font-weight: 700;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid #eeeaf5;
    border-radius: 8px;
  }

  table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    background: #fff;
  }

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #eeeaf5;
    text-align: left;
    white-space: nowrap;
  }

  th {
    background: #fbfafc;
    color: #4d4858;
    font-size: 0.82rem;
  }

  button:disabled {
    background: #bdb7cc;
    cursor: not-allowed;
  }

  .history-route,
  .audit-list span {
    display: block;
    margin-top: 3px;
  }

  .history-row,
  .audit-list article {
    padding: 12px 14px;
  }

  .history-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .audit-list article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
  }

  .history-icon {
    flex: none;
  }

  .history-copy {
    min-width: 0;
  }

  .history-title {
    font-weight: 600;
  }

  .history-kind {
    color: #666174;
    font-weight: 400;
  }

  .history-right {
    text-align: right;
  }

  .history-list em {
    font-style: normal;
    font-weight: 900;
  }

  .location-picker {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 10px;
    margin-bottom: 14px;
  }

  .audit-list form {
    display: flex;
    gap: 8px;
  }

  .audit-list input {
    width: 120px;
  }

  @media (max-width: 780px) {
    .page-head,
    .section-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .form-grid,
    .add-user,
    .master-form,
    .notify-form,
    .export-form,
    .history-row,
    .audit-list article,
    .location-picker {
      grid-template-columns: 1fr;
    }

    .threshold-grid {
      grid-template-columns: 1fr;
    }

    .location-add-shell,
    .loc-card-head,
    .drug-search-row,
    .drug-form-image {
      flex-direction: column;
      align-items: stretch;
    }

    .loc-move-actions {
      margin-left: 0;
    }

    .icon-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .drug-two-col {
      grid-template-columns: 1fr;
    }

    .menu-grid {
      grid-template-columns: 1fr;
    }

    .wide {
      grid-column: auto;
    }

    .audit-list form {
      display: grid;
    }

    .audit-list input {
      width: auto;
    }

    .drug-upload-form {
      display: grid;
      gap: 8px;
    }
  }
</style>
