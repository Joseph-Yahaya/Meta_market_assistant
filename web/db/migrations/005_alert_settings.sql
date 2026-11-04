CREATE TABLE alert_settings (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  low_stock integer NOT NULL DEFAULT 5 CHECK (low_stock BETWEEN 0 AND 100000),
  expiry_days integer NOT NULL DEFAULT 30 CHECK (expiry_days BETWEEN 0 AND 365),
  enabled boolean NOT NULL DEFAULT true
);
