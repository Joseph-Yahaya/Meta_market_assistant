CREATE TABLE trader_credentials (
  trader_id uuid PRIMARY KEY REFERENCES traders(id),
  email text NOT NULL UNIQUE CHECK (email=lower(trim(email)) AND length(email)<=254),
  password_hash text NOT NULL,
  demo_notice_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Short-lived abuse counters contain hashed identifiers, not email addresses or IPs.
CREATE TABLE auth_rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL CHECK(attempts>0),
  expires_at timestamptz NOT NULL
);
