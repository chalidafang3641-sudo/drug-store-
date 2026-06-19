CREATE TABLE IF NOT EXISTS roles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('role'),
  key TEXT NOT NULL UNIQUE CHECK (length(trim(key)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (key, name, permissions)
VALUES
  ('admin', 'ผู้ดูแลระบบ', ARRAY['*']),
  ('pharmacist', 'เภสัชกร', ARRAY['stock', 'drug', 'exchange', 'receive', 'view']),
  ('staff', 'เจ้าหน้าที่', ARRAY['receive', 'view'])
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    permissions = EXCLUDED.permissions,
    active = TRUE;

CREATE TABLE IF NOT EXISTS profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('prof'),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (auth_user_id IS NOT NULL OR username <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON profiles (lower(username))
  WHERE username <> '';

CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx ON profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS profiles_role_active_idx ON profiles (role_id, active);

ALTER TABLE items ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS closed_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_transaction_id BIGINT;

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_last_transaction_id_fkey,
  ADD CONSTRAINT items_last_transaction_id_fkey
  FOREIGN KEY (last_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS items_closed_at_idx
  ON items (closed_at DESC)
  WHERE closed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS items_last_transaction_idx
  ON items (last_transaction_id)
  WHERE last_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS legacy_id_map (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('legacy'),
  source_system TEXT NOT NULL DEFAULT 'google_apps_script',
  source_table TEXT NOT NULL CHECK (length(trim(source_table)) > 0),
  legacy_id TEXT NOT NULL CHECK (length(trim(legacy_id)) > 0),
  target_table TEXT NOT NULL CHECK (length(trim(target_table)) > 0),
  target_id BIGINT,
  target_code_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_table, legacy_id, target_table)
);

CREATE INDEX IF NOT EXISTS legacy_id_map_target_idx
  ON legacy_id_map (target_table, target_id)
  WHERE target_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS legacy_id_map_payload_gin_idx
  ON legacy_id_map USING GIN (payload);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('audit'),
  actor_profile_id BIGINT REFERENCES profiles(id) ON DELETE SET NULL,
  actor_username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  table_name TEXT NOT NULL CHECK (length(trim(table_name)) > 0),
  record_id BIGINT,
  record_code_id TEXT NOT NULL DEFAULT '',
  old_data JSONB NOT NULL DEFAULT '{}',
  new_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON audit_logs (table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_profile_idx ON audit_logs (actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_old_data_gin_idx ON audit_logs USING GIN (old_data);
CREATE INDEX IF NOT EXISTS audit_logs_new_data_gin_idx ON audit_logs USING GIN (new_data);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS roles_touch_updated_at ON roles;
CREATE TRIGGER roles_touch_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON profiles;
CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
