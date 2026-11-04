-- Anonymous daily totals only. No historical backfill.
CREATE TABLE insight_capture (name text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO insight_capture(name) VALUES ('shop_open');
CREATE TABLE shop_reach_daily (
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day date NOT NULL,
  opens integer NOT NULL DEFAULT 0 CHECK (opens >= 0),
  PRIMARY KEY(shop_id,day)
);
CREATE FUNCTION aggregate_shop_open() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'shop_open' THEN
    INSERT INTO shop_reach_daily(shop_id,day,opens)
    VALUES(NEW.shop_id,(NEW.at AT TIME ZONE 'Africa/Lagos')::date,1)
    ON CONFLICT(shop_id,day) DO UPDATE SET opens=shop_reach_daily.opens+1;
  END IF;
  RETURN NEW;
END;
$$;
-- Existing unique(search_id,shop_id,kind) makes retries no-ops before this fires.
CREATE TRIGGER count_shop_open AFTER INSERT ON buyer_interactions
FOR EACH ROW EXECUTE FUNCTION aggregate_shop_open();
