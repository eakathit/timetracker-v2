CREATE TABLE qr_nonces (
  nonce       TEXT        PRIMARY KEY,
  location_id TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at     TIMESTAMPTZ,
  used_by     UUID        REFERENCES auth.users(id)
);

-- index สำหรับ cleanup query
CREATE INDEX idx_qr_nonces_created ON qr_nonces(created_at);

-- anon ไม่มีสิทธิ์อ่าน/เขียน (เฉพาะ service_role เท่านั้น)
ALTER TABLE qr_nonces ENABLE ROW LEVEL SECURITY;