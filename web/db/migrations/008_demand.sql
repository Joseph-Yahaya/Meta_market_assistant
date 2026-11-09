-- Unmet-demand aggregates (Feature P). Counts only: area cells and demand
-- keys, never coordinates, visitor identities beyond a 24-hour digest, or
-- raw search text. Additive; existing data is untouched.
CREATE TABLE demand_signals (
  day date NOT NULL,
  demand_kind text NOT NULL CHECK (demand_kind IN ('product','idea')),
  demand_key text NOT NULL CHECK (char_length(demand_key) BETWEEN 1 AND 40),
  cell_id text NOT NULL,
  visitor_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, demand_kind, demand_key, cell_id, visitor_hash)
);
CREATE INDEX demand_signals_window_idx ON demand_signals(cell_id, at);
CREATE TABLE demand_daily (
  day date NOT NULL,
  demand_kind text NOT NULL CHECK (demand_kind IN ('product','idea')),
  demand_key text NOT NULL CHECK (char_length(demand_key) BETWEEN 1 AND 40),
  cell_id text NOT NULL,
  simulated boolean NOT NULL,
  signals integer NOT NULL DEFAULT 0,
  visitors integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, demand_kind, demand_key, cell_id, simulated)
);
CREATE TABLE demand_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_kind text NOT NULL CHECK (demand_kind IN ('product','idea')),
  demand_key text NOT NULL CHECK (char_length(demand_key) BETWEEN 1 AND 40),
  cell_id text NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX demand_photos_group_idx ON demand_photos(demand_kind, demand_key, cell_id, status);
CREATE UNIQUE INDEX demand_photos_single_active ON demand_photos(demand_kind, demand_key, cell_id) WHERE status = 'active';
ALTER TABLE shops ADD COLUMN demand_alerts boolean NOT NULL DEFAULT false;
