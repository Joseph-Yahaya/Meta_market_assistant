# Confirm scope and validate the starting assumptions

Status: Deferred by user on 3 November 2026; partially completed. Priority: Revisit at the relevant dependency. Dependencies: None.

## Outcome

A user-approved first release boundary, working access to required services, and a practical validation plan. This file owns scope decisions; other files reference them.

## Questions to ask the user

1. Hackathon demo first is confirmed. What team capacity is available?
2. The official event page and 5 November 2026 at 03:00 WAT deadline have been found (see verification notes). Were all team members selected, which track applies, and where are the participant submission instructions?
3. Next.js, PostgreSQL and Railway free-trial hosting are confirmed. Do you have an existing repository or Railway project? PostGIS availability needs checking.
4. You report access to all Meta Muse API models. What credits or spending cap apply? Configure the API key locally, without posting it in chat or planning files, for an authenticated smoke test.
5. A web logging screen is confirmed as the first trader channel, supporting text and then browser-recorded voice. Messaging delivery is deferred.
6. Confirmed: Kubwa, packaged provision-shop goods, English/Pidgin inputs, with photo search and route drawing deferred. Pidgin voice accuracy still needs a real test.
7. The project name is confirmed as AI Market Assistant. Who can approve decisions, and are there existing trader interviews or partners?

## Tasks

- [x] Inspect existing assets and record what is reusable. See the asset audit below.
- [ ] Confirm the official competition selection, team, track, originality/prior-work rules, model requirements, deadline in WAT and deliverables. Record official links and verification dates.
- [ ] Verify provider model names, endpoints, supported inputs/languages, quotas, cost and access. Make a small successful call before depending on each required integration.
- [ ] Test representative Nigerian English and Pidgin recordings; document failures and the chosen fallback.
- [ ] Confirm stack, channel, hosting budget, core journey and optional features. Resolve the document's routing scope conflict.
- [ ] Agree a short demo acceptance script: log sale, receive confirmation, observe stock change in buyer results, obtain expiry suggestion.
- [ ] Define activation, daily logging, stock accuracy and search-to-visit measures with explicit numerators, denominators and collection methods.
- [ ] Plan interviews with 20–30 traders and buyer conversations. Ask about recent stock-outs, records, losses, pricing, credit, past app use and a concrete payment commitment; do not record hypothetical willingness as proven demand.
- [ ] Observe busy-hour logging, phone access, restocking and lost sales. Consult associations, suppliers and other stakeholders about trust and adoption barriers.
- [ ] Decide whether the proposed 10-trader, three-week WhatsApp/spreadsheet test should precede application rollout.
- [ ] Record confirmed requirements, assumptions still to test, exclusions, time budget and owners in the decision log.

## Completion criteria

- [ ] Required model access is demonstrated, or the user has approved an achievable revised scope.
- [ ] The first release, deadline, budget, channel and responsibilities are explicit.
- [ ] Validation has a named owner and schedule; research not yet performed remains visibly pending.

## Decision log

- 3 November 2026 — User confirmed Next.js for frontend and backend. Use one Next.js application. Database, hosting and supporting services remain to be confirmed. Add further dated answers and verification links here.
- 3 November 2026 — User named the project AI Market Assistant and asked to start this task in VS Code. Created a named workspace in the existing project folder so all seven planning files remain together.
- 3 November 2026 — User confirmed hackathon demo first, PostgreSQL, Railway free trial and web trader logging first; reports Meta provided access to all Muse API models. No additional paid budget was authorized.
- 3 November 2026 — User accepted Kubwa, packaged provision goods and English/Pidgin input as demo scope, deferring photo search and route drawing. Voice quality remains subject to real recording tests.

## Official source checks on 3 November 2026

- [Meta hackathon](https://dev.meta.ai/events/global-hackathon) and [organizer event](https://cerebralvalley.ai/e/meta-ai-developer-hackathon): deadline is 4 November 2026 at 21:00 Eastern, equivalent to **5 November 2026 at 03:00 WAT**. This corrects the source plan. Indie and startup tracks exist; track, team acceptance, prior-work rules and exact submission assets are not established by the available public overview. Obtain the participant rules before finalizing those items.
- [Meta API overview](https://dev.meta.ai/docs/overview) and [quickstart](https://dev.meta.ai/docs/quickstart): base URL `https://api.meta.ai/v1`, bearer secret `MODEL_API_KEY`, documented text model `muse-spark-1.3`, and `POST /v1/responses`. Use server-side requests; user-reported access is not yet an authenticated successful call.
- [Speech guide](https://dev.meta.ai/docs/speech-to-text): model `muse-voice-transcribe-1.0`, file-upload endpoint `POST https://api.meta.ai/v1/asr/transcribe`. English is supported; Nigerian Pidgin is not separately listed. It supplies no transcription confidence scores, so do not invent them. Test local speech and use trader confirmation/text fallback.
- [Pricing and limits](https://dev.meta.ai/docs/pricing-rate-limits): consult published rates and actual account credits before load tests. Account-specific entitlements, rate limits and credit balance remain unverified; no successful paid API call has been made.
- [Railway Next.js guide](https://railway.com/guides/nextjs) supports the chosen full-stack architecture and PostgreSQL connection. [PostgreSQL documentation](https://docs.railway.com/databases/postgresql) points to separate extension templates; do not assume a default database includes PostGIS.
- [Railway trial](https://docs.railway.com/pricing/free-trial) currently offers a one-time $5 grant for up to 30 days, with resource and possible outbound-network restrictions. Check the user's actual account before relying on hosted Meta calls. Do not upgrade automatically.
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) lists Node.js 20.9 or later; the inspected local Node.js version meets that stated minimum. A working install/build is still a separate check.

## Asset audit completed on 3 November 2026

- Available project assets: AGENTS.md and six task files based on the supplied Word plan. No application source, package manifest, design assets, dependency installation or local Git repository exists in this folder at the time of inspection.
- Available development tools: Node.js v24.18.1, npm 11.16.0, Git 2.54.0 and the VS Code command-line launcher. These checks establish tool availability, not compatibility with a Next.js version that has not yet been selected.
- Reusable requirements: canonical products, append-only stock events, estimated stock confidence, nearby discovery, trader confirmation and simulated demo fixtures.
- Added project setup: `AI Market Assistant.code-workspace` and `.gitignore` for generated output, dependencies and local secrets. No paid services or external integrations configured.
- The source's model names, API access, competition rules/deadline, adoption assumptions and pricing remain unverified. No real trader interviews or AI calls have been performed.

## Proposed acceptance script awaiting user agreement

1. Reset to a reproducible, visibly simulated dataset with a known opening stock balance.
2. An authorized trader submits a supported sale by text and, when model access is available, voice.
3. The application asks for clarification if the item or quantity is ambiguous. A confirmed sale records exactly one event, including when the request is retried.
4. The trader sees a confirmation and the resulting estimated balance.
5. A buyer searching for the same product sees the changed availability without reloading; an item reduced to zero disappears from eligible results.
6. A remaining batch near expiry produces a grounded clearance suggestion, without automatically changing prices.
7. An unavailable model or connection produces a clear recoverable state without false write confirmations.

## Proposed measurement definitions awaiting user agreement

| Measure | Definition | Collection method |
| --- | --- | --- |
| Trader activation | Shops completing onboarding, opening stock and one confirmed sale within seven days / eligible shops onboarded in that cohort | Onboarding and stock event timestamps |
| Daily logging | Activated shops recording at least one sale on a trading day / activated shops expected to trade that day | Sale events and agreed trading schedules; this does not prove every sale was logged |
| Stock accuracy | Shop-product recounts whose previous estimate equals the physical count / all completed recounts | Store the pre-recount estimate, physical count and correction delta; also report absolute unit error |
| Fresh inventory coverage | Publicly eligible shop-product listings satisfying the agreed freshness/confidence rule / all otherwise eligible positive-stock listings | Inventory and confirmation records, without retaining buyer movements |
| Search-to-visit | Distinct search sessions with a reported shop visit linked to a result / distinct search sessions with at least one eligible result | Minimal session/result identifiers and voluntary feedback; reported visits are not independently verified purchases |

Thresholds, session retention and research targets require agreement before these become release gates. Simulated results must be reported separately from pilot results.

## Proposed field research plan awaiting owner and dates

- Interview 20–30 traders in one confirmed market, varying shop category, staffing and current record-keeping method. Start with five interviews to improve the questions before continuing.
- Ask about the last stock-out, the records actually used, recent expiry losses, restocking, past app use and time available during a busy hour. Seek a concrete trial/payment commitment only with an agreed offer.
- Speak with buyers about a recent unsuccessful search, how they located shops, trust in availability and willingness to report a visit. Buyer sample size remains to be agreed.
- Observe logging and restocking with permission. Collect only information needed for the study; agree consent, storage and retention before recording identifiable responses.
- Summarize patterns and contrary evidence without claiming the sample proves market-wide demand. Revisit the scope after the first five trader interviews.
- Decide whether a 10-trader, three-week concierge test should precede a real application pilot. No interviews, outreach or pilot recruitment have occurred yet.

## Progress and blockers

User instruction on 3 November 2026: leave the remaining checks for now and proceed to task 02. Do not mark this task complete. Remind the user before an action depends on an unresolved check, using the reminder table in AGENTS.md. Continue independent local implementation and synthetic tests in the meantime.

Completed: local asset/tool audit, named VS Code workspace, secret/output ignore rules, confirmed framework and project-name decisions. Drafted acceptance, measurement and research proposals above; their agreement checkboxes remain unchecked.

Recorded: demo goal, framework, database, host, starting channel, area, product category and deferred features. Found official event and API references above. Generated a Next.js App Router/TypeScript project in `web/`, with the project name, a clearly labelled setup screen, standalone build configuration, an environment example and VS Code run tasks. Dependencies installed successfully; ESLint and the production build passed on 3 November 2026. This is a working starter, not the inventory/discovery implementation.

Dependency check: `npm audit --omit=dev --json` reported zero production vulnerabilities on 3 November 2026. Installation reported 16 moderate advisories across development dependencies; review/remediate those before broadening use. No automatic breaking dependency upgrades were made.

Remaining: team/track/participant rules, credit balance, authenticated model smoke test, speech samples, Railway account connectivity, approval of acceptance/metric definitions and later research ownership. Task 01 remains deferred by user; the competition/provider checkboxes include unresolved account-specific work and stay unchecked.

## Local setup and Meta check

Update, 3 November 2026: user saved `MODEL_API_KEY` privately and explicitly confirmed available hackathon credits and authorization for the small live test. Key presence and Git exclusion were checked without displaying its value. `npm run check:meta` passed with `muse-spark-1.3` against Meta's `/v1/responses` endpoint after retrying with network access. The first restricted-network attempt could not connect. This verifies authenticated text access only; structured stock extraction, voice accuracy, remaining credit balance and other model access are not established. `ENABLE_META_CALLS` remains false pending application-level checks. No key or full provider response was recorded. Earlier missing-access notes below describe prior checks.

1. Open `AI Market Assistant.code-workspace` in VS Code. Application commands run from `web/`.
2. Install dependencies with `npm install` if not already installed; start with `npm run dev` and visit `http://localhost:3000`.
3. Copy `web/.env.example` to `web/.env.local`. Fill in `MODEL_API_KEY` locally and `DATABASE_URL` when the database exists. Neither value belongs in chat or version control. Keep the key server-side.
4. From `web/`, run `npm run check:meta` to make one small text-model request. This uses Meta account credits. Record only pass/fail and date here; never paste the key or full provider response.
5. The script's syntax was checked. Its unconfigured run correctly stopped with a missing-key message; **no authenticated request was made**. A passing text check does not establish voice accuracy or stock-extraction correctness.

VS Code also provides named tasks to start development and check the Meta connection. No Railway service or PostgreSQL database has been provisioned yet.

Local runtime check on 3 November 2026: development server started at http://127.0.0.1:3000; HTTP 200 confirmed with the project title and setup status. The local starter was left running.
