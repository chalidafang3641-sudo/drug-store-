CREATE TABLE stock_commands (
  command_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('receive','exchange')),
  item_code TEXT, drug_code TEXT, location_code TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK(typeof(qty)='integer' AND qty>0),
  lot TEXT NOT NULL DEFAULT '', expiry TEXT, actor TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
);
CREATE TRIGGER stock_receive AFTER INSERT ON stock_commands WHEN NEW.kind='receive' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM drugs WHERE code_id=NEW.drug_code AND active AND (NOT require_lot OR NEW.lot<>'')) THEN RAISE(ABORT,'invalid drug or lot') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM locations WHERE code_id=NEW.location_code AND active) THEN RAISE(ABORT,'inactive location') END;
  INSERT INTO items(drug_id,location_id,qty,lot_no,expiry_date,received_by,note)
    VALUES((SELECT id FROM drugs WHERE code_id=NEW.drug_code),(SELECT id FROM locations WHERE code_id=NEW.location_code),NEW.qty,NEW.lot,NEW.expiry,NEW.actor,NEW.note)
    ON CONFLICT(drug_id,location_id,lot_no,expiry_date) WHERE status='active' DO UPDATE SET qty=qty+excluded.qty,updated_at=CURRENT_TIMESTAMP;
  INSERT INTO transactions(type,item_id,drug_id,to_location_id,qty,lot_no,expiry_date,by_username)
    SELECT 'receive',i.id,i.drug_id,i.location_id,NEW.qty,i.lot_no,i.expiry_date,NEW.actor FROM items i JOIN drugs d ON d.id=i.drug_id JOIN locations l ON l.id=i.location_id WHERE i.status='active' AND d.code_id=NEW.drug_code AND l.code_id=NEW.location_code AND i.lot_no=NEW.lot AND i.expiry_date=NEW.expiry;
  DELETE FROM stock_commands WHERE command_id=NEW.command_id;
END;
CREATE TRIGGER stock_exchange AFTER INSERT ON stock_commands WHEN NEW.kind='exchange' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM items i JOIN locations l ON l.code_id=NEW.location_code AND l.active WHERE i.code_id=NEW.item_code AND i.status='active' AND i.qty>=NEW.qty AND i.location_id<>l.id) THEN RAISE(ABORT,'invalid transfer') END;
  INSERT INTO items(drug_id,location_id,qty,lot_no,expiry_date,received_by,note)
    SELECT i.drug_id,l.id,NEW.qty,i.lot_no,i.expiry_date,NEW.actor,'รับโอนจาก '||src.name FROM items i JOIN locations src ON src.id=i.location_id JOIN locations l ON l.code_id=NEW.location_code WHERE i.code_id=NEW.item_code
    ON CONFLICT(drug_id,location_id,lot_no,expiry_date) WHERE status='active' DO UPDATE SET qty=qty+excluded.qty,updated_at=CURRENT_TIMESTAMP;
  INSERT INTO transactions(type,item_id,drug_id,from_location_id,to_location_id,qty,lot_no,expiry_date,by_username)
    SELECT 'exchange',dst.id,i.drug_id,i.location_id,dst.location_id,NEW.qty,i.lot_no,i.expiry_date,NEW.actor FROM items i JOIN locations l ON l.code_id=NEW.location_code JOIN items dst ON dst.location_id=l.id AND dst.drug_id=i.drug_id AND dst.lot_no=i.lot_no AND dst.expiry_date=i.expiry_date AND dst.status='active' WHERE i.code_id=NEW.item_code;
  UPDATE items SET last_transaction_id=last_insert_rowid(),updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT item_id FROM transactions WHERE id=last_insert_rowid());
  UPDATE items SET qty=qty-NEW.qty,status=CASE WHEN qty=NEW.qty THEN 'exchanged' ELSE 'active' END,closed_at=CASE WHEN qty=NEW.qty THEN CURRENT_TIMESTAMP END,closed_reason=CASE WHEN qty=NEW.qty THEN 'ย้ายออกหมด' ELSE '' END,last_transaction_id=last_insert_rowid(),updated_at=CURRENT_TIMESTAMP WHERE code_id=NEW.item_code;
  DELETE FROM stock_commands WHERE command_id=NEW.command_id;
END;
CREATE TABLE stock_reductions (
 command_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('adjust','dispose')),
 item_code TEXT NOT NULL, qty INTEGER NOT NULL CHECK(typeof(qty)='integer' AND qty>=0),
 reason TEXT NOT NULL,note TEXT NOT NULL,actor TEXT NOT NULL
);
CREATE TRIGGER apply_stock_reduction AFTER INSERT ON stock_reductions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM items WHERE code_id=NEW.item_code AND status='active' AND (NEW.kind='adjust' OR NEW.qty BETWEEN 1 AND qty)) THEN RAISE(ABORT,'invalid quantity or stock') END;
 INSERT INTO transactions(type,item_id,drug_id,from_location_id,qty,lot_no,expiry_date,reason,note,by_username)
   SELECT NEW.kind,id,drug_id,location_id,NEW.qty,lot_no,expiry_date,NEW.reason,
   CASE WHEN NEW.kind='adjust' THEN 'ปรับจาก '||qty||' เป็น '||NEW.qty||CASE WHEN NEW.note='' THEN '' ELSE ' · '||NEW.note END ELSE NEW.note END,NEW.actor
   FROM items WHERE code_id=NEW.item_code AND (NEW.kind='dispose' OR qty<>NEW.qty);
 UPDATE items SET qty=CASE NEW.kind WHEN 'adjust' THEN NEW.qty ELSE qty-NEW.qty END,
   status=CASE WHEN (NEW.kind='adjust' AND NEW.qty=0) OR (NEW.kind='dispose' AND NEW.qty=qty) THEN CASE NEW.reason WHEN 'เบิกใช้' THEN 'used' ELSE 'disposed' END ELSE 'active' END,
   closed_at=CASE WHEN (NEW.kind='adjust' AND NEW.qty=0) OR (NEW.kind='dispose' AND NEW.qty=qty) THEN CURRENT_TIMESTAMP END,
   closed_reason=CASE WHEN (NEW.kind='adjust' AND NEW.qty=0) OR (NEW.kind='dispose' AND NEW.qty=qty) THEN NEW.reason ELSE '' END,
   last_transaction_id=last_insert_rowid(),updated_at=CURRENT_TIMESTAMP
   WHERE code_id=NEW.item_code AND (NEW.kind='dispose' OR qty<>NEW.qty);
 DELETE FROM stock_reductions WHERE command_id=NEW.command_id;
END;
CREATE TABLE default_location_command(code TEXT PRIMARY KEY);
CREATE TRIGGER apply_default_location AFTER INSERT ON default_location_command BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM locations WHERE code_id=NEW.code AND active) THEN RAISE(ABORT,'invalid location') END;
 UPDATE locations SET is_default_receive=0 WHERE active AND is_default_receive;
 UPDATE locations SET is_default_receive=1 WHERE code_id=NEW.code;
 UPDATE app_config SET default_receive_location_id=(SELECT id FROM locations WHERE code_id=NEW.code) WHERE id=1;
 DELETE FROM default_location_command WHERE code=NEW.code;
END;
