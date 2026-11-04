ALTER TABLE searches ADD COLUMN visitor_hash text;
ALTER TABLE feedback ADD COLUMN search_id uuid REFERENCES searches(id) ON DELETE SET NULL;
CREATE INDEX searches_expiry_idx ON searches(at);
CREATE TABLE buyer_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id),
  product_id uuid NOT NULL REFERENCES products(id),
  kind text NOT NULL CHECK (kind IN ('shop_open','visit_report')),
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (search_id,shop_id,kind)
);
-- No precise buyer coordinates, raw query, email, phone or movement trail is stored.
