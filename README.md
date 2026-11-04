# AI Market Assistant

AI Market Assistant helps traders record stock and helps buyers discover products in nearby shops. The intended application serves traders and buyers wherever they are, starting with Nigerian markets. It uses Next.js for the frontend and backend, PostgreSQL for inventory records, and Meta models for assisted logging.

**Kubwa is the sample market, not the application's geographic limit.** The current hackathon demo uses fictional provision shops in Kubwa and a packaged-goods catalog to demonstrate the core flow. Broader location and product-category support is intended scope, not a claim that every market is already covered or every type of product is supported.

In the intended experience, traders register their shop's location and supported products, and buyers search around a chosen location. Local results depend on participating shops keeping their stock records current; opening the site in a new area does not automatically provide inventory for that area. An area without participating shops should show an honest empty result.

**Demo data is simulated.** The [Railway demo](https://ai-market-assistant-production.up.railway.app) is deployed with PostgreSQL. Hosted signup, live Muse Spark 1.3 text interpretation, review before stock changes, confirmation/replay protection, buyer updates, stock authorization and concurrent oversell checks passed. The hosted text adapter uses Meta's Responses API. Visual browser checks, representative voice quality, backup restore and actual submission remain pending.

- [Application setup, verification and architecture](web/README.md)
- [Project instructions and six-task plan](AGENTS.md)
- [Release checklist, workshop findings and Muse handoff](06-demo-release-and-pilot.todo.md)

Open `AI Market Assistant.code-workspace` in VS Code. Application commands run from `web/`:

```sh
npm ci
npm test
npm run lint
npm run build
```

Follow `web/README.md` to configure a private local environment before starting the demo. Environment files, API keys and local demo databases are excluded from this repository.

The supplied Meta Agents 101 workshop demonstrates Muse Spark 1.3; this app defaults to that model for extraction. Using Muse Code to edit a repository and calling a Meta model from the application are separate steps. Neither is proof that all hackathon rules or production launch requirements have passed.
