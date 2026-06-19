<script>
  export let form;
  export let data;
</script>

<main class="login-shell">
  <section class="login-panel">
    {#if data.branding?.logo_url}
      <img class="logo" src={data.branding.logo_url} alt="" />
    {/if}
    <h1>{data.branding?.hospital_name || 'The Watcher'}</h1>
    <form method="POST">
      <label>
        <span>ชื่อผู้ใช้</span>
        <input name="username" autocomplete="username" value={form?.username || ''} required />
      </label>
      <label>
        <span>รหัสผ่าน</span>
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      {#if form?.message}
        <p class="error">{form.message}</p>
      {/if}
      <button type="submit">เข้าสู่ระบบ</button>
    </form>
  </section>
</main>

<style>
  .login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .login-panel {
    width: min(380px, 100%);
  }

  .logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #dedbe8;
  }

  h1 {
    margin: 14px 0 22px;
    font-size: 1.6rem;
  }

  form,
  label {
    display: grid;
    gap: 10px;
  }

  form {
    gap: 14px;
  }

  input {
    height: 44px;
    padding: 0 12px;
    border: 1px solid #cfcadb;
    border-radius: 8px;
    font: inherit;
  }

  button {
    height: 46px;
    border: 0;
    border-radius: 8px;
    background: #5b3fc2;
    color: #fff;
    font: inherit;
    font-weight: 800;
  }

  .error {
    margin: 0;
    color: #b42318;
    font-weight: 700;
  }
</style>
