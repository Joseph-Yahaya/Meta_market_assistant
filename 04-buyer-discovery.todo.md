# Build buyer search and trustworthy local discovery

Status: Local core built and verified; live voice and production service checks remain pending. Priority: Core. Dependencies: Local task 02/03 foundation; live-service checks remain deferred.

## Outcome

A buyer can find nearby shops carrying the right product, understand availability uncertainty, locate a shop and report whether the item was found.

## Questions to ask the user

1. Confirmed: buyers browse without accounts, with manual location only. Do not request device geolocation.
2. Confirmed: start at 5 km. The provisional demo freshness policy from task 02 remains subject to review before real launch.
3. Confirmed: show estimated availability and last-confirmed time; hide exact counts, prices and phone numbers.
4. Confirmed: nearest eligible shops first. Paid promotion remains deferred and must not silently alter ranking.
5. Photo search and route drawing are confirmed deferred. Revisit them only after the core demo is reliable and time remains.

## Tasks

- [x] Build the buyer interface at /buyer with text search, explicit canonical variant selection, manual demo-area/coordinate/map pins and a phone-friendly layout. Device geolocation is omitted as requested; map behavior stays client-side and inventory queries stay server-side.
- [ ] Add voice queries using the verified transcription service; confirm unclear product variants.
- [x] Query positive, unexpired, fresh stock using the existing bounded latitude/longitude and spherical-distance implementation. Show straight-line distance explicitly; PostGIS remains a host verification item, not a claimed integration.
- [x] Present Leaflet/OpenStreetMap plus an independent list with name, landmark, estimated availability, confirmation time and distance. Counts, prices and phone numbers stay private. Map tiles load only after the buyer chooses to load them.
- [x] Explain unknown variants, empty/stale/out-of-radius results and outages separately; offer a wider radius and exact variant changes without fabricating stock.
- [x] Add Found it / Not found after a reported visit, with signed result/session-bound tickets, rate limits and one report per anonymous session/shop/product/day. Feedback never changes ledger quantities; three recent negative sessions can suppress a listing under the provisional demo policy.
- [x] Record one search per submitted search, deduplicated shop-open and self-reported visit events, without storing raw query or buyer coordinates. Polls reuse the search token and do not count as new searches. No route-click or purchase metric is invented.
- [x] Implement five-second polling with no overlapping requests, abort on changed searches, pause while hidden/offline and retry on return. Verify automatic appearance of newly stocked shops and removal after sell-out without a page reload.
- [ ] Test slow mobile networks, permissions denied, unavailable tiles and accessibility of the list without a map.
- [ ] If routing is approved, verify service terms and Kubwa coverage, avoid using demo routing services for production, and retain pin/landmark/distance fallback.
- [ ] If photo search is approved, verify actual segmentation and vision support first. Limit initial examples to packaged goods, display candidate products with meaningful confidence where supported, and require buyer confirmation before inventory lookup.
- [ ] Put unsupported hardware identification and unavailable vision integrations on the roadmap rather than displaying fabricated matches.

## Completion criteria

- [x] Local buyer can select the exact variant and find an eligible shop or understand empty/unavailable results.
- [x] A local trader sale changes buyer results on the next automatic poll without refreshing the page; a manual refresh control is also provided.
- [x] Local SQL/API tests cover zero/stale stock, feedback and explicit unavailable-service errors. Manual-only location eliminates the geolocation-denial dependency. Real weak-network/device checks remain pending below.
- [x] Simulated listings and estimated availability are clearly labelled in the interface, map context and API responses.

## Decision log

- 3 November 2026 — User selected manual location only (option 2) and approved the proposed 5 km, nearest-first, privacy-preserving display defaults (option 1). No device geolocation will be requested.
- Implementation choice: five-second polling with overlap prevention, pause while hidden/offline and recovery on return. This works without a host-specific persistent socket service.
- 7 November 2026 — Owner superseded manual-only location for Feature R part one: buyers get "Use my location" plus a draggable map pin with area fallback (no typed coordinates, no raw coordinates stored); traders set the shop pin at sign-up with one tap; shop cards link out to "Get directions". Radius selector stays until Feature O; no in-app routing yet.

- 3 November 2026 — User confirmed trader signup/login and buyer browsing without accounts. Buyer registration is outside current scope.

- 3 November 2026 — User confirmed Kubwa and packaged provision-shop goods; photo search and route drawing are deferred. Core discovery uses distance, map/list and landmarks.

## Progress and blockers

Implemented and locally verified anonymous buyer search, optional map, result list, visit feedback, minimal event tracking and polling. All fixtures remain simulated. Preserve pending live Meta, Railway/PostgreSQL, verified-pin and real-user privacy gates.

R part one (7 November 2026): buyer device location, draggable map pin, area fallback without typed coordinates, per-shop "Get directions" external link, one-tap shop pin at trader signup. Evidence: 44/44 automated tests (new directions-link and no-raw-coords storage tests), clean lint, production build passes. No migration, no reseed. Owner browser checklist pending.

O non-AI widening (7 November 2026): Distance selector removed; every search starts at 5 km and the server widens to 10 then 20 km while nothing is found, returning the searched radius for a clear message. Deterministic distance ranking, privacy rules, tokens and polling unchanged; nothing recorded for unmet demand. Location errors split into blocked/unavailable/timeout with a browser allow-hint. Evidence: 47/47 tests, clean lint, production build passes.

## Implemented routes and behavior

- `/buyer` is open without signup. Traders can reach it through Browse market; the buyer header links back to the trader workspace.
- Buyers choose a canonical product and pack size explicitly. Text matching handles a small set of English/Pidgin filler words; this is simple keyword matching, not a claim of general language understanding. Unknown items are not guessed.
- Location is manual only: illustrative Kubwa area presets, numeric coordinates or a clicked map pin. No geolocation request exists. The default radius is 5 km, adjustable to 50 km, with nearest eligible results first.
- Public cards show simulated shop name, landmark, straight-line distance, estimated availability and last confirmation. Exact stock, prices, phone numbers, owner identity and private events are never selected into buyer results.
- `POST /api/buyer/search` uses request bodies so coordinates do not appear in search URLs. Initial searches create one minimal search record; signed search tokens allow polls to reuse that record. Coordinates and raw query text are not stored in the search table or feedback tokens.
- Search tokens bind the manual query by a keyed digest and bind a short-lived pseudonymous browser session. Feedback tickets are signed, session-bound and expire after 15 minutes. Feedback is rate limited and can be corrected rather than creating duplicate votes.
- `POST /api/buyer/feedback` distinguishes shop selection from a self-reported visit. Repeated events for one search/shop/kind are deduplicated. Found it / Not found changes only a report, never stock quantities. Three recent negative sessions can suppress a listing; a fresh recount makes earlier negative reports inapplicable.
- Anonymous session checks distinguish browser sessions, not verified people. Clearing cookies can evade that distinction. Stronger abuse controls are required before a public real-data launch.
- Five-second polling does not overlap requests, aborts superseded searches, pauses while hidden/offline and resumes on return. Errors retain an explicit stale/unavailable warning rather than disguising an outage as an empty market.
- The Leaflet 1.9.4 map loads OpenStreetMap tiles only after an explicit Load OpenStreetMap action. The interface explains viewed-area sharing, shows visible attribution, offers a tile-error/list fallback and does not draw routes. Map popups use DOM text rather than inserting shop-supplied HTML.
- The buyer voice adapter reuses the validated Meta transcription pipeline without requiring trader login. It limits clips, does not save audio, asks for processing consent and requires exact variant selection afterward. It remains disabled until the deferred Meta checks pass.

## Demo-only data retention and limits

Session cookies last up to 24 hours; keyed visitor digests rotate daily. Demo search/interaction records expire after 24 hours, with cleanup on later submitted searches; feedback older than 24 hours for simulated shops is also cleaned up. These are provisional synthetic-demo implementation choices, not agreed real-user retention policy. Revisit consent, retention, abuse controls and lawful processing before accepting real buyer data.

The interface displays the 50 nearest eligible shops and asks the buyer to narrow the radius if more exist. The seeded pilot-size demo has 30 shops, plus explicit local test fixtures. Do not imply a complete nationwide listing.

## Verification on 3 November 2026

- All **31 automated tests passed**: actual SQL migrations and stock logic, canonical matching, valid/manual search inputs, token tampering/expiry, query binding, public-field restrictions and feedback/event deduplication.
- `node scripts/check-local-buyer.mjs` passed against actual Next.js routes with fictional local data. It verified anonymous search, search-token reuse, rejection of another session's feedback ticket, repeated-report protection, three-session suppression, unchanged ledger balances, recount recovery, sold-out result removal and a genuinely empty area.
- Browser checks passed product/size selection, 5 km search, Found it feedback, OpenStreetMap rendering and visible attribution, manual coordinates, and the honest no-stock state at coordinates 0,0.
- Browser live-update proof: a new fictional shop with two units appeared on an already-open search automatically. After confirming a sale of its last two units through the stock API, its card disappeared on the next poll without reloading the buyer page.
- A 390 by 844 browser viewport showed no horizontal overflow (document width 375, viewport width 390). Reset the temporary override afterward. This is not a physical phone test.
- Production dependency audit reported zero known runtime vulnerabilities. Development advisories remain recorded in task 02.
- Final ESLint and production build both passed after the last UI text/style changes (exit code 0).
- Visual evidence: `web/.local-run/task04-buyer-proof.png`. Local buyer page: http://127.0.0.1:3000/buyer.

## Deferred checks and reminders

- [ ] Before live buyer voice calls, revisit task 01's key/access/credits smoke test and task 03's real English/Pidgin/audio checks. No real Meta call was made for task 04.
- [ ] Test actual slow/offline device behavior, denied microphone permission and forced tile failures. Code handles these paths, but the browser responsive/API checks do not prove every device/network case.
- [ ] Before Railway deployment, finish task 02's real PostgreSQL migration/seed, multi-connection checks, permissions/network/extension checks and backup/restore. Apply all four migrations, including `004_buyer_discovery.sql`.
- [ ] Before real public discovery, resolve shop verification, density/freshness launch gates, real-data consent/retention and stronger anonymous abuse controls. Current routes expose simulated shops only.
- [ ] Recheck production map-provider capacity/terms and attribution before broad traffic. Official sources checked: https://leafletjs.com/reference-1.9.4.html and https://operations.osmfoundation.org/policies/tiles/.
- [ ] Photo search and route drawing remain explicitly deferred, not broken controls in the demo.

Core local discovery is implemented and verified. Live voice, physical-device/network checks and real-service/public launch gates remain open.