# BUILD_PLAN.md: AI Market Assistant, build mode

This file replaces `MUSE_CODE_HANDOFF_SUBMISSION_SPEC.md` as the guide for new sessions. That older file was written for the hackathon night and contains a deadline, a "cut line" and "P0 before recording" instructions. **Ignore those.** Read this file first, then `AGENTS.md` and the six `*.todo.md` files.

## 1. Where things stand (5 November 2026)

- The hackathon entry was **submitted by a teammate** from their own repository and deployment (Startup track, "Build for Your World"). That submission and its live website are **not connected to this folder** and are not owned by this machine. Nothing done here can change them.
- **This folder is the owner's own clone** of that code. It is separate and not connected to any hosting. **No Railway or other hosting account exists for it yet.** All building and testing happens locally on this computer; the owner pushes to their **own** GitHub repository when the work is ready.
- **Check the remote first:** run `git remote -v`. It must point to the owner's own GitHub repository. If it points to the teammate's repository, stop and tell the owner before any commit or push, so the teammate's submission is never changed by accident.
- **Branch:** work on `next-phase` and merge into the owner's own `main` when checks pass. Check with `git branch` at the start of every session.
- **Unfinished local changes** (uncommitted when this plan was written): daily model-call caps (`web/src/lib/model-limits.ts`, changes in `web/src/server/accounts.ts`, the three model routes), the trader "How this was processed" panel (`web/src/app/trader-workspace.tsx`), model names on `/api/status`, `web/scripts/check-voice.mjs` and `.env.example` additions. There is also one local commit that only changes `README.md`.
- **Latest checks** (Node 26.13.0 and npm 11.20.0 installed): build passes; lint has 0 errors and 1 warning (unused `wav` in `check-voice.mjs`); tests 41 pass, **1 fails**: `daily caps reject invalid env values` (`tests/model-limits.test.mjs` line 16 expects 100, gets 1). One test output line says `Meta provider request failed: HTTP 429`; confirm it is a mocked failure, not a real call.
- **Verified working (owner tested the teammate's deployed version):** English voice for trader and buyer, Muse Spark interpretation, confirm-then-write stock changes, buyer search. These have not been verified on this clone.
- **Not built:** WhatsApp or any message delivery, demand-spike insights, weekly/monthly ledgers, Pidgin/Yoruba/Igbo/Hausa support, photo search, road routes, loan or fraud features.
- **Running locally:** tests use an in-memory PGlite database and the app has a development-only isolated PGlite adapter, so no hosted database is needed. Live Meta calls need the owner's own `MODEL_API_KEY` in `web/.env.local` (never committed). Ask before the first live call.

## 2. Product

Lead with the trader's real problem: **finding customers**. Inventory logging is the cost of entry, and discoverability is the value. Kubwa, packaged provision-shop goods, **all demo data simulated and labelled as such**.

Stack: Next.js (App Router, TypeScript) for frontend and backend, PostgreSQL (the submitted version used Railway; this clone has no hosting yet), Meta Model API (`https://api.meta.ai/v1`): `muse-spark-1.3` via `/v1/responses` and `muse-voice-transcribe-1.0` via `/v1/asr/transcribe`. Stock is an append-only event ledger; stock quantity and confidence are derived. Existing migrations are `001` to `006`; **the next is `007`**. Never edit an applied migration.

## 3. Rules (non-negotiable)

1. Work on `next-phase`. Push only to the owner's **own** GitHub repository (verify with `git remote -v`) and never to the teammate's repository. Never deploy or create hosting accounts or services without the owner's explicit confirmation in that session.
2. Never show, print or commit secrets (`MODEL_API_KEY`, session secrets, access codes, database URLs, WhatsApp tokens). Keep them server-side.
3. Model output is untrusted input. Validate structure, product match, quantities and permissions. The trader confirms every interpreted stock entry. Never present a mock, preview or failed call as a working integration. Never claim language support that has not been measured.
4. Keep the privacy design: no raw buyer query text or coordinates stored, owner-only private stock, no phone numbers in buyer endpoints, logs or the repo.
5. One feature at a time. Before moving on: tests pass, lint passes, `npm run build` passes, and the evidence is recorded in the matching todo file. Keep checkboxes honest.
6. Do not claim anything is verified on the live site, on a phone or with real PostgreSQL concurrency unless that was actually done.
7. Anything that sends a real message, spends meaningful Meta credits or needs an owner account (Meta developer app, WhatsApp test number) is the owner's step. Ask and wait.

## 4. Session start routine

1. Read this file, `AGENTS.md`, the todo files and `SESSION_NOTES.md` (if present).
2. Run `git remote -v`, `git branch` and `git status`.
3. Run `npm test`, `npm run lint` and `npm run build` inside `web/`.
4. Report the results and the next task. Wait for "go" before starting a feature.
5. At the end of every session, update `SESSION_NOTES.md`: what changed, check results, what is next, open questions.

## 5. Step 0: stabilise what exists

- Decide whether the code or the test is wrong for `daily caps reject invalid env values`. An invalid value such as `100abc`, `0`, a negative number or empty text must fall back to the default or be rejected, **never** become a tiny limit like 1. Fix and add test cases for those inputs.
- Remove the unused `wav` variable. Confirm the 429 line is mocked.
- Run the three checks. Commit the daily caps and the processing panel to `next-phase` as separate, clearly named commits.
- Run the app locally (`npm run dev`) with the existing isolated local database setup and check the trader and buyer screens in a browser before anything else.

## 6. Features, in build order

For each: build, test, lint, build, record evidence, then stop and report.

Agreed build order (owner, 7 November 2026): R part one, then the key and image test, then Q, N, O, P, then R part two. R part one is the client-side location work with straight-line distance; R part two is the provider comparison and choice plus server-side road distance/time and the route line. The key and image test is a gate, not a feature: using the owner's own Meta key, one small live check that calls work and whether image input is accepted; its result decides N's photo-first vs voice-naming path before Q and N are built.

### Feature A: simulated demand spike and trader insight
- Migration `007`: `demand_daily(product_id, area_cell, day, distinct_sessions, simulated boolean)`. Counts only; no identifiers. Do not weaken the existing 24-hour retention of raw search records.
- Real searches increment it by distinct session. Seeded rows are always `simulated = true`.
- Seed (fixed seed): 14 days of baseline demand across products and the demo areas; a planted spike (for example Cheese balls 50g in Kubwa east, about 18 distinct sessions in the last 24 hours against a baseline near 2; add the product to the canonical catalog if absent); a planted sub-threshold case (3 sessions) that must be suppressed; at least one shop with zero or low stock near the spike that receives the insight and one with healthy stock that does not.
- Rule (proposal, owner to confirm): trigger when distinct sessions in the last 24 hours are at least 5 and at least 3 times the previous 7-day daily mean (floor the mean at 1). Never show groups below the minimum.
- Show it in the trader dashboard under a clearly labelled **"Simulated demand"** section. Include an unmet-demand variant when no shop within 5 km shows stock.
- Acceptance: tests for threshold boundaries, suppression, stable repeat reads and owner isolation; the planted spike appears for the right shop and not the wrong one.

### Feature B: notification outbox and message previews
- Migration `008`: `notification_outbox` with idempotency key on (shop, kind, period or entity, channel), status (`preview`, `queued`, `sent`, `failed`, `suppressed`), rendered body, provider message id and error summary.
- Migration `009`: trader contact and consent (E.164 phone, explicit opt-in text, opt-out, per-kind toggles, quiet hours default 21:00 to 07:00 WAT, timestamps). No real phone numbers in seed data. Phone numbers are private.
- Render daily report, low-stock, expiry alert and demand insight into short plain-text messages (Naira formatting, WAT dates) and show them in-app as **"WhatsApp message preview. Not sent."**
- Acceptance: deduplication, opt-out, quiet hours and repeat-render tests.

### Feature C: reports and ledger
- Owner-only reports for daily, weekly and monthly periods from `stock_events` and the seeded history: recorded sales (units and recorded revenue), restocks, estimated closing stock, pending recounts, alerts, top sellers. Label revenue as **recorded revenue, not profit**. A CSV download for the weekly and monthly ledger.
- This is a trader record only. No credit or loan claims.
- Acceptance: totals reconcile to the ledger for several periods; WAT boundaries tested.

### Feature D: real WhatsApp sending (owner must set up first)
- Owner creates the Meta developer app and a WhatsApp Business test number, adds their own phone as a verified recipient, and sets tokens privately in `web/.env.local` and later the variables of whichever hosting service the owner chooses.
- Implement a server-side sender through the WhatsApp Business Cloud API. **Verify current rules in the official documentation before coding:** opt-in requirements, the 24-hour customer-service window after the user messages the business number, approved templates for business-initiated messages, test recipient limits and pricing.
- Send only to numbers the owner explicitly verified. Record a message as `sent` only when the provider accepts it. Handle failure, retries with backoff and `STOP` opt-out if webhooks are available.
- A protected scheduled endpoint (secret header) for later; a manual "Send now" for testing.
- Acceptance: one real message to the owner's verified phone with a provider id recorded. Preview mode must keep working if credentials are missing.

### Feature E: languages
- Add `web/scripts/check-languages.mjs` and fixtures with at least 6 phrases for each of English, Pidgin, Yoruba, Igbo and Hausa covering sale, restock, missing quantity, a 9-versus-90 ambiguity, two products in one sentence and a prompt-injection attempt.
- Starter phrases (a native speaker must verify): Pidgin "I don sell three Indomie"; Yoruba "Mo ta Indomie mẹta"; Igbo "Ere m Indomie atọ"; Hausa "Na sayar da Indomie guda uku". Add the restock equivalents.
- Test text extraction first, then voice with native-speaker recordings. Record per-language pass rates. Enable a language in the UI only if it passes the agreed threshold (owner to set it). The confirmation step stays the safety net.
- The provider documents English speech support; Pidgin and the three languages are not separately listed. Report measured results only.

### Feature F: real-trader readiness (before any real data)
- Real identity and account recovery, consent and retention decisions, public field decisions, verified shop pins, stronger anonymous-abuse controls, backup and restore tested on a separate database, multi-connection concurrency tests, development dependency advisories reviewed.
- Interviews with 20 to 30 traders and a small pilot of 10 to 30 shops in one market only after these gates and the owner's approval. Do not launch public buyer discovery until enough shops have fresh stock in one area.

### Feature G: grounded clearance and restock suggestions (Muse Spark)
- For near-expiry or slow-moving batches, Spark writes a short, friendly suggestion using **only facts computed by code** (product, remaining units, days to expiry, nearby unmet demand). Discount ideas are suggestions the trader approves; the app never changes prices by itself.
- Code decides **whether** to alert (existing deterministic rules); Spark only words it. If the model fails or returns invalid output, show the deterministic text. Never suggest selling expired goods, never invent demand or margins, and keep pharmacy or regulated-category restrictions in code.
- Acceptance: tests for invalid model output, expired and depleted stock, missing dates and fallback text.

### Feature H: photo search (verify first)
- First make one small test call to confirm the provider actually supports image input and what it returns (check the documentation; SAM 3.1 and the vision capability of Muse Spark are unverified). If unsupported, leave this feature on the roadmap and say so.
- Packaged goods only. Show candidate products (with confidence only if the provider supplies one), and require the buyer to confirm the exact variant before the inventory lookup. Do not store images. Do not claim hardware (screws, bolts) identification.

### Feature I: road routes (replaced by Feature R)
- **Replaced by Feature R on 7 November 2026 (owner request). Kept for history; do not build.**
- Verify OpenStreetMap coverage around Kubwa and the routing service's terms. Draw a route from the buyer's pin to the chosen shop. Keep straight-line distance and the landmark as the fallback, and never use a public demo routing server for real traffic.

### Feature J: sales anomaly flags (private, rules-based)
- Flag, for the owner only, patterns such as sales that stock could not support, repeated round numbers, unusual hours and sales with no restock history. Reuse the existing synthetic planted case for tests. Flags are prompts to check, not accusations, and are never used for credit decisions. Document false-positive rates before relying on them.

### Feature K: price transparency (opt-in)
- Prices stay hidden from buyers by default (current behaviour). Add a trader opt-in to share a price band, with plain-language consent text. Aggregated benchmarking only with opt-in and a minimum group size. No price-fixing or enforcement.

### Feature L: messaging-first logging and recount prompts (after D)
- Let a trader log a sale by sending a voice note or text to the business WhatsApp number, with the same interpret, review and confirm flow and a confirmation reply. Verify the sender's number against their shop. Add a weekly recount prompt ("Still 4 Indomie? Reply YES or the right number"). Needs the 24-hour window and webhook handling to be checked in the official documentation first.

### Feature M: interface language
- A language selector and translated interface text, enabled only for languages that pass Feature E, with strings reviewed by native speakers.

### Feature N: trader-added products (photo-first, no typing)
- Traders can add products outside the fixed catalog. If nothing matches, the trader photographs the product: one required photo, optional guided extra angles.
- The key and image test verifies whether the Meta API accepts images before building; if not, fall back to voice naming plus picture-based units. Barcode scanning is deferred (owner decision, 7 November 2026).
- The AI proposes name, brand, size, unit and category; the trader confirms with large yes/no buttons and picture-based unit choices, with no typing.
- New products are auto-checked and usable by the shop immediately; anything flagged goes to the owner for review, and products are visible to buyers only after validation: length limits, duplicate check, rate limits, safety checks, injection-safe handling. Category and regulated-goods rules stay in code. In-scope categories now include household and personal care; medicines and regulated goods are excluded (owner decision, 7 November 2026). Store cropped trader product photos.
- Acceptance: to be agreed with the owner before building.

### Feature O: smarter buyer search
- Remove the radius selector. The AI interprets typed or spoken queries and maps them to a catalog product or a "not yet in catalog" idea.
- Distance ranking stays deterministic. Start at 5 km and widen automatically to 10 and 20 km with a clear message.
- Acceptance: to be agreed with the owner before building.

### Feature P: unmet-demand alerts
- When a search finds nothing after widening, increment a daily aggregate by product key and coarse area cell, distinct sessions only.
- When distinct sessions reach the confirmed minimum of 5 distinct searchers in 24 hours (owner decision, 7 November 2026), notify opted-in nearby traders who do not stock it.
- Optionally prompt the buyer for a photo: strip image metadata, show only a cropped product image, require consent text. Buyer photos are stored only if included in an alert and only briefly, and shown to traders only after the minimum is reached (owner decision, 7 November 2026).
- Aggregate and anonymous; seed simulated demand and label it simulated. Paid-tier gating is a label only for now.
- Acceptance: to be agreed with the owner before building.

### Feature Q: shared image pipeline
- One pipeline built before the photo parts of N, H and P: type and size validation, metadata stripping, resizing, safety check, AI call, storage decision. Storage rule (owner decision, 7 November 2026): store cropped trader product photos; buyer photos only if included in an alert and only briefly.
- Acceptance: to be agreed with the owner before building.

### Feature R: location and routing (replaces Feature I)
- Part one (build first): buyers get "Use my location" plus a draggable pin and area/landmark fallback. No typed coordinates for normal users; no raw coordinates stored. Traders set their shop pin at sign-up by tapping "Set my shop location here". A "Get directions" button opens the buyer's own maps app. Straight-line distance and the landmark stay as the measure and fallback.
- Part two (after P): the provider comparison and choice, then server-side road distance and time for the 5 nearest shops only, with caching, rate limits, a notice that location is sent to the provider, and straight-line distance as the fallback. A route line on the map.
- Provider test (owner decision, 7 November 2026): compare OpenRouteService and Mapbox on at least 10 real Kubwa trips, walking and driving. Default mode walking, driving optional. Choose only after the comparison.
- Acceptance (part one): the buyer can share device location, drag the pin, or use the area/landmark fallback, with no typed coordinates for normal users; no raw buyer coordinates are stored (verified by tests); the trader sets the shop pin at sign-up with one tap; "Get directions" opens the buyer's own maps app for the chosen shop; straight-line distance and landmark remain visible throughout; automated tests pass and the owner's manual browser checklist passes.

## 7. Later, not now (parked ideas, so they are not forgotten)

These were discussed and **deliberately left out of the current build**. Do not start them until the unlock condition is met and the owner says go.

| Idea | What it is | Why it is parked | Unlock condition |
| --- | --- | --- | --- |
| Paid insight tiers | Traders pay for search-spike alerts, unmet-demand alerts and "trending in your area" insights | Needs real buyer volume and proof traders will pay | Real searches from a pilot area; willingness-to-pay test with a concrete payment commitment; agreed minimum-group privacy rule |
| Promotions and paid ads | Traders pay to promote an item | Must never silently change search ranking; needs trust first | Pilot running, ranking policy written and approved by the owner |
| Loan referral from the ledger | A trader's sales ledger helps them apply for a loan | Lending and credit scoring need a licensed partner and verified data; self-reported cash sales are weak evidence | A CBN-licensed lender or partner agreement; verified payment or purchase data; consent text reviewed by a qualified adviser |
| Production-grade fraud detection | Stronger fake-sale detection than the rules in Feature J | Needs real data to tune and measure | Months of real ledger data; documented false-positive rates |
| Hosting for this clone | A live site for the owner's own version | No hosting exists yet; cost and account decisions are the owner's | Owner chooses a host (Railway is one option), sets a budget, creates the account and a private database; then deploy from the owner's own repo only |
| Staff accounts and multi-shop owners | More than one person logs for a shop, or one owner has several shops | Current rule is one owner per shop | Real traders ask for it in the pilot; identity rules agreed |
| Real shop verification | Verified shop pins and identity before public listing | Demo pins are illustrative | Part of Feature F, before any real data |
| Telegram or SMS delivery | Messaging fallbacks when WhatsApp is not suitable | WhatsApp comes first; avoid extra channels | After Feature D works and traders say what they prefer |
| Market association partnerships | Endorsement from market associations and unions | Needs field work and trust, not code | During trader interviews and the pilot |
| Cost and profit tracking | Purchase cost per item so the ledger can show profit | Schema holds no cost data; recorded revenue is not profit | Owner decides to add cost entry; traders willing to log it |
| Self-hosted open-weight models | Run Meta open-weight models to lower per-call cost | Only worth it at volume | Usage and cost data show it is needed |
| Nigerian-language voice at scale | Dependable Yoruba, Igbo and Hausa voice | Provider support unverified | Feature E measured results meet the owner's threshold |

Also keep in mind: the original problem statement (price imbalance and exploitation) is a long-term goal. The product starts with traders being found by customers, because that is what traders asked for.

## 8. Decisions the owner still needs to make
- Spike thresholds and minimum group size (proposal above).
- Quiet hours and notification limits.
- Language pass threshold.
- Where to host this clone later (it has no hosting yet) and whether to share improvements with the teammate who owns the submitted repository.
- Whether the owner has their own Meta API key for local live model calls.
- Daily caps per account and overall (current defaults: interpret 100, transcribe 50, buyer voice 20, global 500).

## 9. How to build each feature (working method)

1. **One feature per session slice.** Start with "go on Feature X", never a list.
2. **Plan first.** Muse restates the acceptance criteria, lists the files it will touch, and asks about anything unclear. The owner replies "go".
3. **Build small.** Migrations first, then server logic, then screens. Add tests with the code, not afterwards.
4. **Run the three checks** (`npm test`, `npm run lint`, `npm run build`) and report the real output.
5. **Look at it in a browser** with `npm run dev` and the isolated local database. The owner checks it by hand using the acceptance list.
6. **Record evidence** in the matching todo file and `SESSION_NOTES.md`; tick boxes only with evidence.
7. **Commit** on `next-phase` with a clear message, one feature per commit. Push to the owner's own repository when the owner says so.

Owner-only steps: the Meta developer app and WhatsApp test number (D, L), native-speaker review and recordings (E, M), decisions in section 8, and approving each push.

Dependencies: A before B; B before C and D; D before L; E before M; O before P; Q before the photo parts of N, H and P; G, H, J, K, N and R are independent, but H needs a quick verification test before any build, and R part two needs the provider comparison before choosing one. Feature I is replaced by R.

