# AI Market Assistant

AI Market Assistant is intended to help traders record and confirm stock updates and help buyers find nearby estimated availability wherever they use the service, starting with Nigerian markets. Buyers browse without accounts. It is built with Next.js for the interface and APIs, PostgreSQL stock events, and Meta Model API adapters.

**Current demo scope:** fictional provision shops in Kubwa and a packaged-goods catalog. Kubwa is a sample location, not a permanent geographic restriction. The intended wider experience lets traders register shop locations and supported products and lets buyers search around a chosen location. Results require participating shops with current inventory; new areas may have no results. Location/category expansion and real-data onboarding still require implementation and validation beyond the current synthetic demo.

**Current state:** the Railway synthetic demo is deployed. Hosted readiness, signup, live Muse Spark 1.3 interpretation through Responses, no stock write before confirmation, replay protection, buyer sold-out refresh, private-stock authorization, concurrent last-item oversell prevention and insights passed. Four local live extraction cases and 39 offline tests also passed. Visual screen verification, representative voice accuracy, broader reliability/backup checks and competition acceptance remain pending. This is not a production service or completed voice integration.

## Run locally

Use Node.js 24 LTS and npm. From this `web` folder:

```sh
npm ci
```

Copy `.env.example` to `.env.local`. Set `DEMO_MODE=true`, `LOCAL_DEMO_DATABASE=true`, `ENABLE_META_CALLS=false`, `APP_ORIGIN=http://127.0.0.1:3000` and a private random `SESSION_SECRET` of at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never commit that value. Leave `DATABASE_URL` empty for the isolated local demo.

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/` for traders and `/buyer` for buyers. The development-only embedded PostgreSQL-compatible engine applies migrations and creates 30 fictional shops, 60 products and simulated stock history on first use. It stores data in ignored `.local-demo/`. This is not a hosted PostgreSQL concurrency test. Sign up with fictional information only. No email verification or password recovery exists.

## Verify

```sh
npm test
npm run lint
npm run build
```

With the development server running, isolated local database enabled and Meta disabled:

```sh
npm run check:local-release
```

This creates fictional test accounts and stock entries; it never provisions services or calls Meta. It checks trader signup/login, isolation, confirmation, replay protection, recounts, blocked overselling, buyer search/feedback/live refresh logic, stock alerts and shop-open aggregation. It does not certify voice, an actual phone, weak connectivity, production concurrency, deployment or submission.

## Architecture and limits

- `src/app/`: trader and buyer screens, server Route Handlers. `src/server/`: owner authorization, database access and Meta calls. Secrets remain server-side.
- `db/migrations/`: six checksummed, transactional migrations. Never edit an applied migration; add another.
- Stock events are append-only. Sales allocate available unexpired batches; a recount records the difference from the current estimate. Overselling is rejected. Piece/pack/carton quantities are not converted automatically.
- Every interpreted entry requires a signed, expiring review and explicit confirmation. Retrying the same confirmation does not record another sale. Model output is untrusted; the server validates it and enforces owner permissions.
- Buyer discovery uses manual locations, straight-line distance and a list fallback. Leaflet/OpenStreetMap tiles load only on request with attribution. No route drawing or buyer account is required. Private counts, prices and phones are excluded from discovery responses.
- Polling updates estimated availability. Stale physical counts and repeated negative reports suppress listings. Feedback never rewrites stock. Sales alone do not refresh a physical count.
- Alerts and expiry guidance are deterministic, not a working AI forecast. Recorded revenue excludes missing-price allocations and is not profit. Weekly shop opens are counted once per search/shop, not unique people or proven visits; the initial week is partial.
- Audio is not persisted by this app after transcription. Provider retention terms and representative English/Pidgin quality still require review before real usage.

## Meta and Muse Code

The current adapter defaults to `muse-spark-1.3` for extraction and `muse-voice-transcribe-1.0` for transcription. These are configuration defaults, not proof of authenticated access or the final required hackathon model. Confirm the required new model with the team, current provider documentation, available credits and account access before changing it or making a call.

After the API-access gate is satisfied, set the key privately in `.env.local`, choose the verified model, and run `npm run check:meta`. That command makes a live, potentially billable text call even while `ENABLE_META_CALLS=false`; do not run it before checking credits. Enable application calls only after the smoke check. Then test actual extraction, ambiguous English/Pidgin inputs, provider failures and audio separately.

GitHub/Muse handoff, once the destination is confirmed: push reviewed source without `.env*`, local data, screenshots/logs or keys; clone the confirmed repository in the user's Muse environment; open its root instructions; run the commands above from `web/`. Muse Code is a coding tool; cloning into it does not itself establish that this application uses the required Meta model. Preserve the code changes and provider execution evidence separately. Do not send environment files or private data to an agent workspace without the user's approval.

## Railway demo

Public app: https://ai-market-assistant-production.up.railway.app — buyer search: https://ai-market-assistant-production.up.railway.app/buyer. This is a synthetic hackathon demo, not a real-data pilot. Hosted readiness, live Spark interpretation, stock confirmation, replay protection, buyer updates, private-stock authorization and concurrent oversell prevention passed against PostgreSQL. Visual/voice and remaining release checks are tracked in task 06.

`META_TEXT_PROTOCOL=responses` selects Meta's Responses API with the same strict schema and Spark model; `chat` preserves the Chat Completions path. Local live Responses extraction and incomplete-output rejection tests passed. Hosting protocol selection is tracked separately from model identity and permission to call it.

Set the application service root directory to `/web`. Railway's [monorepo documentation](https://docs.railway.com/deployments/monorepo) says the config-file path is separate: for a service supporting the checked-in legacy config, explicitly select `/web/railway.json`. Current [config documentation](https://docs.railway.com/config-as-code/reference) deprecates that format for new services; use the dashboard settings below if the new service does not support it. Do not assume the nested config is discovered automatically.

Dashboard settings: Dockerfile builder using `Dockerfile` within the `/web` source root; pre-deploy command `node scripts/migrate.mjs`; start with the image's `node server.js` command; healthcheck `/api/health`, timeout 120 seconds; restart on failure with up to three retries. The Docker image runs as a non-root user and listens on Railway's `PORT`. These are prepared settings, not proof of a successful container build or deployment. Railway's [deployment healthcheck](https://docs.railway.com/deployments/healthchecks) is not continuous monitoring.

Before provisioning: confirm trial balance, resource limits, PostgreSQL connectivity and any required extensions. Current SQL does not require PostGIS; discovery uses spherical distance. No hosted model calls, scheduler or webhook delivery has been verified. The Docker image itself still needs a build/run test where Docker is available.

For a separate **synthetic-only** hosted database set `DATABASE_URL`, `DEMO_MODE=true`, `LOCAL_DEMO_DATABASE=false`, a new `SESSION_SECRET`, `ENABLE_META_CALLS=false`, and `APP_ORIGIN` to the exact HTTPS application origin. Configure secrets in Railway, never build arguments. Run the seed once against an empty migrated demo database using `ALLOW_DEMO_SEED=true`, then remove that seed permission. Never seed over live records or automate seeding on every deployment. Recheck freshness dates before a demonstration.

`GET /api/health` returns only `ready` or `unavailable`, checks required configuration, database connectivity and the latest required table, and returns 503 on failure. It does not test Meta or disclose connection details. Observe server errors and response failures without recording credentials, audio, request bodies or precise buyer coordinates. Assign an operator and configure continuous monitoring before public use.

The production startup command runs `scripts/release.mjs` before starting the standalone server. This applies checksummed migrations even when a hosting platform omits the pre-deploy hook. Seeding requires both `DEMO_MODE=true` and `ALLOW_DEMO_SEED=true` and an empty shops table. Existing data is retained. Remove the seed permission after initial setup. For new deployments, use `node scripts/release.mjs` as the pre-deploy command as well.

## Recovery and demo reset

Local reset: stop the development server, verify the resolved `.local-demo` path is inside this project's `web` folder, then **rename** it to a dated backup. Restart to create fresh synthetic data. Retain the backup until the new demo is checked. Do not run this on a hosted database or while another process is writing.

Hosted recovery: take and verify a PostgreSQL backup before migrations or rehearsals. Rehearse restore into a separate database before depending on it. For a clean demonstration prefer a new empty synthetic database plus migrations/seed, then switch only the demo service after checks. Do not delete or truncate the existing database. Rolling back the app does not roll back its database; use forward-compatible migrations or a separately verified backup/restore plan.

## Submission and attribution

Startup track is user-confirmed; the user owns the pitch. Source destination is the user's public repository, [official-pam/Meta_market_assistant](https://github.com/official-pam/Meta_market_assistant). The user reports Muse Code installed in VS Code. The supplied [Agents 101 workshop](https://vimeo.com/1239550947/045ee6e57e) demonstrates Muse Spark 1.3 at 07:28, matching the current default. Workshop examples are not a complete competition rulebook. Participant selection and final deliverables remain unverified; no submission is implied by preparing or publishing source. See root task 06 for the rehearsal, actual push result and acceptance record.

Keep Leaflet/OpenStreetMap attribution visible. Preserve third-party license notices in packaged dependencies. Review the full dependency tree, project license choice, asset rights and AI-assistance disclosure against actual competition rules before publishing. No original-code license is chosen on the user's behalf. This implementation was developed with AI coding assistance; document any later Muse Code contributions accurately. All displayed demo activity is simulated, not validated customer demand, fraud detection or evidence for lending.
