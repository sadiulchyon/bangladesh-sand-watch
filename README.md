# Daily news collection

The daily collector is the GitHub Actions workflow `.github/workflows/collect.yml`, running `collector/collect.mjs` every day at **14:40 UTC** (08:40 Chicago in winter, 09:40 in summer). It runs on GitHub's servers, so no computer needs to stay awake. You can also start it from the Actions tab ("Collect new records" → Run workflow), with an optional dry run that collects and reports without saving. It replaced the ChatGPT scheduled chat task on 11 November 2026; the earlier `scheduled-chat` snapshots remain part of the archive.

It needs three repository secrets (Settings → Secrets and variables → Actions). None of them is ever written to the repository, snapshots or logs:

- `ANTHROPIC_API_KEY`: Claude API key. Claude Sonnet 5.5 writes and reviews the bilingual summaries; a typical run costs roughly $1–3, is capped at 70 model calls, and the estimate is reported in each run summary.
- `TINYFISH_API_KEY`: TinyFish Search and Fetch, used first, within the free daily allowance (12,000 searches and 1,000 fetched URLs per day). Each run uses about 20 searches and at most 60 fetches. Paid Agent, Browser and Monitor endpoints are never called.
- `FIRECRAWL_API_KEY` (optional): fallback only, for pages TinyFish and a direct read cannot get, or pages without a readable date. The run checks the balance first, spends at most 10 credits, and never takes the balance below 5. It never buys credits.

Each run:

1. searches newest reporting first (the last 14 days, Bangla and English), then a rotating set of publishers for the current year, then two earlier years per day back to 2010, plus free Bing News RSS, GDELT and the discovery backlog;
2. reads each original article through TinyFish Fetch, then a direct page read, then Firecrawl; search snippets are never evidence;
3. has Claude decide relevance and draft the record, quoting the article's date line and every figure verbatim. The code rejects the draft if any quote is not actually in the article. The publication date comes from the article text or the publisher's own page metadata; a date from a provider's metadata is only a hint;
4. has a second Claude pass act as editor: it checks named places, every figure in both languages, attribution of allegations, and whether the report duplicates an incident already in the archive. It may correct the summaries once;
5. publishes only records that pass as **Accept** (see the [editorial policy](EDITORIAL_POLICY.md)). Failed, undated, unresolved or duplicate items go to the discovery log with the reason, and blocked or undated pages are retried on later runs;
6. writes `snapshots/<date>-github-actions-<time>.json`, runs the site checks and build, commits, starts the Pages deployment, and then confirms every new record ID in the live `data/archive.json`. The job fails if they are missing.

Records are marked `auto: true` with `collector: "github-actions"`. Each snapshot's `editorialReviews` keeps the source body hash, date evidence, figure quotes and checks for each record, and its run entry records TinyFish, Firecrawl and Claude usage. A green run with zero additions does not establish that nothing new was published.

Public address: https://sadiulchyon.github.io/bangladesh-sand-watch/

`.github/workflows/pages.yml` runs `node scripts/check.mjs`, then `node scripts/build-pages.mjs`, and deploys `_site/` on every push to `main` (or by hand from the Actions tab). The build loads the verified D1 snapshot `cloudflare/initial-data_v2.sql` into an in-memory SQLite database and writes `data/archive.json` in the same shape as `GET /api/archive`. Set `SNAPSHOT` to build from a different SQL export.

The public site is read-only (`<html data-mode="public">`). It hides the review workspace, the review editor, review import/export and the decision filter, and it never publishes editorial notes. Record CSV, discovery-log CSV and workbook downloads still work. To publish newer records, save `/api/archive` from the live site into `snapshots/` (see `snapshots/README.md`) and push to `main`; the build merges it into the SQL snapshot.

One-time setup: in the repository, open Settings → Pages and set Source to "GitHub Actions".

# Bangladesh Sand Watch v4 hosting migration

The independent Cloudflare Worker, owner login, deployment configuration and archive snapshot are in [`cloudflare/`](cloudflare/README.md). The ChatGPT Sites deployment remains live; Cloudflare deployment is pending. The archive now opens across all available years.

# Bangladesh Sand Watch, website v3.1

Preserves the original bilingual design and the 17-record pilot. Adds a durable D1 archive, shared editorial decisions/notes, URL and DOI deduplication, a 45-source registry, run history, and a bounded unattended ingestion API. New collection records enter Pending review.

The site must remain owner-private while using the current shared service writer. Sites dispatch supplies the access boundary. A public launch requires separately protected editorial and ingestion endpoints before changing the audience. Do not put access tokens in source or schedules.

`public/` retains the browser assets and original workbook. `app/route.ts` serves the original HTML. `db/schema.ts` and generated `drizzle/` migrations define durable tables; bootstrap data is outside migrations. `public/collection-plan.json` and `/api/update-plan` contain the current unattended collection rules.

## API

- GET /api/archive: records, shared reviews, source checks, run history.
- POST /api/bootstrap: idempotent seed of the 17 pilot records and 27 sources.
- PATCH /api/review: validated editorial decisions and notes.
- POST /api/ingest: up to 20 source-backed records; canonical URL/DOI deduplication; stable run IDs make retries idempotent.
- GET /api/update-plan: bounded collection instructions and source registry.

`scripts/site-api-client.mjs` accepts a service credential and request through hidden stdin. Obtain the token with fresh Sites get_site; it never belongs in a file.

## Checks

`node scripts/check.mjs` checks seed integrity, aliases, filters, sorting, review backups, CSV safety, syntax, targets and assets. Build through the Sites build helper. Hosted bootstrap, actual source ingestion, review persistence, and readback verify the writer independently. Browser visual QA was unavailable.

## Collection scope

Daily discovery starts with at most eight queries, twenty hits per query, and twenty newly scraped/added records per run. Rotate targeted searches across the registry and include research discovery each Monday. A successful targeted search does not establish full-site completeness. Historical backfill retains historical dates. Flag inaccessible bodies, OCR, allegations, abstract-only papers, and legal interpretation. Record failures and preserve Pending status.

Noto Sans Bengali is supplied under the SIL Open Font License in public/assets/OFL.txt.

## Historical and 2026 backfill

The default archive now shows all available years, including historical reports and 2026. Date filters remain available. Historical source-year checks supplement the 2026 month matrix. Publication years are retained without inventing exact dates. The new search/discovery tables retain every query attempt, returned URL, status, date evidence, record link and exclusion/retrieval reason. `/api/backfill` supplies queued month/source searches and accepts logs, status changes and narrower child jobs. `/api/backfill/bootstrap` seeds the 450 source–month checks separately from schema migrations. A Checked job means an indexed keyword search occurred; it never establishes exhaustive coverage. The source matrix, search-failure table and discovery CSV expose this distinction. Date filters are verified against actual source dates; updated-only records are flagged.
