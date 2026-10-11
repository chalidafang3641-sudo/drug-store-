ALTER TABLE app_config ADD COLUMN IF NOT EXISTS notification_scheduler_last_tick TIMESTAMPTZ;
