# Verify the demo and prepare a responsible pilot

Status: In progress — local release checks and deployment preparation. Not deployed, submitted or approved for real-data pilot. Priority: Required release work, then staged rollout. Dependencies: Core outcomes in tasks 01–05.

## Outcome

A reproducible, tested demonstration with accurate submission materials, followed by an evidence-led pilot and explicit gates for public discovery and later monetization.

## Questions to ask the user

1. What are the confirmed submission deadline, repository visibility, required video length and official deliverables from task 01?
2. Who owns deployment, testing, the pitch, field onboarding and ongoing support? What hosting and acquisition budget is available?
3. Which data promises can the business commit to, who can see trader records, and who will review consent, retention and applicable Nigerian compliance obligations?
4. Should the initial 10–30-shop pilot be private while building toward the source's 50–100 fresh shops for public discovery, or should another evidence-based gate apply?
5. What measurable logging rate, stock accuracy, freshness, visits and retention would justify expansion? What would trigger a pause?
6. Are subscriptions, paid insights and finance deferred until the relevant pilot evidence and partnerships exist?

## Demo and release tasks

- [ ] Run the complete journey: trader voice note → validated event → confirmation → changed buyer result → expiry suggestion.
- [ ] Verify authorization, duplicate handling, recount math, weak-network behavior, stale-stock suppression, feedback and provider-failure fallbacks.
- [ ] Demonstrate the planted invalid-sales case through its isolated fixture; describe it as a known synthetic case, not proof of production fraud detection.
- [ ] Label all simulated shops, stock, prices, sales and demand in the interface, recording and write-up.
- [ ] Prepare deployment for the full-stack Next.js application, including server-side model calls and webhooks, secret handling, database migrations, health checks, basic monitoring and a reset procedure. Verify hosting support for live updates and scheduled jobs. Keep a known-good demo dataset.
- [ ] Rehearse a roughly three-minute demo and the proposed five-minute pitch, adjusting to verified rules. Cover the screw story, discoverability, actual model roles, trust commitments, roadmap and the proposed Kubwa pilot ask.
- [ ] Prepare the required repository, setup instructions, architecture explanation, limitations, model usage evidence, video and write-up. Check licenses and originality disclosures.
- [ ] Test shared links and access from a clean browser/device. Reserve a submission buffer and a labelled recording fallback.
- [ ] Submit only after checking the actual requirements and user authorization for that external action; retain the receipt. Do not mark submission complete merely because materials are ready.

## Real pilot and trust tasks

- [ ] Complete or schedule task 01's interviews and concierge test; incorporate evidence into onboarding and scope.
- [ ] Prepare plain-language consent, messaging opt-in, private/public field explanations and separate secondary-use choices. Make price benchmarking optional.
- [ ] Have an appropriate adviser assess applicable Nigerian data protection, registration and sector obligations before real-data launch. Record official references and advice rather than treating the source's legal summary as verified guidance.
- [ ] Confirm policies on data sale, aggregate analytics, exports, deletion, association/authority access and legally required disclosures; implement the agreed controls.
- [ ] Establish support, corrections, shop-location verification, access recovery, retention/deletion, backup restore and incident response processes.
- [ ] Run the approved private pilot in one market; track daily logging, recount accuracy, freshness, workload and trust concerns.
- [ ] Open public discovery only after the agreed shop density, freshness and reliability gates are met. Resolve the 10–30 versus 50–100 shop mismatch explicitly.
- [ ] Measure searches that lead to visits with clear evidence limits, plus activation, conversion and churn. Replace illustrative CAC/LTV inputs with actual cohort data before asserting viability.
- [ ] Reassess field-agent cost, referrals, association onboarding, subscription pricing and any promotion/lead fees with real commitments, not only interviews.

## Future finance gate

- [ ] Before any finance feature, agree a licensed partner, lawful data use and verification sources such as payments or supplier purchases.
- [ ] Treat self-reported sales as weak evidence; assess gaming and adoption bias. Keep fraud checks and verified-sales measures separate from credit decisions.
- [ ] Do not launch lending, credit scoring or loan referral data sharing without the required partner, review and user-approved scope.

## Completion criteria

- [ ] Demo acceptance checks pass and required materials are ready; actual submission has separate evidence.
- [ ] Pilot completion requires measured results and a documented expand/pause decision; a finished demo does not satisfy it.
- [ ] Public discovery, paid insights and finance each retain their own explicit release gates.

## Decision log

- 3 November 2026 — Hackathon demo first; Next.js and PostgreSQL on Railway free trial. Official event page checked: https://dev.meta.ai/events/global-hackathon. Submission is listed as 4 November 2026 at 21:00 ET, which is 5 November 2026 at 03:00 WAT, replacing the source plan's unverified time. Track, team and exact submission requirements still need confirmation.
- 3 November 2026 — User confirmed Startup track and will handle the pitch. Requested GitHub push, clone into Muse and use of the required new Meta LLM. Repository destination/visibility, exact model requirement and Muse environment are being clarified. Preparing files is not publication or proof of model usage.
- 3 November 2026 — User approved the local acceptance checklist below, with live voice pending until Meta access is tested. This approves a text-first local acceptance scope; the user's subsequent Meta-model requirement still must pass before the final AI/competition demonstration.

## Progress and blockers

Local release runner: `cd web` then `npm run check:local-release`, with the development server on 127.0.0.1:3000, isolated local database enabled and Meta disabled. It refuses non-local configuration and creates only fictional test records. Latest run passed; evidence `web/.local-run/task06-flows.log`. It covers signup/login, owner isolation, review/confirmation, retries, recount math, oversell blocking, anonymous buyer search, polling-token reuse, feedback, sold-out visibility, alerts, persistent settings and weekly shop-open deduplication. This is not a physical weak-network test or live PostgreSQL concurrency test.

Prepared artifacts:
- `web/README.md`: reproducible setup, architecture, limitations, Meta/Muse handoff, recovery, deployment and attribution notes.
- `web/Dockerfile`, `web/.dockerignore`, `web/railway.json`: non-root standalone production server, no environment/local-data build context, pre-deploy migrations and readiness path. Docker execution and actual Railway provisioning remain unverified.
- `GET /api/health`: configuration/database/latest-schema readiness, no-store response, generic 503 without connection details. `/api/status` reports configuration only and is not readiness evidence.
- `web/scripts/check-local-release.mjs`: one repeatable local flow command. Full unit tests remain a separate `npm test` check.

### Approved local acceptance checklist

| Check | Evidence/status |
| --- | --- |
| Fictional trader signup, login, logout and owner isolation | Passed local release runner |
| Review before stock write; replay does not duplicate | Passed local release runner |
| Recount reconciles stock; stale review rejected | Passed local release runner |
| Overselling blocked, no partial write | Passed local release runner |
| Buyer browses without account; private fields hidden | Passed local release runner |
| Search/poll shows updated stock; sold-out shop disappears | Passed API flow; browser polling observed in task 04 |
| Feedback deduplicated, session bound, cannot change stock | Passed local release runner |
| Relevant expiry and low-stock alerts | Passed API flow and task 05 browser fixture |
| Weekly shop opens deduplicated and accurately labelled | Passed API/SQL checks; partial initial week visible |
| Phone-sized layout | Passed viewport checks in tasks 04/05; physical phone pending |
| Weak network/offline and reconnection | UI handling exists; controlled browser/device test pending |
| Meta extraction and English/Pidgin voice | Pending authenticated access, credits, required model and representative tests |
| Real PostgreSQL independent-connection concurrency | Pending task 02 live database gate |
| Hosted demo, backups/restore and clean-device shared links | Pending deployment gate |

### Proposed rehearsal, not a final recording

About three minutes, subject to verified submission rules:
1. 0:00–0:25 — Describe the buyer's difficulty finding an everyday item and the trader's opportunity to be discovered. Present this as the product problem, not measured research or traction.
2. 0:25–1:10 — Open a fictional shop. Enter one sale manually, review the exact size/unit and confirm once. Show the stock estimate and retry protection. If live Meta has passed, demonstrate interpretation first; otherwise explicitly state AI/voice is pending rather than playing a mock as live.
3. 1:10–1:50 — Search the same product as an anonymous buyer near the manual Kubwa pin. Show estimated availability, straight-line distance, landmark, freshness and optional attributed map. Record remaining stock as sold out in the trader view; let buyer polling remove the shop. Use synthetic data only.
4. 1:50–2:20 — Show a seven-day expiry fixture, safe in-date guidance and trader-controlled settings. Show the distinction between recorded revenue, stock estimates and simulated shop opens; no profit or acquired-customer claims.
5. 2:20–3:00 — Explain Next.js/PostgreSQL, confirmation/permissions, actual model role and current evidence. Describe the proposed Kubwa pilot, deferred production identity/consent/reliability work and next validation steps. Do not imply an approved public launch.

Five-minute pitch draft structure for the user: problem (45s), product/demo (90s), actual technical/model work (60s), proposed validation/business model with hypotheses labelled (45s), pilot ask and release gates (60s). Timing, video length and required assets need official rules before finalization.

### GitHub → Muse → model → deployment sequence

1. Confirmed destination: https://github.com/official-pam/Meta_market_assistant, public, empty repository created by the user and inspected in browser. Local repository initialized and 96 source/artifact paths reviewed. Exact local credential values and common key/token patterns were not found in staged content; environment files, local data and logs are excluded. Publication result is recorded below after execution.
2. Push the reviewed project to that destination, then verify a clean clone can install/build. User reports Muse Code installed in their VS Code terminal; this agent's shell does not yet find `muse` on PATH. Do not reinstall or pretend the terminal's environment is verified. Do not transfer secret files with the repository.
3. Confirm the exact required Meta model against the participant requirement and current docs. Muse Code is a coding agent; using it is distinct from the application making a successful model call. Preserve accurate evidence of both where applicable.
4. Before the first live call, revisit task 01: private key, authenticated access, credits and explicit smoke test. `npm run check:meta` itself makes a live call even if application calls remain disabled. Never put keys in chat, GitHub or the browser bundle.
5. Verify model extraction, ambiguous/unsupported output, English/Pidgin voice and text fallback; then update the evidence. No model success claim from configuration or mocked tests.
6. Before Railway provisioning, check trial balance, host limits, database access and deployment costs. Build/run the Docker image, migrate a separate synthetic database, seed once, test hosted owner isolation/concurrency and restore. No automatic external messaging or scheduler claim.
7. Check final event rules, selection/team, assets, latest deadline, repository access and user authorization before submission. User owns pitch; submission receipt is separate evidence.

The official event page was rechecked on 3 November and still lists 4 November 21:00 ET (5 November 03:00 WAT). Public event overview does not establish the detailed participant requirements. Current provider references: https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/muse-code. Do not infer a particular newly required model from the general model catalog.

Still open: full live voice-to-buyer journey, controlled weak-network/device tests, isolated planted-invalid-sale presentation, hosted deployment and restore rehearsal, license/asset/rule review, final video/write-up, public links and submission. The invalid-sales fixture is synthetic; do not call it production fraud detection. Task 05 scheduler and verified-model clearance remain pending. No real trader/buyer data collection, pilot, financing or paid insight release is authorized by this local preparation.

### Workshop findings and latest release evidence — 3 November 2026

Reviewed the descriptions and relevant searchable transcript sections in the user's two linked videos:
- Agents 101: https://vimeo.com/1239550947/045ee6e57e — at 07:28–07:41 the presenter uses Muse Spark 1.3 with max reasoning and explains `/model` and `/effort`. At 02:39–03:24 the cloning instructions concern `meta-models/legal-agent-workshop`, not this market app. Ground rules refer to that workshop's handbook. These sections do not establish a universal requirement to use Muse Wonder or clone the sample legal project for submission.
- Agents 102: https://vimeo.com/1239918451 — introduction at 01:05 describes checking answers and detecting missing evidence; at 06:51–07:18 the presenter applies workshop ground rules and implements memo verification. The transcript's “submission” at 27:12 is a sample memo tool action, not hackathon submission instructions. No complete official competition rulebook was established by these sections; do not claim to have watched every minute or verified all rules.
- Official organizer page https://cerebralvalley.ai/e/meta-ai-developer-hackathon lists Startup judging as technical execution and production reliability, and two themes. “Build for Your World” appears relevant to this product, but final theme selection is a team decision. The public page lists models including Spark and Wonder; it does not establish an exclusive model requirement or final deliverable lengths. Participant rules remain to be obtained before finalizing/submitting.

Release verification: combined local flow passed; lint and production build passed. Standalone production server booted on local port 3002 with calls disabled; missing configuration correctly returned generic HTTP 503 from readiness. Local configured demo readiness returned 200. No `.env*` files appeared at the standalone package root. Docker is not installed in this shell, so no container build/run or Railway claim is made.

Controlled local service outage: buyer retained six results while explicitly warning “Updates interrupted. Displayed results may be out of date.” and reporting connection interruption. Server was restarted immediately afterward. Development hot reload reset the search form; repeating the same search restored six results and the active refresh status. This verifies warning and repeat-search recovery, not uninterrupted automatic recovery across a development-server restart, measured mobile latency or packet loss. The normal production reconnect path still needs a controlled hosting/device check.

GitHub publication: initial commit `13538f8` pushed successfully to `main`; `git ls-remote` matched the local commit, and browser inspection showed the source and all six task files. No secrets, local demo data or logs were committed. A fresh public clone was created under ignored `web/.local-run/clean-checkout` for independent installation/build checks. This verification checkout is not a configured Muse session and has no API key. App key availability check remains false; application Meta calls remain disabled.

### Muse Code handoff

The user reports Muse installed in their VS Code terminal. From the actual project root (not a different project or the workshop's legal-agent folder), run `muse --version` to verify installation, then `muse`. Current Meta docs say the CLI can default to Spark 1.2; explicitly inspect `/model` and select Spark 1.3 to match the supplied workshop. Do not assume the CLI model setting changes `META_TEXT_MODEL` in the application. Sign in privately; never paste keys into chat or source control. The API app expects `MODEL_API_KEY`; Muse CLI authentication is separate and may use browser sign-in or its documented `META_API_KEY` variable.

Suggested first message to Muse:

> Read AGENTS.md and 06-demo-release-and-pilot.todo.md, then inspect the Next.js application in web/. Keep the confirmed product decisions and honest pending checks. First review the Meta extraction adapter for Muse Spark 1.3 against current official docs and run the existing tests. Do not modify stock automatically, invent successful model calls, publish private data or deploy services. Before a live model call, confirm that the app key is set privately and credits are available. Report proposed changes and actual validation evidence, and update the relevant existing todo file.

No Muse command or model call has been run by this agent; installation reported by the user is not authentication/credits evidence. No second agent should edit the same working files concurrently without coordination. To use a fresh clone instead, clone the confirmed GitHub URL into a separate user-chosen directory, then open that clone in VS Code and follow web/README.md; copy no secret files through GitHub.

User asked where to configure the application key: `web/.env.local` inside this workspace. Update only `MODEL_API_KEY` privately; preserve the existing session secret and keep `ENABLE_META_CALLS=false` until the smoke test passes. This file is ignored by Git. Await the user's confirmation that the key is saved and credits are available before making the first live call. Do not infer credit confirmation from elapsed time or from installation of Muse.

Fresh-checkout evidence: the public initial commit was cloned without `.env.local` or local data; `npm ci`, all 38 tests and the production build passed. Logs: `web/.local-run/task06-clean-install.log`, `task06-clean-tests.log`, `task06-clean-build.log`. The nested verification checkout produced an ancestor-lockfile warning; it still built successfully. Latest documentation was published separately in commit `ee36cdd`; source/dependency code is unchanged from the verified initial commit.

Dependency review: the full installation audit reported 16 moderate advisories. A separate `npm audit --omit=dev --json` reported zero production dependency advisories on 3 November 2026. Development dependency advisories remain to be triaged before a production maintenance baseline is claimed; no automatic breaking upgrades were applied. The audit is a point-in-time package check, not a security certification.

Task 06 remains open. Local preparation and source publication do not complete live-model validation, competition rules, hosted deployment, video recording, submission or real-data pilot gates.

3 November 2026 — Live-provider gate update: user confirmed key setup and available hackathon credits, and authorized the small text test. `npm run check:meta` passed against Muse Spark 1.3. This supersedes earlier missing-key/text-access blockers only. Application-level extraction, voice, other models and deployment are still pending; `ENABLE_META_CALLS=false` is preserved. Secret remains in ignored `web/.env.local` and is not included in this record.

3 November 2026 — User authorized live stock interpretation testing. Four real Muse Spark 1.3 extraction checks passed through the application adapter (English sale, Pidgin restock, missing quantity and multiple-item clarification). Reproducible command from web: `node --env-file-if-exists=.env.local scripts/check-meta-entries.mjs`. This consumes credits and is not part of the offline unit test suite. No stock writes; no voice test; app flag remains disabled. Application UI integration remains the next step.

3 November 2026 — Local application integration: ENABLE_META_CALLS=true was set privately after the successful live extraction checks and user authorization. The live /api/entries/interpret route passed with a fictional two-pack Indomie sale; interpretation and review left stock at 2, confirmation changed it to 0, replay was flagged and produced only one sale event, and polling the same buyer search removed the sold-out shop. Script: web/scripts/check-meta-flow.mjs. This test makes one live model call and requires the isolated local database; it is separate from offline release checks. Browser control failed to initialize even after reset, so actual screen rendering/click-through remains pending. Voice remains unverified. No credential or local database was committed.

3 November 2026 — Submission-priority deployment preparation: user asked to proceed toward a shareable demo. Railway trial availability and permission to create services are awaiting confirmation; no services provisioned. No Railway connector, installed CLI or Docker binary was found. Preparing the official CLI through npm. Current Railway docs require app root /web and a separate /web/railway.json config path for legacy config; new-service config-as-code deprecation is documented, with explicit equivalent dashboard settings in web/README.md. Before provisioning: verify trial resources and account, add a private PostgreSQL service and a separate synthetic demo app, set server-only secrets privately, migrate, seed once, test readiness/owner isolation/stock concurrency, then create and verify the public app URL. Keep database networking private. Submission form URL/required fields are still requested; video limits are not assumed.

3 November 2026 — Deployment execution: user explicitly authorized a separate Railway demo and later explicitly approved storing the Meta API key privately in Railway and enabling public live calls. The automatic approval review initially blocked that secret transfer; no transfer occurred until the user answered the specific approval question. Separate project/app/PostgreSQL created; old app untouched. Public URL: https://ai-market-assistant-production.up.railway.app. Private database connection verified. Startup now runs repeat-safe migrations and optional empty-database seed before serving; seed permission removed after successful initialization. Hosted healthcheck, root/buyer HTML and CSS delivery passed. Hosted manual integration passed including concurrency and insights. Hosted Spark Chat Completions returned upstream 404; a Responses compatibility deployment is running. 39 offline tests, type checks and targeted lint passed. Voice, visual-browser verification, backup restore and actual submission remain pending. No private account balance or secret values are included in this public record.

3 November 2026 — Final hosted verification passed using the Responses adapter and the same Muse Spark 1.3 model. The live public flow verified readiness, signup/session, real model interpretation, stock unchanged during interpretation/review, one confirmed sale, replay without duplication, buyer polling removal, unauthenticated stock denial, competing last-item sales (HTTP 200 and 409), and insights. Script: web/scripts/check-hosted-demo.mjs. Both homepage and buyer page and their stylesheet delivery returned HTTP 200. Hosted Chat Completions 404 remains a protocol-specific deployment issue; Responses is the verified hosted configuration. Final compatibility deployment: 31104cb9-0aed-49c1-9d54-45e6f8fd530e. No final video, visual browser/voice claim, backup restore or competition submission is implied.
