CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION make_code_id(prefix TEXT)
RETURNS TEXT AS $$
  SELECT prefix || '_' || replace(gen_random_uuid()::text, '-', '');
$$ LANGUAGE sql VOLATILE;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS app_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  hospital_name TEXT NOT NULL DEFAULT 'โรงพยาบาลร้องกวาง',
  logo_file_id TEXT NOT NULL DEFAULT '',
  folder_id TEXT NOT NULL DEFAULT '',
  expiry_critical_days INTEGER NOT NULL DEFAULT 35 CHECK (expiry_critical_days > 0),
  expiry_high_days INTEGER NOT NULL DEFAULT 60 CHECK (expiry_high_days > expiry_critical_days),
  expiry_medium_days INTEGER NOT NULL DEFAULT 120 CHECK (expiry_medium_days > expiry_high_days),
  default_receive_location_id BIGINT,
  notification_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notification_channel TEXT NOT NULL DEFAULT 'telegram' CHECK (notification_channel IN ('telegram', 'line')),
  telegram_bot_token TEXT NOT NULL DEFAULT '',
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  line_token TEXT NOT NULL DEFAULT '',
  notify_time TEXT NOT NULL DEFAULT '08:00',
  display_be BOOLEAN NOT NULL DEFAULT FALSE,
  app_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('loc'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  icon TEXT NOT NULL DEFAULT 'box',
  color TEXT NOT NULL DEFAULT '#16A34A',
  is_default_receive BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locations_active_sort_idx
  ON locations (sort_order, created_at)
  WHERE active;

CREATE INDEX IF NOT EXISTS locations_name_trgm_idx
  ON locations USING GIN (lower(name) gin_trgm_ops)
  WHERE active;

WITH ranked_defaults AS (
  SELECT id, row_number() OVER (ORDER BY sort_order, created_at, id) AS rn
  FROM locations
  WHERE active AND is_default_receive
)
UPDATE locations
SET is_default_receive = FALSE
WHERE id IN (SELECT id FROM ranked_defaults WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS locations_one_default_receive_idx
  ON locations (is_default_receive)
  WHERE active AND is_default_receive;

ALTER TABLE app_config
  DROP CONSTRAINT IF EXISTS app_config_default_receive_location_id_fkey,
  ADD CONSTRAINT app_config_default_receive_location_id_fkey
  FOREIGN KEY (default_receive_location_id) REFERENCES locations(id) ON DELETE SET NULL;

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

CREATE TABLE IF NOT EXISTS drugs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('drug'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  code TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  require_lot BOOLEAN NOT NULL DEFAULT FALSE,
  default_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  image_file_id TEXT NOT NULL DEFAULT '',
  min_qty INTEGER NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS drugs_code_active_unique
  ON drugs (code)
  WHERE active AND code <> '';

CREATE INDEX IF NOT EXISTS drugs_active_name_idx
  ON drugs (name)
  WHERE active;

CREATE INDEX IF NOT EXISTS drugs_name_trgm_idx
  ON drugs USING GIN (lower(name) gin_trgm_ops)
  WHERE active;

CREATE INDEX IF NOT EXISTS drugs_default_location_idx
  ON drugs (default_location_id)
  WHERE default_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS drugs_low_stock_idx
  ON drugs (min_qty, id)
  WHERE active AND min_qty > 0;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('item'),
  drug_id BIGINT NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  lot_no TEXT NOT NULL DEFAULT '',
  expiry_date DATE NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exchanged', 'used', 'disposed')),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT NOT NULL DEFAULT '',
  last_transaction_id BIGINT,
  received_by TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS items_active_lot_unique
  ON items (drug_id, location_id, lot_no, expiry_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS items_location_active_idx ON items (location_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS items_drug_active_idx ON items (drug_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS items_expiry_active_idx ON items (expiry_date) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS items_active_expiry_qty_idx
  ON items (expiry_date, id)
  INCLUDE (drug_id, location_id, lot_no, qty, received_by, received_at)
  WHERE status = 'active' AND qty > 0;

CREATE INDEX IF NOT EXISTS items_active_location_expiry_idx
  ON items (location_id, expiry_date, id)
  INCLUDE (drug_id, lot_no, qty)
  WHERE status = 'active' AND qty > 0;

CREATE INDEX IF NOT EXISTS items_active_drug_qty_idx
  ON items (drug_id)
  INCLUDE (qty)
  WHERE status = 'active' AND qty > 0;

CREATE INDEX IF NOT EXISTS items_lot_trgm_idx
  ON items USING GIN (lower(lot_no) gin_trgm_ops)
  WHERE status = 'active' AND qty > 0 AND lot_no <> '';

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('tx'),
  type TEXT NOT NULL CHECK (type IN ('receive', 'exchange', 'dispose', 'adjust')),
  item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  drug_id BIGINT REFERENCES drugs(id) ON DELETE SET NULL,
  from_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL CHECK (qty >= 0),
  lot_no TEXT NOT NULL DEFAULT '',
  expiry_date DATE,
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  by_username TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_type_created_at_idx ON transactions (type, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_item_idx ON transactions (item_id);
CREATE INDEX IF NOT EXISTS transactions_drug_idx ON transactions (drug_id);
CREATE INDEX IF NOT EXISTS transactions_from_location_idx ON transactions (from_location_id);
CREATE INDEX IF NOT EXISTS transactions_to_location_idx ON transactions (to_location_id);
CREATE INDEX IF NOT EXISTS transactions_export_idx
  ON transactions (type, created_at, id)
  INCLUDE (drug_id, from_location_id, to_location_id, qty, lot_no, expiry_date, reason, by_username);

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

CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('usr'),
  username TEXT NOT NULL UNIQUE CHECK (length(trim(username)) > 0),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pharmacist', 'staff')),
  name TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_unique
  ON app_users (lower(username));

CREATE INDEX IF NOT EXISTS app_users_active_role_idx
  ON app_users (active, role);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('sess'),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS errors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id TEXT NOT NULL UNIQUE DEFAULT make_code_id('err'),
  where_name TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS errors_created_at_idx ON errors (created_at DESC);

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

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_config_touch_updated_at ON app_config;
CREATE TRIGGER app_config_touch_updated_at
BEFORE UPDATE ON app_config
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS locations_touch_updated_at ON locations;
CREATE TRIGGER locations_touch_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS roles_touch_updated_at ON roles;
CREATE TRIGGER roles_touch_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON profiles;
CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS drugs_touch_updated_at ON drugs;
CREATE TRIGGER drugs_touch_updated_at
BEFORE UPDATE ON drugs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS items_touch_updated_at ON items;
CREATE TRIGGER items_touch_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS app_users_touch_updated_at ON app_users;
CREATE TRIGGER app_users_touch_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO app_config (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (key, name, permissions)
VALUES
  ('admin', 'ผู้ดูแลระบบ', ARRAY['*']),
  ('pharmacist', 'เภสัชกร', ARRAY['stock', 'drug', 'exchange', 'receive', 'view']),
  ('staff', 'เจ้าหน้าที่', ARRAY['receive', 'view'])
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    permissions = EXCLUDED.permissions,
    active = TRUE;

WITH seed(name, icon, color, sort_order, is_default_receive) AS (
  VALUES
    ('Substock', 'box', '#16A34A', 1, TRUE),
    ('Active Stock', 'bolt', '#16A34A', 2, FALSE),
    ('Main Stock', 'archive', '#16A34A', 3, FALSE),
    ('PCU Stock', 'building', '#2563EB', 4, FALSE),
    ('รถยาเวรดึก IPD', 'cart', '#F97316', 5, FALSE),
    ('รถยาเวรดึก ER', 'cart', '#F97316', 6, FALSE),
    ('Ward Stock', 'bed', '#2563EB', 7, FALSE),
    ('ER Stock', 'asterisk', '#06B6D4', 8, FALSE),
    ('LR Stock', 'people', '#2563EB', 9, FALSE)
)
INSERT INTO locations (name, icon, color, sort_order, is_default_receive)
SELECT seed.name, seed.icon, seed.color, seed.sort_order, seed.is_default_receive
FROM seed
WHERE NOT EXISTS (SELECT 1 FROM locations);

UPDATE app_config
SET default_receive_location_id = (
  SELECT id FROM locations WHERE is_default_receive AND active ORDER BY sort_order LIMIT 1
)
WHERE default_receive_location_id IS NULL;

INSERT INTO app_users (username, password_hash, role, name, permissions)
VALUES ('admin', crypt('admin1234', gen_salt('bf')), 'admin', 'ผู้ดูแลระบบ', ARRAY['*'])
ON CONFLICT (username) DO NOTHING;
