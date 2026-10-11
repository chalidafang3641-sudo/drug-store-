BEGIN;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS line_enabled BOOLEAN;
UPDATE app_config SET
  telegram_enabled = COALESCE(telegram_enabled, notification_channel = 'telegram'),
  line_enabled = COALESCE(line_enabled, notification_channel = 'line');
COMMIT;
