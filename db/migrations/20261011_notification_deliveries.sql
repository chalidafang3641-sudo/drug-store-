CREATE TABLE IF NOT EXISTS notification_deliveries (
  delivery_day DATE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('line', 'telegram')),
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (delivery_day, channel)
);
