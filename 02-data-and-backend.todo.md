# Build the stock data foundation and backend

Status: In progress. Priority: Core. Dependencies: Confirmed scope and stack from task 01; its remaining checks are deferred by user.

## Outcome

A backend that reliably derives stock, isolates shop records, provides discovery data, and can reset a reproducible simulated demo.

## Questions to ask the user

1. Confirmed: one owner per shop first; staff later. Multi-shop ownership and production identity verification can be revisited before the pilot.
2. Confirmed: integer piece/pack/carton units. Seeded provision goods use packs; distinct sizes/units have separate catalog IDs, without automatic conversion.
3. Confirmed: block a sale above available stock and request a recount.
4. Which prices, phone numbers and shop details may buyers see? How long should private records and buyer search data be kept?
5. Confirmed: track expiry by batch and defer purchase costs and profit calculations.

## Tasks

- [x] Define canonical products with brand, variant, size, unit, category and perishability; support aliases without merging distinct variants.
- [x] Define the demo owner/shop schema with pin verification state, landmark and category. One owner is the sole authorized actor; no phone/contact publication is enabled. Real pins and public fields remain a pilot decision.
- [x] Design migrations for shops, products, append-only stock events, searches and feedback, with immutable command/confirmation audit records. Real consent collection remains deferred.
- [x] Include event identity, signed quantity delta, type, occurrence/recording times, source, actor, idempotency key and correction linkage. Store Naira amounts as integer kobo with explicit NGN currency.
- [x] Define opening stock, sale, restock and recount semantics. Compute recount delta against the current balance atomically; preserve the previous history.
- [ ] Make retries idempotent and concurrent stock checks safe. Reject invalid quantities and prevent unauthorized writes.
- [x] Derive quantity and stock confidence separately. Remaining batches must all have recent confirmations; a sale does not refresh confidence. Distinct negative feedback suppresses discovery without changing the ledger.
- [x] Define batch allocation: sell earliest expiry first, unknown expiry last, and exclude expired batches from sale/discovery. Recounts target a specific batch and can link to an erroneous event.
- [x] Implement demo owner-session, private stock, paginated catalog and simulated public-discovery Route Handlers with restricted fields, validation and stable errors. Production authentication remains a real-data launch gate.
- [ ] Add spatial indexing and distance queries, plus indexes for stock aggregation and recent events. Keep database credentials private.
- [x] Build a fixed-seed generator: 30 fictional provision shops around illustrative Kubwa clusters, 60 products, Naira prices varying ±10% around illustrative base prices, 75 days of weekday/weekend sales, and eight batches expiring within 30 days of the seed date. The confirmed scope replaces the source's mixed-category suggestion.
- [x] Mark synthetic shop identities and discovery responses simulated; use no real phone numbers. Pin coordinates are illustrative and explicitly not verified businesses.
- [x] Keep the impossible-sales anomaly outside the valid ledger and test that overselling is rejected.
- [x] Test stock arithmetic, recounts, corrections, duplicate requests, queued competing sales, money precision, shop isolation and discovery field restrictions locally. Sixteen tests pass; true multi-connection PostgreSQL concurrency remains pending.
- [x] Document setup, migration/seed commands, non-destructive demo reset and the backup/restore approach below. A hosted backup/restore exercise remains pending.

## Completion criteria

- [ ] A clean environment can be migrated and seeded reproducibly.
- [ ] Stock totals remain correct across sales, restocks, recounts, retries and corrections.
- [ ] One trader cannot read or change another trader's private records.
- [ ] Search exposes only approved data and excludes nonpositive or insufficient-confidence stock.

## Decision log

- 3 November 2026 — User confirmed Next.js frontend/backend, PostgreSQL and Railway free-trial hosting. Implement backend operations inside `web/`. Verify PostGIS support before choosing the spatial schema; use packaged provision goods in Kubwa for the demo.
- 3 November 2026 — User authorized proceeding with this task while deferring outstanding task 01 checks. Local schema/catalog work, synthetic fixtures and tests can proceed. Revisit account/hosting checks before live integration or deployment, and public-field/consent decisions before real-data use.
- 3 November 2026 — User confirmed one owner per shop, overselling blocked with a recount, piece/pack/carton units, batch expiry and deferred cost/profit reporting.
- Provisional demo implementation, not real-market policy: confidence is high through 24 hours, medium through 72 hours, then hidden; three distinct recent negative reports suppress a listing. A fresh delivery never refreshes an older remaining batch. Review thresholds before real-data/public launch.
- Implementation choice to avoid requiring PostGIS before host checks: ordinary latitude/longitude indexing, a bounding-box filter and exact spherical straight-line distance for this small demo. PostGIS and routing remain deferred; this is not a verified walking-distance service.

## Progress and blockers

Implemented locally: the two SQL migrations under `web/db/migrations/`, transactional `record_stock`, migration/seed scripts, signed demo-owner sessions, catalog/stock/discovery APIs and 16 local database/security tests. See verification below. No live PostgreSQL or Railway resource has been connected or changed.

Dependency reminder: before connecting PostgreSQL on Railway, return to task 01's trial/connectivity and PostGIS checks. Before live model calls, return to its key/credits smoke test. This task can begin without those services.

## Setup and implemented API contract

Run application commands from `web/`. Keep private connection values in `.env.local`, using `.env.example` as the template.

- `npm run db:migrate`: applies checksum-tracked migrations in one transaction with a migration lock; requires a private PostgreSQL connection. Never edit an already-applied migration; add a new numbered migration instead.
- `npm run db:seed`: requires an empty shop dataset and `ALLOW_DEMO_SEED=true`. Uses seed 20261103; set `DEMO_AS_OF` to reproduce a fixed date or omit it for the current date. Existing shop data is refused, not overwritten. Reproducibility requires the same seed and date.
- `npm test`: creates a fresh in-memory PostgreSQL-compatible PGlite instance, applies actual SQL migrations and seeds fixtures; it does not contact Railway or require secrets.
- `POST /api/demo/session`: enabled only with `DEMO_MODE=true`, a private access code of at least 16 characters and `SESSION_SECRET` of at least 32 characters. Submit JSON `accessCode`; the response lists fictional shops. Submit the code and `shopId` to obtain an HttpOnly signed owner cookie for that simulated shop's owner. This shared demo access mechanism is not production login. `DELETE` signs out.
- `GET /api/products?q=...&offset=0`: up to 50 canonical candidates; ambiguous aliases return multiple variants.
- `GET /api/shops/{shopId}/stock`: owner-only batch estimates, with expiry and confirmation dates. Requires demo mode and a valid owner cookie; this is not a public stock-count endpoint.
- `POST /api/shops/{shopId}/stock`: superseded by task 03 and now returns `405 CONFIRMATION_REQUIRED`. Use `/api/entries/prepare`, then `/api/entries/confirm` with its signed review. Atomic stock logic, recounts and correction linkage are preserved.
- `GET /api/discovery?productId=...&lat=...&lng=...&radiusKm=5&offset=0`: demo mode only, fresh positive simulated stock ranked by straight-line distance. Returns no exact quantities, price, phone, owner identity or private events. It does not persist buyer coordinates. Real public discovery remains disabled by design.

Write requests require JSON and the configured `APP_ORIGIN` as their Origin header. Set that value to the exact URL used in the browser. Cookies and database/model secrets remain server-side. Missing configuration produces an explicit disabled/unavailable response.

## Verification and remaining work

### Carryover while task 03 proceeds

On 3 November 2026 the user requested continuing task 03 and retaining unfinished task 02 work here. This task remains incomplete; independent task 03 work can proceed.

- [ ] Connect real PostgreSQL, check Railway trial/connectivity and apply migrations.
- [ ] Seed an explicitly designated empty demo database and verify catalog/ledger totals.
- [ ] Test retries, rollback, owner isolation and overselling with separate concurrent PostgreSQL connections. PGlite is serialized and is insufficient evidence for this.
- [ ] Verify hosted networking, limits, application-role permissions and any needed PostGIS extension before deployment.
- [ ] Exercise backup/restore into a separate empty database and compare balances/history.
- [ ] Review stock pagination beyond the bounded demo catalog.
- [ ] Before real-data signup/pilot, finalize identity/recovery, consent, retention, public fields and shop-pin verification. Trader signup/login was requested; synthetic-demo implementation belongs in task 03, with production readiness a separate gate.
- [ ] Review development-dependency advisories recorded during installation; the latest production-dependency audit was clean.

Remind the user before these dependencies are needed for external actions. Continue local code and synthetic tests without repeatedly requesting credentials.

- Local tests cover actual migration SQL, stock arithmetic, idempotency/reused keys, overselling rollback, owner isolation, FEFO, expired stock, linked recounts, exact money, stale stock, public-field restrictions, feedback suppression, session tampering/expiry and deterministic valid seed history.
- PGlite serializes operations. Its competing-request test does not establish multi-connection PostgreSQL locking behavior. Run the same core cases with two real PostgreSQL connections before marking concurrency verified.
- The connection pool limits connections and statement duration; the SQL function locks the shop row before validation/write. The database credentials must never reach a browser. Deployment must use a suitable restricted application role rather than publishing database access.
- Seed/reset approach: tests always use a disposable database. For the demo, migrate and seed a separate empty database to reset; there is deliberately no endpoint that deletes existing records. A destructive reset of a shared/live database needs a specifically authorized target and backup.
- Backup/restore approach before hosting meaningful data: take a private PostgreSQL custom-format backup, restore to a separate empty database, apply required migrations and compare ledger totals/record counts before switching. This has not yet been exercised on Railway.
- Still pending: a live PostgreSQL migration/seed run, multi-connection checks, hosted extension/network checks, tested backup/restore, any required stock pagination beyond the demo's bounded catalog, and real-data privacy/authentication decisions. Task 02 is not complete merely because local tests pass.

Final checks on 3 November 2026: all 16 tests, ESLint and the production build passed after the correction-link changes. Runtime dependency audit reported zero known production advisories. Local HTTP checks confirmed explicit database-unavailable, demo-discovery-disabled and demo-auth-disabled responses without configured credentials. No live connection or deployment was attempted.

Task 03 integration note: added migration 003_trader_accounts.sql and a development-only isolated PGlite adapter to exercise the actual Next.js signup/login and stock APIs without Railway. These local checks do not satisfy the live-database carryovers. All three migrations must be applied to the eventual live demo database.

Task 04 added migration 004_buyer_discovery.sql for pseudonymous search binding and deduplicated buyer interactions. Apply all four migrations to the eventual live demo database. Local API/browser discovery tests do not complete the pending hosted PostgreSQL or backup checks. Provisional 24-hour synthetic-demo search retention requires real-data review before public launch.

3 November 2026 — Hosted database update: a separate Railway PostgreSQL service now backs the synthetic demo. The hosted API check passed concurrent last-item sales (one accepted, one rejected), replay protection, no pre-confirmation write, private-stock authorization and buyer sold-out refresh. This verifies real PostgreSQL API concurrency for this case; backup restore, broader load/fault tests and real-data identity remain pending. Existing unrelated Railway app was preserved.
