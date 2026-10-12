# Bangladesh Sand Watch, website v3

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

## 2026 backfill

The default archive starts on January 1, 2026 using labeled source dates, with older context retained. The new search/discovery tables retain every query attempt, returned URL, status, date evidence, record link and exclusion/retrieval reason. `/api/backfill` supplies queued month/source searches and accepts logs, status changes and narrower child jobs. `/api/backfill/bootstrap` seeds the 450 source–month checks separately from schema migrations. A Checked job means an indexed keyword search occurred; it never establishes exhaustive coverage. The source matrix, search-failure table and discovery CSV expose this distinction. Date filters are verified against actual source dates; updated-only records are flagged.
