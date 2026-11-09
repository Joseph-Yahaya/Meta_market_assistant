// Unmet-demand SQL reused by the demand routes and the database tests.
// Groups below the threshold are filtered in SQL so no API can return them.
export const DEMAND_SIGNAL_SQL = `
INSERT INTO demand_signals(day,demand_kind,demand_key,cell_id,visitor_hash,at)
VALUES (current_date,$1,$2,$3,$4,now()) ON CONFLICT DO NOTHING RETURNING visitor_hash`;

export const DEMAND_DAILY_SQL = `
INSERT INTO demand_daily(day,demand_kind,demand_key,cell_id,simulated,signals,visitors)
VALUES (current_date,$1,$2,$3,false,1,$4)
ON CONFLICT (day,demand_kind,demand_key,cell_id,simulated)
DO UPDATE SET signals=demand_daily.signals+1, visitors=demand_daily.visitors+EXCLUDED.visitors`;

export const DEMAND_GROUP_SQL = `
SELECT s.demand_kind AS kind, s.demand_key AS demand_key, s.cell_id AS cell,
  count(DISTINCT s.visitor_hash)::int AS visitors
FROM demand_signals s
WHERE s.cell_id = ANY($1) AND s.at > now() - interval '24 hours'
GROUP BY s.demand_kind, s.demand_key, s.cell_id
HAVING count(DISTINCT s.visitor_hash) >= $2`;

export const DEMAND_SIMULATED_SQL = `
SELECT d.demand_kind AS kind, d.demand_key AS demand_key, d.cell_id AS cell, d.visitors
FROM demand_daily d
WHERE d.simulated AND d.day > current_date - 7 AND d.cell_id = ANY($1) AND d.visitors >= $2`;

export const DEMAND_STOCKED_SQL = `
SELECT DISTINCT b.product_id AS id FROM batch_stock b
WHERE b.shop_id = $1 AND b.estimated_qty > 0 AND b.product_id = ANY($2)`;

export const DEMAND_PURGE_SIGNALS_SQL = `DELETE FROM demand_signals WHERE at < now() - interval '24 hours'`;

export const DEMAND_PURGE_PHOTOS_SQL = `
DELETE FROM demand_photos
WHERE expires_at < now() OR (status = 'pending' AND created_at < now() - interval '24 hours')
RETURNING path`;

export const DEMAND_EXPIRE_PHOTOS_SQL = `
UPDATE demand_photos p SET status = 'expired'
WHERE p.status = 'active'
AND (SELECT count(DISTINCT s.visitor_hash) FROM demand_signals s
  WHERE s.demand_kind = p.demand_kind AND s.demand_key = p.demand_key
  AND s.cell_id = p.cell_id AND s.at > now() - interval '24 hours') < $1
RETURNING path`;
