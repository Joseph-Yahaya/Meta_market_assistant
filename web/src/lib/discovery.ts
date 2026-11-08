// Reused by the API and database tests. No buyer coordinates are stored here.
export const DISCOVERY_SQL = `
WITH candidates AS (
  SELECT s.id AS shop_id,s.name,s.landmark,s.latitude,s.longitude,s.simulated,
    d.product_id,d.confirmed_at,
    CASE WHEN d.confirmed_at >= now()-interval '24 hours' THEN 'high' ELSE 'medium' END AS confidence,
    6371*2*asin(sqrt(least(1.0,
      power(sin(radians(s.latitude-$2)/2),2)
      +cos(radians($2))*cos(radians(s.latitude))*power(sin(radians(s.longitude-$3)/2),2)))) AS distance_km
  FROM discovery_stock d JOIN shops s ON s.id=d.shop_id JOIN products p ON p.id=d.product_id
  WHERE d.product_id=$1 AND d.estimated_qty>0 AND s.simulated AND p.status='approved'
    AND d.confirmed_at >= now()-interval '72 hours'
    AND s.latitude BETWEEN $2-$4/111.0 AND $2+$4/111.0
    AND s.longitude BETWEEN $3-$6 AND $3+$6
    AND (SELECT count(DISTINCT f.visitor_hash) FROM feedback f
      WHERE f.shop_id=s.id AND f.product_id=d.product_id AND NOT f.found
      AND f.at >= greatest(d.confirmed_at,now()-interval '24 hours')) < 3
)
SELECT shop_id,name,landmark,latitude,longitude,simulated,product_id,confirmed_at,confidence,distance_km
FROM candidates WHERE distance_km <= $4 ORDER BY distance_km,shop_id LIMIT 51 OFFSET $5`;

export function longitudeSpan(latitude: number, radiusKm: number) {
  // Conservative bounding box, including a radius that reaches either pole.
  const edge = Math.min(90, Math.abs(latitude) + radiusKm / 111);
  if (edge >= 90) return 360;
  return Math.min(360, radiusKm / (111 * Math.cos(edge * Math.PI / 180)));
}
