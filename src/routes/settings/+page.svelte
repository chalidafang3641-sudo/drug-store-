<script>
  export let data;
  export let form;

  const tabs = [
    { id: 'general', label: 'ระบบ' },
    { id: 'users', label: 'ผู้ใช้' },
    { id: 'drugs', label: 'ยา' },
    { id: 'locations', label: 'สถานที่' },
    { id: 'export', label: 'ส่งออก' },
    { id: 'history', label: 'ประวัติ' },
    { id: 'audit', label: 'ตรวจนับ' }
  ];

  const typeLabels = {
    receive: 'รับเข้า',
    exchange: 'ย้าย',
    dispose: 'ตัดจ่าย',
    adjust: 'ปรับยอด'
  };
  const historyFilters = [
    { id: '', label: 'ทั้งหมด' },
    { id: 'receive', label: 'รับเข้า' },
    { id: 'exchange', label: 'ย้าย' },
    { id: 'dispose', label: 'ตัดจ่าย' },
    { id: 'adjust', label: 'ปรับยอด' }
  ];

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
</script>

<main class="settings-shell">
  <section class="page-head">
    <div>
      <p class="eyebrow">ตั้งค่า</p>
      <h1>Settings</h1>
    </div>
    <p class="summary">จัดการค่าพื้นฐาน ผู้ใช้ ประวัติ และตรวจนับสต็อกผ่าน backend เดิม</p>
  </section>

  <nav class="tabs" aria-label="เมนูตั้งค่า">
    {#each tabs as tab}
      <a class:selected={data.tab === tab.id} href={`/settings?tab=${tab.id}`}>{tab.label}</a>
    {/each}
  </nav>

  {#if data.message || form?.message}
    <p class:ok={!!data.message || form?.ok} class:error={!!form?.message && !form?.ok}>{data.message || form.message}</p>
  {/if}

  {#if data.tab === 'general'}
    <section class="panel">
      <div class="section-head">
        <h2>ข้อมูลระบบ</h2>
        <span>{data.canAdmin ? 'admin only' : 'read only'}</span>
      </div>
      {#if data.canAdmin && data.config}
        <form method="POST" action="?/saveConfig" class="form-grid">
          <label class="wide">
            <span>ชื่อหน่วยงาน</span>
            <input name="hospital_name" value={data.config.hospital_name || ''} autocomplete="off" />
          </label>
          <label>
            <span>รับเข้าเริ่มต้น</span>
            <select name="default_receive_location_id">
              <option value="">ไม่ระบุ</option>
              {#each data.locations as location}
                <option value={location.id} selected={location.id === data.config.default_receive_location_id}>{location.name}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Critical days</span>
            <input name="critical" type="number" min="1" value={data.config.expiry_thresholds?.critical || 35} />
          </label>
          <label>
            <span>High days</span>
            <input name="high" type="number" min="1" value={data.config.expiry_thresholds?.high || 60} />
          </label>
          <label>
            <span>Medium days</span>
            <input name="medium" type="number" min="1" value={data.config.expiry_thresholds?.medium || 120} />
          </label>
          <label class="check-line">
            <input name="display_be" type="checkbox" checked={data.config.display_be} />
            <span>แสดงปีเป็น พ.ศ.</span>
          </label>
          <button type="submit">บันทึกการตั้งค่า</button>
        </form>
      {:else}
        <p class="empty">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขการตั้งค่าได้</p>
      {/if}
    </section>
  {:else if data.tab === 'users'}
    <section class="panel">
      <div class="section-head">
        <h2>ผู้ใช้</h2>
        <span>{data.users.length} บัญชี</span>
      </div>
      {#if data.canAdmin}
        <form method="POST" action="?/saveUser" class="user-card add-user">
          <h3>เพิ่มผู้ใช้</h3>
          <input name="username" placeholder="username" autocomplete="off" />
          <input name="name" placeholder="ชื่อ-สกุล" autocomplete="off" />
          <select name="role">
            {#each data.roles as role}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
          <input name="password" placeholder="รหัสผ่านอย่างน้อย 4 ตัว" autocomplete="new-password" />
          <label class="check-line"><input name="active" type="checkbox" checked /> <span>เปิดใช้งาน</span></label>
          <button type="submit">เพิ่มผู้ใช้</button>
        </form>

        <div class="user-list">
          {#each data.users as user}
            <article class="user-card">
              <form method="POST" action="?/saveUser">
                <input type="hidden" name="id" value={user.id} />
                <div class="user-title">
                  <strong>{user.name || user.username}</strong>
                  <small>{user.username}</small>
                </div>
                <input name="username" value={user.username} autocomplete="off" />
                <input name="name" value={user.name || ''} autocomplete="off" />
                <select name="role">
                  {#each data.roles as role}
                    <option value={role.id} selected={role.id === user.role}>{role.name}</option>
                  {/each}
                </select>
                <input name="password" placeholder="ตั้งรหัสใหม่ถ้าต้องการ" autocomplete="new-password" />
                <label class="check-line"><input name="active" type="checkbox" checked={user.active} /> <span>เปิดใช้งาน</span></label>
                <button type="submit">บันทึก</button>
              </form>
              <form method="POST" action="?/deleteUser">
                <input type="hidden" name="id" value={user.id} />
                <button class="danger" type="submit">ลบ</button>
              </form>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ได้</p>
      {/if}
    </section>
  {:else if data.tab === 'drugs'}
    <section class="panel">
      <div class="section-head">
        <h2>รายการยา</h2>
        <span>{data.drugs.length} รายการ</span>
      </div>
      {#if data.canDrug}
        <form method="POST" action="?/uploadDrugImage" enctype="multipart/form-data" class="image-upload">
          <input type="hidden" name="drug_id" value="__new__" />
          <div>
            <strong>รูปยาใหม่</strong>
            <small>{uploadedFor('__new__') ? 'อัปโหลดแล้ว รอกดเพิ่มยา' : 'เลือกไฟล์ก่อนเพิ่มยา ถ้าต้องการรูป'}</small>
          </div>
          {#if uploadedFor('__new__')?.url}
            <img src={uploadedFor('__new__').url} alt="" />
          {/if}
          <input name="image" type="file" accept="image/*" />
          <button type="submit">อัปโหลดรูป</button>
        </form>
        <form method="POST" action="?/saveDrug" class="master-form">
          <h3>เพิ่มยา</h3>
          <input type="hidden" name="image_file_id" value={uploadedFor('__new__')?.fileId || ''} />
          <input name="name" placeholder="ชื่อยา" autocomplete="off" />
          <input name="code" placeholder="Barcode / code" autocomplete="off" />
          <input name="unit" placeholder="หน่วย" autocomplete="off" />
          <input name="min_qty" type="number" min="0" placeholder="ขั้นต่ำ" />
          <select name="default_location_id">
            <option value="">สถานที่เริ่มต้น</option>
            {#each data.locations as location}
              <option value={location.id}>{location.name}</option>
            {/each}
          </select>
          <label class="check-line"><input name="require_lot" type="checkbox" checked /> <span>บังคับ Lot</span></label>
          <button type="submit">เพิ่มยา</button>
        </form>

        <div class="master-list">
          {#each data.drugs as drug}
            <article class="master-card">
              <div class="drug-image-row">
                <div class="drug-image">
                  {#if imageUrlFor(drug)}
                    <img src={imageUrlFor(drug)} alt="" />
                  {:else}
                    <span>ไม่มีรูป</span>
                  {/if}
                </div>
                <form method="POST" action="?/uploadDrugImage" enctype="multipart/form-data" class="drug-upload-form">
                  <input type="hidden" name="drug_id" value={drug.id} />
                  <input name="image" type="file" accept="image/*" />
                  <button type="submit">อัปโหลดรูป</button>
                </form>
              </div>
              <form method="POST" action="?/saveDrug">
                <input type="hidden" name="id" value={drug.id} />
                <input type="hidden" name="image_file_id" value={imageFileIdFor(drug)} />
                <div class="master-title">
                  <strong>{drug.name}</strong>
                  <small>{drug.code || 'ไม่มี barcode'} · {drug.unit || 'ไม่ระบุหน่วย'}</small>
                </div>
                <input name="name" value={drug.name} autocomplete="off" />
                <input name="code" value={drug.code || ''} autocomplete="off" />
                <input name="unit" value={drug.unit || ''} autocomplete="off" />
                <input name="min_qty" type="number" min="0" value={drug.min_qty || 0} />
                <select name="default_location_id">
                  <option value="">ไม่ระบุ</option>
                  {#each data.locations as location}
                    <option value={location.id} selected={location.id === drug.default_location_id}>{location.name}</option>
                  {/each}
                </select>
                <label class="check-line"><input name="require_lot" type="checkbox" checked={drug.require_lot} /> <span>Lot</span></label>
                <label class="check-line"><input name="clear_image" type="checkbox" /> <span>ลบรูป</span></label>
                <button type="submit">บันทึก</button>
              </form>
              <form method="POST" action="?/deleteDrug">
                <input type="hidden" name="id" value={drug.id} />
                <button class="danger" type="submit">ลบ</button>
              </form>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์จัดการรายการยา</p>
      {/if}
    </section>
  {:else if data.tab === 'locations'}
    <section class="panel">
      <div class="section-head">
        <h2>สถานที่เก็บยา</h2>
        <span>{data.locations.length} จุด</span>
      </div>
      {#if data.canDrug}
        <form method="POST" action="?/saveLocation" class="master-form location-form">
          <h3>เพิ่มสถานที่</h3>
          <input name="name" placeholder="ชื่อสถานที่" autocomplete="off" />
          <input name="icon" placeholder="icon key" value="box" autocomplete="off" />
          <input name="color" type="color" value="#16A34A" aria-label="สีสถานที่" />
          <button type="submit">เพิ่มสถานที่</button>
        </form>

        <div class="master-list">
          {#each data.locations as location}
            <article class="master-card">
              <form method="POST" action="?/saveLocation">
                <input type="hidden" name="id" value={location.id} />
                <div class="master-title">
                  <strong>{location.name}</strong>
                  <small>{location.is_default_receive ? 'จุดรับเข้าเริ่มต้น' : 'สถานที่ active'}</small>
                </div>
                <input name="name" value={location.name} autocomplete="off" />
                <input name="icon" value={location.icon || 'box'} autocomplete="off" />
                <input name="color" type="color" value={location.color || '#16A34A'} aria-label="สีสถานที่" />
                <button type="submit">บันทึก</button>
              </form>
              <div class="inline-actions">
                <form method="POST" action="?/setDefaultReceive">
                  <input type="hidden" name="id" value={location.id} />
                  <button type="submit" disabled={location.is_default_receive}>ตั้งรับเข้า</button>
                </form>
                <form method="POST" action="?/deleteLocation">
                  <input type="hidden" name="id" value={location.id} />
                  <button class="danger" type="submit">ลบ</button>
                </form>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์จัดการสถานที่</p>
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
          <select name="kind">
            <option value="receive" selected={form?.exportResult?.kind === 'receive'}>รับเข้า</option>
            <option value="all" selected={!form?.exportResult || form?.exportResult?.kind === 'all'}>การเคลื่อนไหวทั้งหมด</option>
            <option value="stock" selected={form?.exportResult?.kind === 'stock'}>สต็อกคงเหลือปัจจุบัน</option>
          </select>
        </label>
        <label>
          <span>ตั้งแต่วันที่</span>
          <input name="from" type="date" value={form?.exportResult?.from || today()} />
        </label>
        <label>
          <span>ถึงวันที่</span>
          <input name="to" type="date" value={form?.exportResult?.to || today()} />
        </label>
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
        <h2>ประวัติล่าสุด</h2>
        <span>{data.history.length} รายการ</span>
      </div>
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
            <article>
              <div>
                <strong>{item.drug_name || '-'}</strong>
                <span>{typeLabels[item.type] || item.type} · {item.from_location_name || '-'} → {item.to_location_name || '-'}</span>
              </div>
              <em>{item.qty}</em>
              <small>{formatDate(item.created_at)}</small>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">ยังไม่มีประวัติ</p>
      {/if}
    </section>
  {:else if data.tab === 'audit'}
    <section class="panel">
      <div class="section-head">
        <h2>ตรวจนับสต็อก</h2>
        <span>{data.selectedItems.length} รายการ</span>
      </div>
      {#if data.canStock}
        <form method="GET" action="/settings" class="location-picker">
          <input type="hidden" name="tab" value="audit" />
          <select name="location_id">
            <option value="">เลือกสถานที่</option>
            {#each data.locations as location}
              <option value={location.id} selected={data.selectedLocation?.id === location.id}>{location.name}</option>
            {/each}
          </select>
          <button type="submit">โหลดรายการ</button>
        </form>

        {#if data.selectedLocation}
          <div class="audit-list">
            {#each data.selectedItems as item}
              <article>
                <div>
                  <strong>{item.drug_name}</strong>
                  <span>{item.lot_no ? `Lot ${item.lot_no} · ` : ''}ระบบมี {item.qty} · หมดอายุ {item.expiry_date}</span>
                </div>
                <form method="POST" action="?/adjust">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="selected_location_id" value={data.selectedLocation.id} />
                  <input name="actual_qty" type="number" min="0" placeholder="นับจริง" />
                  <button type="submit">บันทึก</button>
                </form>
              </article>
            {/each}
          </div>
          {#if !data.selectedItems.length}
            <p class="empty">ไม่มียา active ในจุดนี้</p>
          {/if}
        {:else}
          <p class="empty">เลือกสถานที่เพื่อเริ่มตรวจนับ</p>
        {/if}
      {:else}
        <p class="empty">บัญชีนี้ไม่มีสิทธิ์ตรวจนับสต็อก</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .settings-shell {
    width: min(1120px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 86px;
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

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  .summary {
    max-width: 470px;
    color: #666174;
    line-height: 1.5;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
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

  .panel,
  .user-card,
  .master-card,
  .history-list article,
  .audit-list article {
    border: 1px solid #dedbe8;
    border-radius: 8px;
    background: #fff;
  }

  .panel {
    padding: 18px;
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
  .export-form {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .master-form {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid #eeeaf5;
    border-radius: 8px;
    background: #fbfafc;
  }

  .master-form h3 {
    align-self: center;
  }

  .location-form {
    grid-template-columns: 1fr 160px 90px auto;
  }

  .image-upload,
  .drug-image-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto minmax(200px, 260px) auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
    padding: 12px 14px;
    border: 1px solid #eeeaf5;
    border-radius: 8px;
    background: #fbfafc;
  }

  .image-upload div,
  .drug-image-row div:first-child {
    display: grid;
    gap: 3px;
  }

  .image-upload small {
    color: #666174;
  }

  .image-upload img,
  .drug-image img {
    width: 52px;
    height: 52px;
    object-fit: cover;
    border-radius: 8px;
    background: #f0eef7;
  }

  .drug-image {
    display: grid;
    place-items: center;
    width: 64px;
    min-height: 52px;
  }

  .drug-image span {
    color: #666174;
    font-size: 0.78rem;
    font-weight: 800;
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
  .master-list,
  .history-list,
  .audit-list {
    display: grid;
    gap: 10px;
  }

  .user-card {
    padding: 14px;
  }

  .master-card {
    padding: 14px;
  }

  .user-card form:first-child,
  .master-card form:first-child {
    display: grid;
    grid-template-columns: 1.2fr repeat(4, minmax(0, 1fr)) auto;
    gap: 10px;
    align-items: end;
  }

  .master-card form:first-child {
    grid-template-columns: 1.2fr 1.2fr 1fr 0.7fr 0.7fr 1fr auto auto;
  }

  .master-card form + form,
  .user-card form + form {
    margin-top: 8px;
  }

  .master-title,
  .user-title {
    display: grid;
    gap: 3px;
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

  .history-list article,
  .audit-list article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
  }

  .history-list span,
  .audit-list span {
    display: block;
    margin-top: 3px;
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
    .export-form,
    .location-form,
    .image-upload,
    .drug-image-row,
    .user-card form:first-child,
    .master-card form:first-child,
    .history-list article,
    .audit-list article,
    .location-picker {
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
