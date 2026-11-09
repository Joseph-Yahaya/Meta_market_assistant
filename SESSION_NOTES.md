# SESSION_NOTES.md

Last updated: 7 November 2026. Branch: `next-phase`. Remote: owner's own
https://github.com/Joseph-Yahaya/Meta_market_assistant (verified with
`git remote -v`). The teammate's submission repository
https://github.com/official-pam/Meta_market_assistant must never be changed.

## 7 November 2026 — Feature Q built (no UI yet; owner trial pending)

- Built: shared byte checks (content sniffing, 5 MB cap, EXIF strip for
  JPEG/PNG, WebP-EXIF refusal), browser resize to 1280 px with JPEG
  re-encode, Spark vision call with strictly validated proposal
  (photo text is data, non-products rejected), protected
  POST /api/images/analyze for signed-in traders with per-minute and
  daily image caps, and a trial script printing fields only. Q stores
  nothing; originals discarded. No database change, no reseed, no live
  calls made from here.
- Owner decisions recorded: bottle unit for N, 10-new-products-a-day
  confirmed, N photos to an ignored local folder until hosting exists.
- Tests: 64/64 pass (Q7 suite: types, oversize, metadata, injection,
  caps). Lint clean, production build passes with the new route.
- Committed on `next-phase` (not pushed). Short trial checklist given
  to the owner in chat.

## 7 November 2026 — Q and N acceptance recorded (design only, not built)

- Owner supplied acceptance criteria: 7 items for Q (shared image
  pipeline), 11 for N (add a product by photo). Recorded verbatim in
  BUILD_PLAN.md. Notable: new "bottle" unit in N(4), 10-products-a-day
  cap still to confirm in N(7), storage location open in Q(7).
- Probe script committed separately first (key-free, verified). Docs
  committed on `next-phase` (not pushed). Nothing built.

## 7 November 2026 — free-text multi-variant search built (awaiting owner browser check)

- Built: type-and-find without dropdown picking, keyword matching with
  an 8-variant cap, parallel single-product searches merged and grouped
  by shop, per-variant availability with narrowing chips, "Not in our
  list yet" and "No shops found within 20 km" states. Server unchanged;
  privacy rules intact; feedback stays variant-bound. No database
  change, no reseed.
- Tests: 58/58 pass (new: match cap, shop grouping). Lint clean,
  production build passes.
- Committed on `next-phase` (not pushed). Manual browser checklist given
  to the owner in chat.

## 7 November 2026 — key and image test passed (gate, not a feature)

- One live request to muse-spark-1.3 via Responses with a generated
  32x32 test PNG: PASS, image input accepted, description returned.
  (A prior dummy-key probe returned 401 as expected; no cost.)
- Decision: Feature N takes the photo-first path; Q's AI-call step can
  use Spark vision. No image feature built.
- Docs committed on `next-phase` (not pushed). Probe script and its
  package entry left uncommitted per instruction.

## 7 November 2026 — voice check goes local-only (done)

- check-voice.mjs now defaults to http://127.0.0.1:3000, logs in with a
  test trader account from VOICE_TEST_EMAIL/VOICE_TEST_PASSWORD, and
  refuses non-local origins unless --allow-remote is passed. No keys,
  passwords or cookies printed. Railway references removed.
- Tests: 57/57 pass (new local-origin guard test). Lint clean,
  production build passes. Committed on `next-phase` (not pushed).

## 7 November 2026 — voice accuracy built (awaiting owner browser check)

- Built: keyword-biased transcription, improved browser capture, OGG
  upload support, action-first flow with action-choice question,
  mishearing list, filler stripping, 60-second undo, folder accuracy
  mode in check-voice.mjs. Correction log designed, not built. No
  database change, no reseed; no live Meta calls made from here.
- Tests: full suite green including 8 new voice-accuracy lib tests and a
  multi-batch undo-math SQL test. Lint clean, production build passes.
- Committed on `next-phase` (not pushed). Manual browser checklist given
  to the owner in chat.

## 7 November 2026 — O non-AI widening built (awaiting owner browser check)

- Built: Distance selector removed; server-side 5→10→20 km widening with
  a clear message; empty-at-20 km state with no unmet-demand recording;
  location errors split into blocked (with browser allow-hint),
  unavailable and timeout. No database change, no reseed.
- Tests: 47/47 pass (new: widening steps/message, location messages,
  5/10 km SQL boundary). Lint clean, production build passes.
- Committed on `next-phase` (not pushed). Manual browser checklist given
  to the owner in chat.

## 7 November 2026 — R part one built (awaiting owner browser check)

- Built: buyer "Use my location", draggable map pin, area fallback with no
  typed coordinates, "Get directions" external link per shop, one-tap
  shop pin at trader sign-up. No database change, no reseed; the running
  dev server picks it up on browser refresh.
- Tests: 44/44 pass (new: directions-link unit test, buyer
  no-raw-coordinates storage test). Lint clean, production build passes.
- Committed on `next-phase` (not pushed). Manual browser checklist given
  to the owner in chat.

## 7 November 2026 — owner decisions recorded (design only, not built)

- Owner decided: routing test on OpenRouteService and Mapbox, walking
  default with driving optional; new products auto-checked with flagged
  items to the owner; store cropped trader photos, buyer photos only in
  alerts and only briefly, shown to traders only after the minimum with
  consent; barcode deferred; minimum 5 distinct searchers in 24 hours;
  household and personal care in scope, medicines and regulated goods out.
  Recorded in BUILD_PLAN.md.
- Build order set: R part one, key and image test, Q, N, O, P, R part two.
  Acceptance written for R part one only.
- Documentation committed on `next-phase` (not pushed). Nothing built.

## 7 November 2026 — owner change request (design only, not built)

- Owner tested locally and requested Features N–R; added to BUILD_PLAN.md.
  Nothing built. Feature R replaces Feature I; dependencies line updated
  (O before P; Q before the photo parts of N, H and P).
- Standing agreement: the sandbox cannot reach localhost, so for every
  future feature run the automated tests and any checks that do not need
  the server, and give the owner a short manual checklist to verify in
  their browser.
- Dev server running detached on http://127.0.0.1:3000 since 7 November
  (started with one-time elevated approval; verified with an unsandboxed
  probe: /api/health 200 ready, /buyer 200).

## What changed (6 November 2026)

- Copied `BUILD_PLAN.md` into the project root next to `AGENTS.md`.
- Step 0 fixes: strict integer validation for daily-cap env values (invalid
  input falls back to the default, never a tiny limit), extended invalid-env
  test cases, removed the unused `wav` variable in `check-voice.mjs`.
- Confirmed the `HTTP 429` test-output line is a mocked provider failure,
  not a real call.
- `AGENTS.md`: push destination corrected to the owner's repository, with an
  explicit never-touch rule for the teammate's repository, plus a read-first
  line for this file.
- Committed on `next-phase` (not pushed):
  1. Daily model-call caps and trader processing panel.
  2. Step 0 fixes.
  3. Notes and plan files (this file, `AGENTS.md`, `BUILD_PLAN.md`).

## Check results (6 November 2026)

- `npm test`: 42/42 pass. `npm run lint`: 0 errors, 0 warnings.
  `npm run build`: passes.

## What is next

- Waiting for the owner's "go" before any feature work.
- Next feature when approved: Feature A (simulated demand spike and trader
  insight), starting with migration `007`.
- Still pending from plan Step 0: local `npm run dev` browser check of the
  trader and buyer screens.
- Build order set 7 November: R part one, key and image test, Q, N, O, P, R part two. R part one, O widening, voice accuracy, image gate and free-text search built and committed (owner browser checks pending); next is Feature Q when the owner says go.

## Open questions

- BUILD_PLAN.md section 8 decisions: spike thresholds and minimum group
  size, quiet hours and notification limits, language pass threshold, future
  hosting, owner's own Meta API key, daily-cap values.
- `06-demo-release-and-pilot.todo.md` and `web/README.md` still reference
  `official-pam/Meta_market_assistant` as the destination (3 November
  history). Flagged for annotation; not changed yet.
- 7 November open decisions, all decided the same day: OpenRouteService
  and Mapbox test, walking default; flagged products to the owner;
  cropped trader photos stored, buyer photos brief and alert-only with
  consent; barcode deferred; minimum 5 in 24 hours; household and
  personal care in, medicines and regulated goods out.

## 8 November 2026 - Feature N built (add a product by photo, photo-first)

- Migration 007 adds shop_id/status/photo_path/flag_reason/created_by/created_at
  plus the bottle unit. Additive; catalog rows default to approved. Applies
  automatically on the next dev-server restart; demo data untouched.
- Trader flow: "Not in your list. Add it with a photo" button, camera capture,
  optional back-label photo, AI proposal card with Yes/No, picture unit
  buttons, "Is it one of these?" closest list, typed-name fallback with the
  same unit buttons. Regulated goods refused in code; 10 new products/day.
- Cropped photos kept in ignored web/.local-uploads/ only. Owner review list
  at /operator (access code in DEMO_ACCESS_CODE), approve/reject, photo view.
- Gates: npm test 71/71, npm run lint 0 errors, npm run build green.
  Owner must restart the dev server once so 007 applies, then run the
  browser checklist from the handoff message.

## 8 November 2026 - Trader usability fixes (messages, resets, proposal polish)

- Entry messages moved into the record panel; add-by-photo has its own
  message zone under each action button. Live regions scroll into view;
  errors persist until the next action. Buyer feedback and owner review
  errors now show inline at the row.
- Rejected photos cannot be re-read without a new photo or Cancel.
- Confirm now clears text, filter, quantity (1), price, expiry, action
  buttons and stale AI/batch state. Saving a new product switches to
  Restock, selects it, clears the filter, closes the panel and releases
  photo previews.
- New proposal-polish lib: category mapping, brand/variant split, metric
  sizes, singular/plural units. Variant stored (no migration needed).
- Gates: npm test 76/76, lint 0 errors, build green. No restart needed
  (no migration, no env change); dev server hot-reloads.

## 8 November 2026 - Show/Hide password toggles + Caps Lock hint

- Every password input (trader sign-in, create-account, /operator access
  code) has a Show/Hide button: starts hidden, aria-pressed, 44px tap
  target. Returns to hidden after sign-in, after sign-out, and after the
  page loses focus for more than a minute (tested boundary).
- Caps Lock hint appears under the field while typing with Caps Lock on.
- Autocomplete untouched (current-password / new-password / off). The
  visible text is never logged, stored or sent anywhere new.
- Gates: npm test 77/77, lint 0 errors, build green. No restart needed.

## 9 November 2026 - Owner browser verification passed

- The owner verified Feature N (add a product by photo), the trader
  usability fixes, the /operator review page and the password Show / Hide
  buttons in the browser. All accepted.

## 9 November 2026 - Feature O acceptance criteria agreed (docs only)

- Owner set 10 acceptance criteria for Feature O (AI-assisted buyer
  search) in BUILD_PLAN.md: local matching first, AI only on no-match or
  ambiguity, validated product IDs or "not in catalog", 20-phrase test
  set, consent notice with local fallback, 30 AI searches/visitor/day,
  no raw query storage, unchanged ranking/widening/tokens/polling,
  voice on the same path, tests plus beginner checklist.
- Nothing built. Awaiting owner go-ahead.

## 9 November 2026 - Feature O built (AI-assisted buyer search)

- Local matching first; AI fallback only for no-match/ambiguous queries
  via POST /api/buyer/interpret (query max 120 chars as data + up to 12
  catalog candidates). Returned IDs validated against the catalog;
  invented IDs dropped; "not in catalog" carries a short idea or null.
- Buyer consent checkbox (default off) with a notice near the search box;
  local matching is the fallback for declined/unavailable/capped.
- Caps: 30 AI searches/visitor/day (MODEL_DAILY_CAP_BUYER_AI) plus the
  global cap and a 30/15min rate limit. No raw query text stored/logged.
- Voice uses the same path after transcription with buyer confirmation
  (no voice-code change needed). Ranking/widening/tokens/polling untouched.
- 20-phrase set (English, misspellings, Pidgin, local names) written once,
  never tuned. check-buyer-ai.mjs runs it against the live API and prints
  phrase, products and pass rate; NOT run yet (needs owner go-ahead).
- Gates: npm test 86/86, lint 0 errors, build green. No restart needed.

## 9 November 2026 - Feature O live accuracy check: 20/20 (100%)

- Ran scripts/check-buyer-ai.mjs once against the local server (owner
  go-ahead). 9 AI calls used; 11 phrases settled by local matching.
- Local passes (11): indomie, peak milk, milo, lipton tea, kings oil,
  quaker oat, cadbury chocolate, sugar dangote, custard vanilla,
  cheese balls, tuwo (correctly not in catalog, no AI call needed).
- AI passes (9): "indomie chiken 70g" -> Indomie 70g; "I wan buy garri"
  -> not in catalog (idea: Garri White 1kg); "gino tomatoes" -> Gino;
  "mcvities biscuits" -> McVitie's; "nasco cornflakes" -> NASCO;
  "coke" -> Coca-Cola; "groundnut" -> Demo Snacks Peanuts; "Abeg where
  I fit see rice?" -> Demo Pantry Rice; "paracetamol" -> not in catalog
  (idea: Paracetamol Tablets).
- No failures. Phrases and matching unchanged; nothing tuned.

## 9 November 2026 - Feature P acceptance criteria agreed (docs only)

- Owner set 10 acceptance criteria for Feature P (unmet-demand alerts)
  in BUILD_PLAN.md: daily aggregate by demand key and 2 km cell, distinct
  visitors only, validated idea keys, counts-only storage, 5-in-24h
  threshold, opted-in nearby traders, dashboard-first "Preview of a paid
  feature" label, optional Q-pipeline photo with consent and 7-day expiry
  (owner to confirm), per-shop on/off setting, tests plus checklist.
- Nothing built. Awaiting owner go-ahead.

## 9 November 2026 - Feature P built (unmet-demand alerts)

- Settings in web/src/lib/demand.ts (2 km cells, 5 km range as 9 cells,
  threshold 5, 7-day photos, 3 photos/visitor/day). Migration 008 adds
  demand_signals, demand_daily, demand_photos and shops.demand_alerts
  (default off). Additive; demo data untouched. Applies on restart.
- Counting is server-only: empty searches at 20 km count the product
  automatically; AI not-in-catalog ideas count only via a signed idea
  token. Ideas: lowercase, letters/numbers/spaces, 40 chars, no
  phone-like or offensive text, regulated refused. One count per
  visitor/key/cell/day (primary key). No coordinates or query text
  stored; 24h records purge lazily like the others.
- Alerts: opted-in shops, same/adjacent cells, unstocked products only,
  groups of 5+/24h only (SQL-enforced), one alert per key per day,
  "Preview of a paid feature" + "Simulated" labels, dashboard only.
- Simulated seed at boot (demo mode, idempotent): 8-visitor product
  with no stock in its cell, 6-visitor "toothpaste" idea, hidden
  3-group, one adjacent shop stocking the product (excluded).
- Buyer photo: consent text, browser resize + confirmed square crop,
  3/day + global image cap, Q checks, pending until threshold, one
  representative photo, 7-day max, lazy expiry, operator removal page.
- Readings disclosed to owner: (1) the demand cell holds no stock while
  the adjacent in-range shop stocks it; (2) 24h distinct-records follow
  the existing pattern with cell added; (3) pending photos held up to
  24h to allow joining, never shown; (4) single spaces allowed in ideas.
- Gates: npm test 101/101, lint 0 errors, build green. Owner restarts
  once for 008. No live AI calls made.

## 9 November 2026 - Photo product check widened to loose goods

- Shared image prompt now accepts packaged goods plus loose, bulk and
  measured market goods (garri, rice, beans, flour, spices, vegetables,
  fruit, oils/liquids in containers, bagged items). People/faces,
  documents, screenshots, text-only images, scenery, vehicles,
  buildings and inappropriate content still rejected. Medicines stay
  refused by the existing code rules. Same prompt serves trader
  add-by-photo and buyer demand photos.
- Loose goods propose name only (brand/size/unit null); trader picks
  the unit, size defaults to Standard. New rejection message guides a
  clearer retake. Buyer card disables Confirm after a rejection until a
  different photo is taken (shared signature guard, tested).
- Parked in BUILD_PLAN.md: units for loose goods (cup/derica, bag, kg,
  bunch, basket); stock counts whole units today, design decision
  needed before the pilot.
- Gates: npm test 104/104, lint 0 errors, build green. No restart
  needed. No live AI calls made.

## 9 November 2026 - Backed up next-phase to GitHub

- Owner approved push after pre-push checks: remote verified as the
  owner repo only, ignores verified, no secrets in tree or history,
  no local data tracked. Pushed next-phase (23 commits) to
  https://github.com/Joseph-Yahaya/Meta_market_assistant with
  git push -u origin next-phase, no force. Main untouched.

## 9 November 2026 - Loose-goods fix verified, backup confirmed

- The owner verified the loose-goods photo fix in the browser.
  Next-phase is backed up to the owner's GitHub repository.
