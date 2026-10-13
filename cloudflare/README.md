# Bangladesh Sand Watch v4: standalone hosting preparation

This additive Cloudflare Worker preserves the v3 interface and archive APIs without using the Sites build, dispatch, or sign-in integration. The original v3 source remains in the parent folders. No Cloudflare deployment has occurred yet.

The Worker guards EVERY page, asset, and API with an owner login or collector bearer token. It fails closed when secrets are absent. Do not remove `assets.run_worker_first: true`. Private repository visibility alone does not protect a hosted website.

## First deployment

1. Create your Cloudflare account and keep the Workers Free plan. No custom domain is needed initially; use the assigned workers.dev address.
2. Clone this private GitHub repository. Use Node 22 or newer. In `cloudflare/`, run `npm install` and `npm test`.
3. Run `npx wrangler login`, then `npx wrangler d1 create bangladesh-sand-watch`. Copy the returned, non-secret database ID into `cloudflare/wrangler.jsonc`, replacing the all-zero placeholder. Commit that configuration update.
4. From `cloudflare/`, run `npx wrangler d1 migrations apply bangladesh-sand-watch --remote --config wrangler.jsonc` and then `npx wrangler d1 execute bangladesh-sand-watch --remote --config wrangler.jsonc --file initial-data_v2.sql`. The latter imports the verified snapshot: 130 records, 130 reviews, 45 sources, 8 collection runs, 583 discovery hits, 66 search attempts, and 574 backfill jobs. Import is idempotent and does not overwrite existing rows. Some operational timestamps use the snapshot timestamp because the archive API does not export every underlying table timestamp.
5. Set a dedicated owner username and strong password using the secure Wrangler prompts: `npx wrangler secret put OWNER_USERNAME --config wrangler.jsonc`, then `npx wrangler secret put OWNER_PASSWORD --config wrangler.jsonc`. Set a separate random collector credential with `npx wrangler secret put INGEST_TOKEN --config wrangler.jsonc`. Never paste these secrets into GitHub source, issues, or chat. Secret updates may deploy a version, but this Worker refuses all access until credentials match.
6. Run `npm run build`, then `npm run deploy`. The deploy helper refuses the placeholder database ID. Open the returned URL and sign in with the dedicated owner credentials. Verify records, reviews, log export and backfill counts before replacing the existing website.

## GitHub deployment integration

Once the initial deployment and database are verified, connect this repository in Cloudflare Workers Builds. Limit GitHub access to this repository. Set the root directory to `cloudflare`, build command to `npm run build`, and deploy command to `npm run deploy`. Keep credentials in Cloudflare's secret settings. The production configuration and migrations belong in GitHub; runtime secrets do not.

## Collection and free-plan limits

The existing ChatGPT daily collector still targets the old Site. It has NOT been redirected to Cloudflare. The new host accepts a collector bearer credential in the normal Authorization header. Before switching automation, configure that credential through a supported secret mechanism and verify authenticated ingestion and readback. This source preparation does not claim that unattended collection works on the new host yet.

Reads preserve v3 behavior. Writes are capped at 10 records plus 5 source checks per ingestion request, 20 reviews, or 40 total search/hit/job entries per backfill request. HTTP bootstrap endpoints are disabled; use SQL migrations and the snapshot import instead. Each request reads at most 1 MB of actual body bytes. These caps reduce the query work per request for the Free plan. They are not a proof of meeting the 10 ms CPU budget: production CPU and growing archive reads/export must still be measured.

Scraping remains separate from hosting. Cloudflare does not supply Firecrawl credits. The snapshot contains evidence metadata, attributed summaries and source links, not full scraped newspaper bodies. The previous indexed keyword checks do not establish exhaustive coverage.

## Verification completed

- Existing frontend/data checks passed.
- Owner and collector authentication tests passed, including missing secrets, wrong credentials and forged platform identity headers.
- SQLite schema/snapshot import and repeat import preserve all table counts.
- Wrangler dry-run bundles the standalone Worker and static assets successfully.

The owner has created and signed into a Cloudflare account. Deployment access is unavailable to the assistant in the owner's app browser. Real D1 import, secret setup, hosted endpoint tests, browser QA and automatic deployment remain pending.

## Historical archive update

Snapshot v2 contains 130 records including 52 additions with source dates from 2013 through 2026. All 52 enter Pending review with bilingual attributed summaries. The archive opens across all years, and the existing collector now alternates historical and current searches. Updated-only publication labels and first-online versus issue dates are flagged. Indexed searches remain partial. The previous `initial-data.sql` is retained for version history; use v2 for a fresh deployment.
