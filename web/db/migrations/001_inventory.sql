-- PostgreSQL 16+. Quantities are integer selling units; money is exact NGN kobo.
CREATE TABLE traders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  simulated boolean NOT NULL DEFAULT false
);
CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES traders(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  category text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  landmark text NOT NULL,
  location_verified boolean NOT NULL DEFAULT false,
  simulated boolean NOT NULL DEFAULT false
);
CREATE INDEX shops_owner_idx ON shops(owner_id);
CREATE INDEX shops_location_idx ON shops(latitude, longitude);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, brand text NOT NULL, variant text NOT NULL, size text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('piece', 'pack', 'carton')),
  category text NOT NULL, perishable boolean NOT NULL,
  UNIQUE (name, brand, variant, size, unit)
);
-- Many products can share an alias. Ambiguous aliases must return candidates.
CREATE TABLE product_aliases (
  product_id uuid NOT NULL REFERENCES products(id),
  alias text NOT NULL CHECK (alias = lower(trim(alias)) AND length(alias) > 0),
  PRIMARY KEY (product_id, alias)
);
CREATE INDEX product_alias_lookup_idx ON product_aliases(alias);
CREATE TABLE stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  product_id uuid NOT NULL REFERENCES products(id),
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, shop_id, product_id)
);
CREATE INDEX batches_shop_product_idx ON stock_batches(shop_id, product_id);
CREATE TABLE stock_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  actor_id uuid NOT NULL REFERENCES traders(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, idempotency_key)
);
CREATE TABLE stock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid REFERENCES stock_commands(id) DEFERRABLE INITIALLY DEFERRED,
  shop_id uuid NOT NULL REFERENCES shops(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES traders(id),
  qty_delta integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('opening', 'sale', 'restock', 'recount')),
  corrects_event_id uuid REFERENCES stock_events(id),
  unit_price_kobo bigint CHECK (unit_price_kobo BETWEEN 0 AND 100000000000),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  source text NOT NULL CHECK (source IN ('web', 'seed')),
  event_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((event_type = 'sale' AND qty_delta < 0)
      OR (event_type IN ('opening','restock') AND qty_delta >= 0)
      OR event_type = 'recount'),
  CHECK (corrects_event_id IS NULL OR event_type = 'recount'),
  FOREIGN KEY (batch_id, shop_id, product_id) REFERENCES stock_batches(id, shop_id, product_id)
);
CREATE INDEX stock_events_balance_idx ON stock_events(shop_id, product_id, batch_id);
CREATE INDEX stock_events_time_idx ON stock_events(shop_id, event_at DESC);
CREATE TABLE stock_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES stock_batches(id),
  actor_id uuid NOT NULL REFERENCES traders(id),
  physical_count integer NOT NULL CHECK (physical_count >= 0),
  previous_estimate integer NOT NULL CHECK (previous_estimate >= 0),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmations_batch_time_idx ON stock_confirmations(batch_id, confirmed_at DESC);
CREATE TABLE searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  found_results boolean NOT NULL,
  simulated boolean NOT NULL DEFAULT false,
  at timestamptz NOT NULL DEFAULT now()
  -- No query text, buyer identity or precise buyer location retained by default.
);
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id),
  product_id uuid NOT NULL REFERENCES products(id),
  visitor_hash text NOT NULL,
  found boolean NOT NULL,
  day date NOT NULL DEFAULT current_date,
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, product_id, visitor_hash, day)
);
CREATE INDEX feedback_confidence_idx ON feedback(shop_id, product_id, at DESC);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = 'P0001'; END;
$$;
CREATE TRIGGER stock_events_immutable BEFORE UPDATE OR DELETE ON stock_events
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER commands_immutable BEFORE UPDATE OR DELETE ON stock_commands
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER confirmations_immutable BEFORE UPDATE OR DELETE ON stock_confirmations
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE VIEW batch_stock AS
SELECT b.id AS batch_id, b.shop_id, b.product_id, b.expiry_date,
  coalesce(sum(e.qty_delta), 0)::integer AS estimated_qty,
  (SELECT max(c.confirmed_at) FROM stock_confirmations c WHERE c.batch_id = b.id) AS confirmed_at
FROM stock_batches b LEFT JOIN stock_events e ON e.batch_id = b.id
GROUP BY b.id;

-- One shop row lock serializes stock commands and duplicate retries for that shop.
-- Application credentials must remain server-only; callers cannot choose actor identity.
CREATE FUNCTION record_stock(
  p_actor uuid, p_shop uuid, p_product uuid, p_key text, p_action text,
  p_quantity integer, p_batch uuid DEFAULT NULL, p_expiry date DEFAULT NULL,
  p_price bigint DEFAULT NULL, p_corrects uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_owner uuid; v_request jsonb; v_existing stock_commands%ROWTYPE;
  v_command uuid := gen_random_uuid(); v_batch uuid; v_before integer;
  v_available integer; v_left integer; v_take integer; v_total integer;
  v_result jsonb; v_perishable boolean; v_row record;
BEGIN
  SELECT owner_id INTO v_owner FROM shops WHERE id = p_shop FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'INVALID_KEY'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('opening','sale','restock','recount')
    OR p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 100000
    OR (p_action IN ('sale','restock') AND p_quantity = 0)
    OR (p_price IS NOT NULL AND (p_price < 0 OR p_price > 100000000000))
  THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
  v_request := jsonb_build_object('actor',p_actor,'product',p_product,'action',p_action,
    'quantity',p_quantity,'batch',p_batch,'expiry',p_expiry,'price',p_price,'corrects',p_corrects);
  SELECT * INTO v_existing FROM stock_commands WHERE shop_id = p_shop AND idempotency_key = p_key;
  IF FOUND THEN
    IF v_existing.request <> v_request THEN RAISE EXCEPTION 'KEY_REUSED'; END IF;
    RETURN v_existing.result || '{"replayed":true}'::jsonb;
  END IF;
  SELECT perishable INTO v_perishable FROM products WHERE id = p_product;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN_PRODUCT'; END IF;
  IF p_corrects IS NOT NULL AND (p_action <> 'recount' OR NOT EXISTS(
    SELECT 1 FROM stock_events WHERE id=p_corrects AND shop_id=p_shop AND product_id=p_product AND batch_id=p_batch
  )) THEN RAISE EXCEPTION 'INVALID_CORRECTION'; END IF;
  IF NOT v_perishable AND p_expiry IS NOT NULL THEN RAISE EXCEPTION 'INVALID_EXPIRY'; END IF;
  IF p_action IN ('opening','restock') THEN
    IF p_batch IS NOT NULL OR (p_expiry IS NOT NULL AND p_expiry < current_date) THEN
      RAISE EXCEPTION 'INVALID_BATCH';
    END IF;
    IF p_action = 'opening' AND EXISTS(SELECT 1 FROM stock_events WHERE shop_id = p_shop AND product_id = p_product)
    THEN RAISE EXCEPTION 'OPENING_EXISTS'; END IF;
    INSERT INTO stock_batches(shop_id, product_id, expiry_date) VALUES(p_shop,p_product,p_expiry) RETURNING id INTO v_batch;
    INSERT INTO stock_events(command_id,shop_id,product_id,batch_id,actor_id,qty_delta,event_type,unit_price_kobo,source)
      VALUES(v_command,p_shop,p_product,v_batch,p_actor,p_quantity,p_action,p_price,'web');
    INSERT INTO stock_confirmations(batch_id,actor_id,physical_count,previous_estimate)
      VALUES(v_batch,p_actor,p_quantity,0);
  ELSIF p_action = 'recount' THEN
    IF p_batch IS NULL OR p_expiry IS NOT NULL THEN RAISE EXCEPTION 'BATCH_REQUIRED'; END IF;
    IF p_price IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
    SELECT estimated_qty INTO v_before FROM batch_stock
      WHERE batch_id = p_batch AND shop_id = p_shop AND product_id = p_product;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
    v_batch := p_batch;
    INSERT INTO stock_events(command_id,shop_id,product_id,batch_id,actor_id,qty_delta,event_type,source,corrects_event_id)
      VALUES(v_command,p_shop,p_product,v_batch,p_actor,p_quantity-v_before,'recount','web',p_corrects);
    INSERT INTO stock_confirmations(batch_id,actor_id,physical_count,previous_estimate)
      VALUES(v_batch,p_actor,p_quantity,v_before);
  ELSE
    IF p_batch IS NOT NULL OR p_expiry IS NOT NULL THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
    SELECT coalesce(sum(estimated_qty),0)::integer INTO v_available FROM batch_stock
      WHERE shop_id = p_shop AND product_id = p_product AND (expiry_date IS NULL OR expiry_date >= current_date);
    IF p_quantity > v_available THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK_RECOUNT_REQUIRED'; END IF;
    v_left := p_quantity;
    FOR v_row IN SELECT * FROM batch_stock WHERE shop_id = p_shop AND product_id = p_product
      AND estimated_qty > 0 AND (expiry_date IS NULL OR expiry_date >= current_date)
      ORDER BY expiry_date ASC NULLS LAST, batch_id
    LOOP
      EXIT WHEN v_left = 0;
      v_take := least(v_left,v_row.estimated_qty);
      INSERT INTO stock_events(command_id,shop_id,product_id,batch_id,actor_id,qty_delta,event_type,unit_price_kobo,source)
        VALUES(v_command,p_shop,p_product,v_row.batch_id,p_actor,-v_take,'sale',p_price,'web');
      v_left := v_left - v_take;
    END LOOP;
  END IF;
  SELECT coalesce(sum(estimated_qty),0)::integer INTO v_total FROM batch_stock
    WHERE shop_id = p_shop AND product_id = p_product;
  v_result := jsonb_build_object('commandId',v_command,'shopId',p_shop,'productId',p_product,
    'batchId',v_batch,'estimatedQty',v_total,'replayed',false);
  INSERT INTO stock_commands(id,shop_id,actor_id,idempotency_key,request,result)
    VALUES(v_command,p_shop,p_actor,p_key,v_request,v_result);
  RETURN v_result;
END;
$$;
