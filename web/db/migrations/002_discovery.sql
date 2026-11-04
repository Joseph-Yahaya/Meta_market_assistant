CREATE VIEW discovery_stock AS
SELECT shop_id, product_id, sum(estimated_qty)::integer AS estimated_qty,
  CASE WHEN count(confirmed_at) = count(*) THEN min(confirmed_at) END AS confirmed_at
FROM batch_stock
WHERE estimated_qty > 0 AND (expiry_date IS NULL OR expiry_date >= current_date)
GROUP BY shop_id, product_id;
