export const BUYER_EVENT_SQL=`INSERT INTO buyer_interactions(search_id,shop_id,product_id,kind) VALUES($1,$2,$3,$4)
  ON CONFLICT(search_id,shop_id,kind) DO NOTHING RETURNING id`;
export const BUYER_FEEDBACK_SQL=`INSERT INTO feedback(shop_id,product_id,visitor_hash,found,search_id)
  VALUES($1,$2,$3,$4,$5) ON CONFLICT(shop_id,product_id,visitor_hash,day)
  DO UPDATE SET found=excluded.found,search_id=excluded.search_id,at=now()`;
