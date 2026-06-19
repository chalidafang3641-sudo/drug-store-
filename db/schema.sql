CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  hospital_name TEXT NOT NULL DEFAULT 'โรงพยาบาลร้องกวาง',
  logo_file_id TEXT NOT NULL DEFAULT '',
  folder_id TEXT NOT NULL DEFAULT '',
  expiry_critical_days INTEGER NOT NULL DEFAULT 35 CHECK (expiry_critical_days > 0),
  expiry_high_days INTEGER NOT NULL DEFAULT 60 CHECK (expiry_high_days > expiry_critical_days),
  expiry_medium_days INTEGER NOT NULL DEFAULT 120 CHECK (expiry_medium_days > expiry_high_days),
  default_receive_location_id UUID,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  icon TEXT NOT NULL DEFAULT 'box',
  color TEXT NOT NULL DEFAULT '#16A34A',
  is_default_receive BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_config
  DROP CONSTRAINT IF EXISTS app_config_default_receive_location_id_fkey,
  ADD CONSTRAINT app_config_default_receive_location_id_fkey
  FOREIGN KEY (default_receive_location_id) REFERENCES locations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  code TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  require_lot BOOLEAN NOT NULL DEFAULT FALSE,
  default_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  image_file_id TEXT NOT NULL DEFAULT '',
  min_qty INTEGER NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS drugs_code_active_unique
  ON drugs (code)
  WHERE active AND code <> '';

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  lot_no TEXT NOT NULL DEFAULT '',
  expiry_date DATE NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exchanged', 'used', 'disposed')),
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

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('receive', 'exchange', 'dispose', 'adjust')),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  where_name TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
