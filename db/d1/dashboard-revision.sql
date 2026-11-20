CREATE TABLE IF NOT EXISTS dashboard_revision (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL
);
INSERT OR IGNORE INTO dashboard_revision (id, revision) VALUES (1, 1);

CREATE TRIGGER IF NOT EXISTS dashboard_revision_items_insert
AFTER INSERT ON items
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_items_update
AFTER UPDATE ON items
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_items_delete
AFTER DELETE ON items
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_drugs_insert
AFTER INSERT ON drugs
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_drugs_update
AFTER UPDATE ON drugs
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_drugs_delete
AFTER DELETE ON drugs
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_locations_insert
AFTER INSERT ON locations
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_locations_update
AFTER UPDATE ON locations
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS dashboard_revision_locations_delete
AFTER DELETE ON locations
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
