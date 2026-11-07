# SESSION_NOTES.md

Last updated: 7 November 2026. Branch: `next-phase`. Remote: owner's own
https://github.com/Joseph-Yahaya/Meta_market_assistant (verified with
`git remote -v`). The teammate's submission repository
https://github.com/official-pam/Meta_market_assistant must never be changed.

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
- Build order set 7 November: R part one, key and image test, Q, N, O, P, R part two. R part one is next when the owner says go.

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
