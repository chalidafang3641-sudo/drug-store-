CREATE INDEX IF NOT EXISTS drugs_code_trgm_idx
  ON drugs USING GIN (lower(code) gin_trgm_ops)
  WHERE active AND code <> '';

