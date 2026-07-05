CREATE INDEX IF NOT EXISTS items_active_location_qty_idx
  ON items (location_id)
  INCLUDE (qty)
  WHERE status = 'active' AND qty > 0;

CREATE INDEX IF NOT EXISTS app_users_login_cover_idx
  ON app_users (username)
  INCLUDE (password_hash, active, role, name, permissions, code_id);

CREATE INDEX IF NOT EXISTS sessions_code_expires_user_idx
  ON sessions (code_id, expires_at)
  INCLUDE (user_id);
