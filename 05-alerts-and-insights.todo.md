# Build stock alerts and useful trader summaries

Status: In progress. Local alert rules, settings and today's recorded-sales summary implemented and checked. Priority: Core expiry suggestion; other insights staged. Dependencies: Tasks 02 and 03.

## Outcome

Traders receive useful stock/expiry information from reliable records. Advanced demand analytics remain a separately approved later phase.

## Questions to ask the user

1. Which products need low-stock alerts, and should thresholds be fixed per product or set by traders?
2. Is the proposed 30-day expiry window suitable for the selected categories? What sale restrictions or review are needed for pharmacy items?
3. When should summaries arrive, through which channel, and what notification limits or quiet hours apply?
4. Should clearance suggestions be text only, and must traders approve every price change or promotion?
5. Are paid demand insights explicitly deferred? Before enabling them, what minimum distinct-searcher threshold, geography and reporting period should apply?

## Tasks

- [x] Use remaining batch quantities and expiry dates to identify eligible items; exclude depleted batches and categories without expiry relevance.
- [x] Implement simple, configurable low-stock and expiry rules before forecasting. Clearly distinguish low-stock alerts from periodic accuracy recounts.
- [ ] Generate grounded clearance suggestions through the verified model using only approved inventory facts. Prevent invented demand, margins or automatic discounts.
- [ ] Keep product safety, expiry and category restrictions in deterministic rules; do not suggest selling expired goods or let the model choose regulated advice.
- [x] Build an on-demand daily summary of recorded sales, current estimated stock, pending recounts and alerts. Revenue is recorded revenue, not profit. Scheduled snapshots remain below.
- [x] Include shop opens from search over seven WAT calendar days with an explicit definition, deduplication and a simulated label. This is not acquired customers; the first week is labelled partial.
- [ ] Implement alert and summary logic in server-only Next.js code. Choose a scheduler supported by the selected host and protect any scheduled Route Handler from unauthorized invocation. Include idempotent dispatch, deduplication, timezone handling, retries and opt-out controls.
- [ ] Show alerts in the application first; enable external delivery only through the confirmed channel and current provider requirements.
- [ ] Test expiry boundaries, partial batch depletion, repeat jobs, missing dates, unsupported model output and notification failures.

## Later phase backlog within this task

- [ ] After sufficient real usage and approval, define search-spike comparisons with an adequate baseline and unmet demand within an agreed radius.
- [ ] Aggregate/anonymize before reporting; agree a minimum number of distinct searchers (the source's five is only an example), suppress sparse groups and never expose individual buyer activity.
- [ ] Label simulated demand demonstrations; do not claim real trends from seeded traffic.
- [ ] Test willingness to pay, promotion rules and opt-in price benchmarking before introducing a paid tier. Treat location trends as later-stage until data volume supports them.

## Completion criteria

- [ ] The demo reliably produces a relevant near-expiry suggestion from its seeded data.
- [ ] Alerts are grounded, actionable and not duplicated; trader approval controls any resulting promotion.
- [ ] Summaries distinguish estimates, recorded activity and simulated traffic. Later-phase checkboxes are not demo blockers.

## Decision log

- 3 November 2026 — First release is the hackathon demo with web trader logging. Start alerts and summaries in the application; external messaging is deferred.
- 3 November 2026 — User confirmed adjustable defaults: low stock at 5 selling units and expiry within 30 days. Settings persist per shop and support opt-out.

## Progress and blockers

Implemented `web/src/lib/stock-alerts.ts`, owner-only `/api/shops/[shopId]/insights`, `web/src/app/stock-insights.tsx` and migration `005_alert_settings.sql`. Alerts use remaining quantities, WAT calendar dates and stable per-batch/product identifiers. Expired batches are excluded from sellable estimates; missing expiry and physical counts older than 72 hours are separate warnings. Suggestions are deterministic inventory guidance, explicitly not AI output. No automatic discounts or promotions exist.

Evidence: 35 automated tests, lint, TypeScript and production build passed. `web/scripts/check-local-alerts.mjs` passed against the isolated local app: authentication, validation, near-expiry fixture, low stock, stable repeat reads, settings persistence and opt-out. Browser showed the summary and adjustable settings; screenshot `web/.local-run/task05-alerts-proof.png`.

Still required before task completion:
- Completed 3 November: current stock/recount/alert summary and weekly anonymous shop-open totals. Migration `006_shop_reach.sql` counts only successful first inserts of shop-open interactions; repeat requests and visit reports do not inflate totals. Daily aggregate survives raw search cleanup, retains no buyer identifiers, and is owner-only. No historical backfill. Capture-start timestamp and partial-first-week explanation are visible.
- Verified Meta clearance integration and invalid-output tests. Revisit task 01 key/access/credits smoke test before any live call. No Meta calls or credits were used here.
- Protected scheduler, agreed WAT dispatch time, durable idempotency/retries and failure tests. Current on-demand reads do not dispatch notifications. Confirm timing and text-only clearance policy before enabling those features.
- Physical-phone/weak-connection check remains. Browser walkthrough passed with a fictional four-pack batch expiring in seven days: relevant expiry and low-stock guidance appeared. Phone-sized viewport had no horizontal overflow; this is not a physical-device test.
- Revisit task 01 Railway trial/connectivity/limits before deployment, acceptance checklist before calling the demo complete, and consent/privacy gates before real data.

Latest evidence: 38 tests passed, lint and production build passed. Local alert API and trader-to-buyer flow passed, including a duplicate shop-open yielding exactly one weekly count and matching stock summary. SQL tests cover cleanup survival, owner separation, seven-day boundaries, WAT midnight, missing-price revenue and recount exclusion. Screenshot: `web/.local-run/task05-summary-proof.png`.

Next action: scheduler/model-dependent work at the relevant gates, then task 06 acceptance/release preparation. Task 05 remains open. Advanced paid insights and external messaging stay deferred. No live Meta call or Railway provisioning was performed.
