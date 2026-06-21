<script>
  import { enhance } from '$app/forms';

  export let form;
  export let data;

  let submitting = false;

  function enhanceLogin() {
    submitting = true;

    return async ({ update }) => {
      await update();
      submitting = false;
    };
  }
</script>

<main id="login">
  <div class="brandmark" aria-hidden="true">
    {#if data.branding?.logo_url}
      <img src={data.branding.logo_url} alt="" />
    {:else}
      <i class="bi bi-capsule-pill"></i>
    {/if}
  </div>

  <h1>{data.branding?.hospital_name || 'The Watcher'}</h1>
  <p class="login-sub">ระบบแจ้งเตือนวันหมดอายุของยา</p>

  <form method="POST" class="login-card card-soft" use:enhance={enhanceLogin}>
    <div class="field">
      <label for="liUser">ชื่อผู้ใช้</label>
      <input
        id="liUser"
        name="username"
        type="text"
        autocomplete="username"
        placeholder="ชื่อผู้ใช้"
        value={form?.username || ''}
        required
      />
    </div>

    <div class="field login-password-field">
      <label for="liPass">รหัสผ่าน</label>
      <input
        id="liPass"
        name="password"
        type="password"
        autocomplete="current-password"
        placeholder="รหัสผ่าน"
        required
      />
    </div>

    <div class="err" aria-live="polite">{form?.message || ''}</div>

    <button id="liBtn" class="btn-brand" type="submit" disabled={submitting}>
      {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
    </button>
  </form>
</main>

<style>
  .login-password-field {
    margin-bottom: 8px;
  }

  .btn-brand:disabled {
    cursor: wait;
    opacity: 0.8;
  }

  @media (max-width: 480px) {
    #login .login-card {
      padding: 24px 18px 20px;
      border-radius: 24px;
    }
  }
</style>
