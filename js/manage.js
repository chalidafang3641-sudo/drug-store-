/* manage.js - พาร์ท 2: สถานที่เก็บยา / รายการยา / Lot บังคับ */

const ICON_PICKER = ['box', 'archive', 'firstaid', 'building', 'injection', 'bed', 'asterisk', 'cart', 'people', 'bolt'];
const COLOR_PALETTE = ['#16A34A', '#2563EB', '#06B6D4', '#F97316', '#EAB308', '#EF4444', '#8B5CF6', '#64748B'];

const Manage = {
  _locs: [],
  _drugs: [],

  /* ==================== สถานที่เก็บยา ==================== */
  async locations(view) {
    view.innerHTML = `${Settings.back()}
      <div class="page-title">สถานที่เก็บยา</div>
      <div class="page-sub">เพิ่ม แก้ไข ไอคอน สี และจุดเริ่มต้นตอนรับเข้า · บันทึกอัตโนมัติ</div>

      <div class="card-soft" style="padding:14px;display:flex;gap:10px;margin-bottom:18px">
        <input type="text" id="newLocName" class="flex-fill" placeholder="ชื่อสถานที่ใหม่"
          style="padding:11px 12px;border:1px solid var(--line);border-radius:12px;font-family:inherit;outline:none">
        <button id="addLocBtn" class="btn-ghost" style="width:auto"><i class="bi bi-plus-lg"></i> เพิ่ม</button>
      </div>

      <div id="locList">${App.loader()}</div>`;

    document.getElementById('addLocBtn').addEventListener('click', () => this.addLocation());
    document.getElementById('newLocName').addEventListener('keydown', e => { if (e.key === 'Enter') this.addLocation(); });

    await this.loadLocations();
  },

  async loadLocations() {
    const r = await api('getLocations').catch(() => null);
    this._locs = ((r && r.data) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    this.renderLocList();
  },

  renderLocList() {
    const wrap = document.getElementById('locList');
    if (!wrap) return;
    if (!this._locs.length) { wrap.innerHTML = '<div class="empty-state">ยังไม่มีสถานที่</div>'; return; }
    wrap.innerHTML = this._locs.map((l, i) => this.locCardHtml(l, i)).join('');
    this._locs.forEach(l => this.bindLocCard(l));
  },

  locCardHtml(loc, idx) {
    const soft = hexToSoft(loc.color);
    const icons = ICON_PICKER.map(k => `
      <div class="icon-pick ${k === loc.icon ? 'sel' : ''}" data-icon="${k}"
        style="${k === loc.icon ? `background:${soft};color:${loc.color};border-color:${loc.color}` : ''}">
        <i class="bi ${iconClass(k)}"></i></div>`).join('');
    const colors = COLOR_PALETTE.map(c => `
      <div class="color-dot ${c.toLowerCase() === (loc.color || '').toLowerCase() ? 'sel' : ''}"
        data-color="${c}" style="background:${c}"></div>`).join('');

    return `
    <div class="card-soft loc-card" data-id="${loc.id}" style="padding:16px;margin-bottom:16px">
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="mi-icon" data-chip style="background:${soft};color:${loc.color}"><i class="bi ${iconClass(loc.icon)}"></i></div>
        <div class="flex-fill" style="min-width:0">
          <div class="loc-name" style="font-weight:600">${App.esc(loc.name)}</div>
          ${loc.is_default_receive ? '<div class="hint" style="margin:0;color:var(--brand-strong)"><i class="bi bi-check-circle-fill"></i> จุดเริ่มต้นรับเข้า</div>' : ''}
        </div>
        <button class="btn-ghost px-2 py-1" data-act="up" ${idx === 0 ? 'disabled style="opacity:.35"' : ''}><i class="bi bi-chevron-up"></i></button>
        <button class="btn-ghost px-2 py-1" data-act="down" ${idx === this._locs.length - 1 ? 'disabled style="opacity:.35"' : ''}><i class="bi bi-chevron-down"></i></button>
      </div>

      <div class="d-flex gap-2 mb-3">
        <button class="btn-ghost" style="width:auto" data-act="rename"><i class="bi bi-pencil"></i> แก้ชื่อ</button>
        <button class="btn-ghost" style="width:auto;background:transparent;color:var(--danger)" data-act="del"><i class="bi bi-trash3"></i> ลบ</button>
        ${loc.is_default_receive ? '' : '<button class="btn-ghost" style="width:auto" data-act="setdef"><i class="bi bi-star"></i> ตั้งเป็นจุดเริ่มต้น</button>'}
      </div>

      <div class="pick-label">เลือกไอคอน</div>
      <div class="icon-grid mb-3">${icons}</div>
      <div class="pick-label">เลือกสี</div>
      <div class="color-row">${colors}</div>
    </div>`;
  },

  bindLocCard(loc) {
    const card = document.querySelector(`.loc-card[data-id="${loc.id}"]`);
    if (!card) return;

    card.querySelectorAll('.icon-pick').forEach(el => el.addEventListener('click', () => {
      loc.icon = el.dataset.icon;
      card.querySelectorAll('.icon-pick').forEach(x => { x.classList.remove('sel'); x.removeAttribute('style'); });
      el.classList.add('sel');
      el.style.cssText = `background:${hexToSoft(loc.color)};color:${loc.color};border-color:${loc.color}`;
      card.querySelector('[data-chip]').innerHTML = `<i class="bi ${iconClass(loc.icon)}"></i>`;
      this.saveLoc(loc);
    }));

    card.querySelectorAll('.color-dot').forEach(el => el.addEventListener('click', () => {
      loc.color = el.dataset.color;
      card.querySelectorAll('.color-dot').forEach(x => x.classList.remove('sel'));
      el.classList.add('sel');
      const soft = hexToSoft(loc.color);
      const chip = card.querySelector('[data-chip]'); chip.style.background = soft; chip.style.color = loc.color;
      const selIcon = card.querySelector('.icon-pick.sel');
      if (selIcon) selIcon.style.cssText = `background:${soft};color:${loc.color};border-color:${loc.color}`;
      this.saveLoc(loc);
    }));

    card.querySelector('[data-act="rename"]').addEventListener('click', () => {
      const name = prompt('แก้ชื่อสถานที่', loc.name);
      if (name && name.trim()) { loc.name = name.trim(); card.querySelector('.loc-name').textContent = loc.name; this.saveLoc(loc); }
    });
    card.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm(`ลบ "${loc.name}"?`)) return;
      const r = await api('deleteLocation', { id: loc.id }).catch(() => null);
      if (r && r.status === 'success') { App.toast('ลบแล้ว', 'ok'); this.loadLocations(); }
      else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
    });
    const setdef = card.querySelector('[data-act="setdef"]');
    if (setdef) setdef.addEventListener('click', async () => {
      const r = await api('setDefaultReceive', { id: loc.id }).catch(() => null);
      if (r && r.status === 'success') { App.toast('ตั้งจุดเริ่มต้นรับเข้าแล้ว', 'ok'); this.loadLocations(); }
    });
    card.querySelector('[data-act="up"]').addEventListener('click', () => this.move(loc.id, -1));
    card.querySelector('[data-act="down"]').addEventListener('click', () => this.move(loc.id, 1));
  },

  async saveLoc(loc) {
    const r = await api('saveLocation', { location: { id: loc.id, name: loc.name, icon: loc.icon, color: loc.color } }).catch(() => null);
    if (!r || r.status !== 'success') App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
  },

  async addLocation() {
    const input = document.getElementById('newLocName');
    const name = input.value.trim();
    if (!name) { App.toast('กรอกชื่อสถานที่', 'err'); return; }
    const r = await api('saveLocation', { location: { name, icon: 'box', color: '#16A34A' } }).catch(() => null);
    if (r && r.status === 'success') { input.value = ''; App.toast('เพิ่มสถานที่แล้ว', 'ok'); this.loadLocations(); }
    else App.toast((r && r.message) || 'เพิ่มไม่สำเร็จ', 'err');
  },

  async move(id, dir) {
    const i = this._locs.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this._locs.length) return;
    const tmp = this._locs[i]; this._locs[i] = this._locs[j]; this._locs[j] = tmp;
    this.renderLocList();
    const ids = this._locs.map(l => l.id);
    await api('reorderLocations', { ids }).catch(() => App.toast('จัดลำดับไม่สำเร็จ', 'err'));
  },

  /* ==================== รายการยา ==================== */
  async drugs(view) {
    view.innerHTML = `${Settings.back()}
      <div class="page-title">รายการยา</div>
      <div class="d-flex gap-2 mb-3">
        <input type="text" id="drugSearch" class="flex-fill" placeholder="ค้นหาชื่อยา หรือบาร์โค้ด"
          style="padding:12px 14px;border:1px solid var(--line);border-radius:12px;font-family:inherit;outline:none">
        <button id="addDrugBtn" class="btn-ghost" style="width:auto"><i class="bi bi-plus-lg"></i> เพิ่มยา</button>
      </div>
      <div id="drugList">${App.loader()}</div>`;

    document.getElementById('addDrugBtn').addEventListener('click', () => this.drugForm(view, null));
    document.getElementById('drugSearch').addEventListener('input', e => this.renderDrugList(e.target.value));
    await this.loadDrugs();
  },

  async loadDrugs() {
    const [rd, rl] = await Promise.all([api('getDrugs').catch(() => null), api('getLocations').catch(() => null)]);
    this._drugs = ((rd && rd.data) || []).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    this._locs = ((rl && rl.data) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    this.renderDrugList('');
  },

  renderDrugList(q) {
    const wrap = document.getElementById('drugList');
    if (!wrap) return;
    q = (q || '').trim().toLowerCase();
    const list = this._drugs.filter(d =>
      !q || d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q));
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="bi bi-capsule"></i></div>
        <div class="es-title">${this._drugs.length ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการยา'}</div>
        <div>${this._drugs.length ? '' : 'แตะ เพิ่มยา เพื่อเริ่มต้น'}</div></div>`;
      return;
    }
    wrap.innerHTML = list.map(d => `
      <button class="menu-item" data-id="${d.id}">
        ${drugThumb(d.image_url)}
        <div class="mi-body">
          <div class="mi-title">${App.esc(d.name)}</div>
          <div class="mi-desc">
            ${d.code ? '<i class="bi bi-upc"></i> ' + App.esc(d.code) + ' · ' : ''}${App.esc(d.unit || 'หน่วย')}
            ${d.require_lot ? ' · <span style="color:var(--brand-strong)">Lot บังคับ</span>' : ''}
          </div>
        </div>
        <i class="bi bi-chevron-right mi-arrow"></i>
      </button>`).join('');
    wrap.querySelectorAll('.menu-item').forEach(b =>
      b.addEventListener('click', () => {
        const d = this._drugs.find(x => x.id === b.dataset.id);
        this.drugForm(document.getElementById('view'), d);
      }));
  },

  drugForm(view, drug) {
    const isEdit = !!drug;
    drug = drug || { name: '', code: '', unit: '', require_lot: false, default_location_id: '', image_file_id: '', image_url: '', min_qty: 0 };
    const locOpts = ['<option value="">ไม่ระบุ</option>']
      .concat(this._locs.map(l => `<option value="${l.id}" ${l.id === drug.default_location_id ? 'selected' : ''}>${App.esc(l.name)}</option>`))
      .join('');

    view.innerHTML = `
      <button class="btn-ghost" style="width:auto;margin-bottom:16px" id="drugBack"><i class="bi bi-chevron-left"></i> กลับ</button>
      <div class="page-title">${isEdit ? 'แก้ไขยา' : 'เพิ่มยา'}</div>

      <div class="card-soft d-flex align-items-center gap-3" style="padding:14px 16px;margin:0 0 18px">
        <div class="img-pick" id="dImgPrev">${drug.image_url ? `<img src="${drug.image_url}">` : '<i class="bi bi-camera"></i>'}</div>
        <div class="flex-fill">
          <div style="font-weight:600;margin-bottom:8px">รูปยา</div>
          <div class="d-flex gap-2">
            <button type="button" id="dImgPick" class="btn-ghost" style="width:auto">เลือกรูป</button>
            <button type="button" id="dImgDel" class="btn-ghost" style="width:auto;background:transparent;color:var(--danger);${drug.image_url ? '' : 'display:none'}">ลบ</button>
          </div>
          <div class="hint">ถ่ายรูปหรือเลือกจากคลังภาพ</div>
        </div>
        <input type="file" id="dImgFile" accept="image/*" style="display:none">
      </div>

      <div class="field"><label>ชื่อยา</label>
        <input type="text" id="dName" value="${App.esc(drug.name)}" placeholder="เช่น Paracetamol 500mg"></div>

      <div class="field"><label>บาร์โค้ด / รหัส</label>
        <div class="d-flex gap-2">
          <input type="text" id="dCode" class="flex-fill" value="${App.esc(drug.code || '')}" placeholder="ยิงหรือพิมพ์บาร์โค้ด">
          <button id="dScan" class="btn-ghost" style="width:auto"><i class="bi bi-camera-fill"></i></button>
        </div>
        <div id="dCamBox" class="cam-box"></div>
        <div class="hint">ยิงด้วยเครื่องยิงเข้าช่องนี้ได้เลย หรือกดกล้องเพื่อสแกน</div>
      </div>

      <div class="d-flex gap-2">
        <div class="field flex-fill"><label>หน่วย</label>
          <input type="text" id="dUnit" value="${App.esc(drug.unit || '')}" placeholder="เม็ด / ขวด / แผง"></div>
        <div class="field flex-fill"><label>จุดเก็บเริ่มต้น</label>
          <select id="dLoc">${locOpts}</select></div>
      </div>

      <div class="field"><label>แจ้งเตือนเมื่อสต็อกรวมต่ำกว่า (0 = ปิด)</label>
        <input type="number" id="dMin" min="0" value="${drug.min_qty || 0}" inputmode="numeric"></div>

      <div class="card-soft d-flex align-items-center justify-content-between" style="padding:14px 16px;margin-bottom:18px">
        <div><div style="font-weight:600">บังคับกรอก Lot No.</div>
          <div class="hint" style="margin:2px 0 0">ต้องกรอก Lot ก่อนบันทึกตอนรับเข้า</div></div>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" id="dLot" ${drug.require_lot ? 'checked' : ''} style="transform:scale(1.3)">
        </div>
      </div>

      <button id="dSave" class="btn-brand">${isEdit ? 'บันทึก' : 'เพิ่มยา'}</button>
      ${isEdit ? '<button id="dDel" class="btn-line" style="margin-top:12px"><i class="bi bi-trash3"></i> ลบรายการยานี้</button>' : ''}
    `;

    document.getElementById('drugBack').addEventListener('click', () => { Scanner.stopCamera(); this.drugs(view); });

    // รูปยา
    let imgFileId = drug.image_file_id || '';
    let imgCleared = false;
    const imgPrev = document.getElementById('dImgPrev');
    const imgFile = document.getElementById('dImgFile');
    const imgDel = document.getElementById('dImgDel');
    document.getElementById('dImgPick').addEventListener('click', () => imgFile.click());
    imgFile.addEventListener('change', async () => {
      const f = imgFile.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { App.toast('ไฟล์ใหญ่เกิน 5MB', 'err'); return; }
      imgPrev.innerHTML = '<span class="spin spin-brand"></span>';
      const base64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
      if (!base64) { App.toast('อ่านไฟล์ไม่ได้', 'err'); imgPrev.innerHTML = '<i class="bi bi-camera"></i>'; return; }
      const up = await api('uploadImage', { base64, filename: f.name }).catch(() => null);
      if (up && up.status === 'success') { imgFileId = up.file_id; imgCleared = false; imgPrev.innerHTML = `<img src="${up.url}">`; imgDel.style.display = ''; App.toast('อัปโหลดรูปแล้ว', 'ok'); }
      else { App.toast((up && up.message) || 'อัปโหลดไม่สำเร็จ', 'err'); imgPrev.innerHTML = imgFileId ? imgPrev.innerHTML : '<i class="bi bi-camera"></i>'; }
    });
    imgDel.addEventListener('click', () => { imgFileId = ''; imgCleared = true; imgPrev.innerHTML = '<i class="bi bi-camera"></i>'; imgDel.style.display = 'none'; });

    // สแกนเติมบาร์โค้ด (กล้อง) + HID ผ่านช่อง input ปกติ
    const codeInput = document.getElementById('dCode');
    Scanner.bindInput(codeInput, (code) => { codeInput.value = code; App.toast('รับบาร์โค้ด: ' + code, 'ok'); }, { clear: false });
    document.getElementById('dScan').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (Scanner.isCameraOpen()) { await Scanner.stopCamera(); btn.innerHTML = '<i class="bi bi-camera-fill"></i>'; return; }
      try {
        btn.innerHTML = '<i class="bi bi-x-lg"></i>';
        await Scanner.startCamera('dCamBox', async (code) => {
          codeInput.value = code; App.toast('รับบาร์โค้ด: ' + code, 'ok');
          await Scanner.stopCamera(); btn.innerHTML = '<i class="bi bi-camera-fill"></i>';
        });
      } catch (err) { btn.innerHTML = '<i class="bi bi-camera-fill"></i>'; App.toast(err.message || 'เปิดกล้องไม่ได้', 'err'); }
    });

    document.getElementById('dSave').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const payload = {
        id: drug.id,
        name: document.getElementById('dName').value.trim(),
        code: document.getElementById('dCode').value.trim(),
        unit: document.getElementById('dUnit').value.trim(),
        default_location_id: document.getElementById('dLoc').value,
        require_lot: document.getElementById('dLot').checked,
        min_qty: parseInt(document.getElementById('dMin').value) || 0
      };
      if (imgFileId) payload.image_file_id = imgFileId;
      if (imgCleared) payload.clear_image = true;
      if (!payload.name) { App.invalid('dName', 'กรุณากรอกชื่อยา'); return; }
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('saveDrug', { drug: payload }).catch(() => null);
      btn.disabled = false; btn.textContent = isEdit ? 'บันทึก' : 'เพิ่มยา';
      if (r && r.status === 'success') { Scanner.stopCamera(); App.toast(r.message, 'ok'); this.drugs(view); }
      else if (r && r.message && r.message.indexOf('บาร์โค้ด') !== -1) { App.invalid('dCode', r.message); }
      else App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
    });

    const del = document.getElementById('dDel');
    if (del) del.addEventListener('click', async () => {
      if (!confirm(`ลบ "${drug.name}"?`)) return;
      const r = await api('deleteDrug', { id: drug.id }).catch(() => null);
      if (r && r.status === 'success') { Scanner.stopCamera(); App.toast('ลบแล้ว', 'ok'); this.drugs(view); }
      else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
    });
  },

  /* ==================== Lot บังคับ ==================== */
  async lotRequired(view) {
    view.innerHTML = `${Settings.back()}
      <div class="page-title">รายการที่ต้องบันทึก Lot No.</div>
      <div class="page-sub">เปิดสวิตช์รายการที่ต้องบังคับกรอก Lot ก่อนบันทึก · บันทึกอัตโนมัติ</div>
      <div id="lotList">${App.loader()}</div>`;
    const r = await api('getDrugs').catch(() => null);
    const drugs = ((r && r.data) || []).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const wrap = document.getElementById('lotList');
    if (!drugs.length) { wrap.innerHTML = '<div class="empty-state"><div class="es-title">ยังไม่มีรายการยา</div><div>เพิ่มยาในเมนู รายการยา ก่อน</div></div>'; return; }
    wrap.innerHTML = drugs.map(d => `
      <div class="card-soft d-flex align-items-center justify-content-between" style="padding:14px 16px;margin-bottom:10px">
        <div style="min-width:0"><div style="font-weight:600">${App.esc(d.name)}</div>
          ${d.code ? `<div class="hint" style="margin:2px 0 0"><i class="bi bi-upc"></i> ${App.esc(d.code)}</div>` : ''}</div>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" data-id="${d.id}" ${d.require_lot ? 'checked' : ''} style="transform:scale(1.3)">
        </div>
      </div>`).join('');
    wrap.querySelectorAll('input[type=checkbox]').forEach(cb =>
      cb.addEventListener('change', async () => {
        const r2 = await api('setRequireLot', { id: cb.dataset.id, value: cb.checked }).catch(() => null);
        if (r2 && r2.status === 'success') App.toast(cb.checked ? 'เปิด Lot บังคับ' : 'ปิด Lot บังคับ', 'ok');
        else { cb.checked = !cb.checked; App.toast('อัปเดตไม่สำเร็จ', 'err'); }
      }));
  }
};
