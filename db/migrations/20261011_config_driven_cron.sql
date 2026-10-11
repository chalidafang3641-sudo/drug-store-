BEGIN;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS notification_schedule_deployment_id TEXT;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS scheduled_time TEXT NOT NULL DEFAULT 'legacy';
UPDATE notification_deliveries SET scheduled_time = (SELECT notify_time FROM app_config WHERE id = TRUE) WHERE scheduled_time = 'legacy';
ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_pkey;
ALTER TABLE notification_deliveries ADD PRIMARY KEY (delivery_day, channel, scheduled_time);
COMMIT;
