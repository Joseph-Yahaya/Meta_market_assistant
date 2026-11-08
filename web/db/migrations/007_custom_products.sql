-- Trader-added products (Feature N) and the bottle unit.
-- Existing catalog rows keep shop_id NULL and status 'approved'; demo data is untouched.
ALTER TABLE products ADD COLUMN shop_id uuid REFERENCES shops(id);
ALTER TABLE products ADD COLUMN status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE products ADD COLUMN photo_path text;
ALTER TABLE products ADD COLUMN flag_reason text;
ALTER TABLE products ADD COLUMN created_by uuid REFERENCES traders(id);
ALTER TABLE products ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE products DROP CONSTRAINT products_unit_check;
ALTER TABLE products ADD CONSTRAINT products_unit_check CHECK (unit IN ('piece','pack','carton','bottle'));
CREATE INDEX products_custom_idx ON products(shop_id,status);
