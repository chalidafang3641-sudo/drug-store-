CREATE TRIGGER app_config_touch_updated_at AFTER UPDATE ON app_config
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE app_config SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER app_users_touch_updated_at AFTER UPDATE ON app_users
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE app_users SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER drugs_touch_updated_at AFTER UPDATE ON drugs
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE drugs SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER items_touch_updated_at AFTER UPDATE ON items
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE items SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER locations_touch_updated_at AFTER UPDATE ON locations
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE locations SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER profiles_touch_updated_at AFTER UPDATE ON profiles
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE profiles SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;

CREATE TRIGGER roles_touch_updated_at AFTER UPDATE ON roles
WHEN NEW.updated_at = OLD.updated_at AND NEW.updated_at <> strftime('%Y-%m-%d %H:%M:%f','now')
BEGIN
  UPDATE roles SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=NEW.id;
END;
