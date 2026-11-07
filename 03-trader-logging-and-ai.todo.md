# Build trader onboarding and voice or text logging

Status: Local implementation and browser/API run verified; live AI/voice and production onboarding checks remain pending. Priority: Core. Dependencies: Task 02's stock foundation; live integrations require the deferred checks.

## Outcome

A trader can onboard, record a sale/restock/recount by supported voice or text, resolve ambiguity, and receive a truthful confirmation of the resulting estimate.

## Questions to ask the user

1. Web logging first and English/Pidgin inputs are confirmed. What representative phrases should we test first?
2. How should traders prove shop ownership, invite staff and recover access?
3. Confirmed: every interpreted entry requires confirmation, with one item per submission. Review demo quantity limits before real launch.
4. How are mixed orders, returns, mistaken entries and prices such as “three for N500” handled?
5. Confirmed: discard audio after transcription; do not retain recordings for troubleshooting.

## Tasks

- [ ] Onboard a shop with category, verified location pin, landmark, initial catalog and opening stock; capture the appropriate communication consent.
- [x] Implement trader signup, login and logout with protected owner sessions and hashed passwords, verified in an isolated local demo. Buyers browse without signup; buyer pages belong to task 04.
- [x] Build trader screens and account/entry Route Handlers in Next.js, with server-side secrets, owner authorization and database writes. Channel webhooks are deferred because the user chose web logging first.
- [x] Implement browser recording/upload, conversion to mono PCM WAV, a 30-second/1.5 MB server limit, provider timeouts, discard-before-send and a manual text/form fallback. No audio is intentionally stored; live browser/microphone verification remains pending.
- [x] Implement the documented Muse Spark structured-output adapter for action, product text, quantity, unit, optional per-unit price and clarification. This is code plus mocked-provider verification; the live model is not yet verified. Dates and batches remain explicit trader choices.
- [x] Validate a fixed schema and business rules outside the model. Reject unsupported actions, invalid prices/quantities and unauthorized operations; missing essentials force clarification.
- [x] Require explicit canonical product/size selection from the catalog; the existing catalog API supports aliases. Unclear quantity or mixed units require manual resolution. No AI-generated product ID is trusted.
- [x] Review every entry with exact product, unit, quantity and price before saving. Signed actor/shop-bound reviews expire after 10 minutes; repeated confirmation returns the original receipt without another event.
- [x] Confirm through the atomic stock backend, mapping absolute counts to recounts. A sale spanning multiple batches creates multiple allocation rows under one idempotent command, not duplicate sale commands.
- [x] Show the recorded action and resulting estimated balance after commit; errors never report a successful save. Retrying a timed-out review reuses its signed command key.
- [x] Show current batch estimates and recent history, with recount and linked correction actions. Recounts are rejected if the estimate changed after review, requiring a fresh review.
- [x] Handle expired/tampered confirmations, retrying a review and explicit provider-disabled/outage states. Webhook retries are not applicable to the current web-only channel.
- [ ] Check current official WhatsApp consent, messaging-window, template and pricing rules before enabling delivery. Use the chosen fallback if access is unavailable.
- [ ] Test Nigerian English/Pidgin samples, noisy recordings, unknown products, ambiguous numbers such as 9/90, mixed units and adversarial text that attempts to change system instructions.
- [ ] Measure the proposed under-10-second logging journey with representative inputs; report actual timing and limitations.

## Completion criteria

- [ ] Voice and text work for the approved core cases, or a reduced mode is explicitly agreed and disclosed.
- [x] Local validation/review flow prevents silent stock writes; idempotent confirmation retries cannot duplicate changes. Live model accuracy remains a separate pending check.
- [x] The local trader flow supports linked recount/correction history and shows the resulting estimate, verified by SQL and actual API tests.

## Decision log

- 3 November 2026 — User explicitly requested trader signup/login and buyer browsing without accounts. Add trader registration to onboarding.
- 3 November 2026 — User approved confirmation of every interpreted entry, one item per submission and discarding audio after transcription. No recording retention for troubleshooting.
- 3 November 2026 — Continue local implementation while task 02's live PostgreSQL, concurrency, hosting and backup checks stay tracked in task 02. Live integrations are not verified.

- 3 November 2026 — User selected the web logging screen first and reports all Meta Muse API models are available. Target English/Pidgin input; verify actual transcription accuracy. Defer WhatsApp/Telegram integration.

## Progress and blockers

Built: trader signup/login/logout, shop setup, stock dashboard, manual/text/voice entry code, canonical product selection, expiring review, safe confirmations and batch recount/correction. Local API flow verification passed. See evidence and pending gates below; do not mark the entire task complete.

Voice accuracy (7 November 2026): transcription now sends languageBias English plus catalog/action keyword biasing (reference checked; no provider keyword limit published, self-capped at 100). Browser capture uses echo cancellation and noise suppression with volume normalisation and silence trimming; uploads accept WhatsApp .ogg via in-browser decode to 24 kHz mono WAV. Action-first buttons with preset-aware interpretation, mishearing-triggered action question, filler stripping, and 60-second compensating-event undo. check-voice.mjs gained a folder accuracy mode reporting action/quantity/product pass rates. Correction log designed only. Evidence: automated tests, lint and build (see session notes); owner browser checklist pending.

Feature Q (7 November 2026): shared image pipeline behind trader signup — byte sniffing, EXIF stripping, browser resize/re-encode, validated Spark vision proposals, per-minute plus daily image caps, protected analyze route, trial script. Stores nothing. Evidence: 64/64 tests, clean lint, production build passes.

## Implemented behavior and evidence

- Added trader signup, login and logout, shop setup, an owner stock dashboard, recent history, manual/text entry, voice recording/upload code, canonical product selection, review and recount/correction flows. Buyers have no signup requirement; buyer discovery pages are task 04.
- Account passwords use random-salt scrypt hashes; sessions use HttpOnly signed cookies. Owner checks, same-origin writes and database-backed attempt limits protect the demo routes. Signup atomically creates an owner, credential record and provision shop, with an unverified location pin.
- Every stock entry is reviewed before saving. A signed review binds actor, shop and exact fields, expires after ten minutes and carries a random idempotency key. Confirmation takes a shop lock; retries return the original receipt without another sale. A recount is rejected if stock changed after review.
- Direct POST writes to `/api/shops/{shopId}/stock` now return `405 CONFIRMATION_REQUIRED`. The flow is `/api/entries/prepare` followed by `/api/entries/confirm`. Existing owner-only GET returns batches and recent history.
- The Meta adapter requests structured text output and validates it outside the model. Missing essentials force clarification. No model-provided product ID is trusted; the trader selects the canonical variant. Model failure does not fabricate success.
- Browser audio is converted to mono, 16-bit PCM WAV at 24 kHz; the server validates the header and enforces 30 seconds and 1.5 MB. Recordings can be discarded before sending. Audio forwarding is in memory, with no filesystem/database audio storage. Meta's own processing/retention is outside this app's control.
- One item is processed at a time. No automatic carton/pack conversion is applied. Bulk prices, returns, multi-item input and unclear quantities require clarification or manual handling; no return policy has been invented.

## Isolated local demo

Development can use `LOCAL_DEMO_DATABASE=true` with demo mode and a private session secret. It runs PostgreSQL-compatible PGlite under ignored `web/.local-demo/`, applying real migrations and the reproducible fictional seed. It is serialized, is not Railway PostgreSQL, and is disabled in production mode.

Private local settings were created in ignored `web/.env.local` with a generated session secret, the existing local URL and live Meta calls disabled. No existing key was overwritten, no credits were used and no Railway resource was created. Environment/local-database files are excluded from standalone tracing and version control.

This is a simulated account flow, requiring fictitious signup details. Email verification, password recovery, staff invitations, cross-device session revocation and production shop-ownership verification are not implemented. Do not represent these demo accounts as production-ready identity verification.

Commands run from `web/`:

- `npm test`: actual SQL/stock tests plus password, signed-confirmation, audio and mocked-provider tests; no external services.
- `node scripts/check-local-trader.mjs`: requires the running local app and explicitly checks isolated local-demo mode. Creates only fictional local accounts and exercises the actual Next.js signup/login/entry endpoints.
- `npm run lint` and `npm run build`: application checks. A production build must use a real PostgreSQL connection; it cannot silently fall back to PGlite.

Verified on 3 November 2026 after the final recording-discard change: **25 tests passed, ESLint passed, and the production build passed**. The complete local API flow passed signup/login, cross-owner rejection, prepare-without-write, confirmation replay, sale, recount, stale-review rejection, overselling rejection, logout and explicit AI-disabled fallback. Provider tests are mocked; they do not establish model accuracy or real account access.

Official integration references checked on 3 November 2026: [structured text output](https://dev.meta.ai/docs/structured-output), [voice transcription](https://dev.meta.ai/docs/speech-to-text) and [Meta quickstart](https://dev.meta.ai/docs/quickstart).

## Privacy-safe correction log (designed 7 November 2026, not built)

Purpose: learn which words speech recognition mishears so prompts and keyword bias improve, without storing anything identifiable.

- Stored per correction: the heard word, the corrected word, and an occurrence count. Nothing else: no audio, no full sentences, no transcripts, no shop or product linkage, no day-by-day trail.
- Consent first: the trader opts in with explicit text before anything is sent, for example: "Help improve voice recognition by sharing corrected words. Only the two words and a count are stored, never audio or sentences. You can opt out at any time." Default is off; no silent sending.
- API sketch: `POST /api/voice/corrections` with shop, heard word and corrected word. Server validates one or two lowercase words each, maximum 40 characters, rejects digit-heavy strings that look like phone numbers or codes, and upserts the pair count. Owner session required, daily per-account cap.
- Abuse and retention: counts are aggregates from the start (no raw-event table to clean later). Validation rejects sentences, long text and non-word input.
- Open before building: final consent wording (owner to approve), whether corrections from buyer voice are ever included (no for now), and who reviews the counts and how often.

## Remaining checks and contextual reminders

- [ ] Before live Meta calls, revisit task 01's key/access/credits check and smoke test. Only then enable `ENABLE_META_CALLS`; it is currently false.
- [ ] Test real Nigerian English/Pidgin, noisy audio, unknown products, 9/90 ambiguity and the under-ten-second target. Mock responses do not establish these outcomes.
- [ ] Verify actual browser microphone permissions, recording cancellation, mobile layout and weak-network interactions. Desktop/narrow browser signup and manual stock entry have since passed; real microphone/device and weak-network checks remain pending.
- [ ] Verify shop pins and any necessary communication consent before a real pilot. Illustrative coordinates are not verified locations.
- [ ] Before real signup, revisit identity/recovery, consent, retention and session revocation. Use fictitious details in the current demo.
- [ ] Live PostgreSQL/Railway, multi-connection tests and backup/restore stay in task 02's carryover list; local PGlite does not close those items.
- [ ] WhatsApp/Telegram webhooks, messaging consent and current template rules remain deferred under the approved web-first scope.

Task 03's local implementation is built and tested. Full live AI/voice and production-onboarding acceptance remains incomplete.
## Task 03 execution run on 3 November 2026

The user requested running task 03. Started the local app, verified service readiness, and reran `node scripts/check-local-trader.mjs` successfully. It covered signup/login, cross-owner rejection, review-without-write, confirmation replay, sale, recount, stale-review rejection, overselling and explicit AI-disabled fallback. All test accounts and stock changes were fictional and local.

Browser verification also passed through the actual screens: created a fictional trader/shop, selected Indomie noodles 70g, reviewed opening stock of 10 packs at N250.50, confirmed it, then reviewed and confirmed a sale of 3 packs. The success notice and stock panel both showed 7 packs. Nothing was added to stock during the review-only step.

At a 390 by 844 browser viewport, the manual entry controls and single-column dashboard fit without horizontal overflow (reported document width 375, viewport 390). Reset the temporary viewport override afterward. This is a browser responsive check, not evidence from a physical phone or microphone.

Saved visual evidence at `web/.local-run/task03-browser-proof.png`. The running app is available at http://127.0.0.1:3000/. Existing 25 automated tests, lint and production-build checks remain the latest code verification; no code change was needed for this execution run. Live Meta calls stayed disabled and no Railway resource was touched.
3 November 2026 — Authenticated Muse Spark 1.3 text smoke test passed after the user saved the private key and confirmed available credits. Application calls remain disabled. Next: verify structured extraction with synthetic English/Pidgin text, ambiguity and provider failures before enabling UI interpretation; voice remains separately unverified. No credentials or full provider response recorded.

3 November 2026 — Live application-adapter extraction test passed 4/4 using Meta Muse Spark 1.3: English sale (3 packs, 70g size, N250.50/unit), Pidgin restock (6 packs, 14g, no invented price), missing quantity (clarification, null quantity), and multiple products (clarification). Used the actual createMetaClient extraction path and schema validation, not mocks. Script: `web/scripts/check-meta-entries.mjs`; lint passed. Synthetic text only; no inventory writes or full provider responses logged. This small sample does not establish broad Pidgin accuracy, voice quality, or complete UI-to-confirmation integration. App-wide calls remain disabled pending that controlled integration check.

3 November 2026 — Local application integration: ENABLE_META_CALLS=true was set privately after the successful live extraction checks and user authorization. The live /api/entries/interpret route passed with a fictional two-pack Indomie sale; interpretation and review left stock at 2, confirmation changed it to 0, replay was flagged and produced only one sale event, and polling the same buyer search removed the sold-out shop. Script: web/scripts/check-meta-flow.mjs. This test makes one live model call and requires the isolated local database; it is separate from offline release checks. Browser control failed to initialize even after reset, so actual screen rendering/click-through remains pending. Voice remains unverified. No credential or local database was committed.

3 November 2026 — Hosted deployment update: local Spark extraction still passes. Hosted Chat Completions returned upstream HTTP 404 despite matching secret configuration. Added status-only diagnostics, a strict-schema Responses adapter for the same model, and an incomplete-output rejection test. Live Responses extraction passed locally; hosted compatibility is under verification. No full provider response or key was logged. Browser control and voice remain unverified.

3 November 2026 — Final hosted verification passed using the Responses adapter and the same Muse Spark 1.3 model. The live public flow verified readiness, signup/session, real model interpretation, stock unchanged during interpretation/review, one confirmed sale, replay without duplication, buyer polling removal, unauthenticated stock denial, competing last-item sales (HTTP 200 and 409), and insights. Script: web/scripts/check-hosted-demo.mjs. Both homepage and buyer page and their stylesheet delivery returned HTTP 200. Hosted Chat Completions 404 remains a protocol-specific deployment issue; Responses is the verified hosted configuration. Final compatibility deployment: 31104cb9-0aed-49c1-9d54-45e6f8fd530e. No final video, visual browser/voice claim, backup restore or competition submission is implied.
