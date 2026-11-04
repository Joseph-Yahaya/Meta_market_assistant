export const SALES_SUMMARY_SQL=`SELECT count(*)::int entries,coalesce(sum(-qty_delta*unit_price_kobo),0)::text revenue,
  count(*) FILTER(WHERE unit_price_kobo IS NULL)::int unpriced FROM stock_events WHERE shop_id=$1 AND event_type='sale'
  AND event_at >= ($2::date::timestamp AT TIME ZONE 'Africa/Lagos') AND event_at < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Lagos')`;
export const REACH_SUMMARY_SQL=`SELECT coalesce(sum(opens),0)::int opens,
  to_char($2::date-6,'YYYY-MM-DD') start, to_char($2::date,'YYYY-MM-DD') end,
  (SELECT started_at FROM insight_capture WHERE name='shop_open') capture_started_at
  FROM shop_reach_daily WHERE shop_id=$1 AND day BETWEEN $2::date-6 AND $2::date`;
