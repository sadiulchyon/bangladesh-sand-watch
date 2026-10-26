# Scheduled news collection

The active daily collector is the **Bangladesh Sand Watch daily news** scheduled chat task (`bangladesh-sand-watch-daily-news`), configured for **08:40 America/Chicago**. Its schedule is managed in the desktop app, not by a GitHub Actions cron trigger. Keep the computer awake and the app running for this local task. Following the owner's 26 October 2026 instruction, it uses **TinyFish Search and Fetch first**, with the connected **Firecrawl** tools as a fallback for blocked, incomplete or date-ambiguous pages, and GitHub tools for publication. A separate Gemini API key is not required for this workflow. The TinyFish credential is stored privately on the execution host outside the repository and is never included in the public site, snapshots, logs or automation prompt.

Each run targets up to 20 new News records when enough relevant, nonduplicate sources can be verified. It prioritizes the newest years, then works through appropriate reporting from any available year, with no lower-year cutoff. TinyFish use is limited to Search and Fetch within the documented free allowances, with local usage tracking and conservative caps; paid Agent, Browser and Monitor endpoints are not used. If Firecrawl fallback is needed, the task checks its balance before and after collection and normally uses no more than 40 net credits per run, reducing fallback work when the balance is low. It:

1. reads the current main branch, merges the archive and snapshots, and searches Bangla and English reporting;
2. reads original article pages, retains their stated publication/update dates, and attributes allegations rather than treating search snippets as evidence; checks actual article dates because extracted provider metadata may be absent or disagree with the page, and falls back when an extraction strips date evidence or article content;
3. prepares bilingual summaries naming the river/site and location and retaining source-stated monetary amounts, volumes, distances, areas and other substantive figures with their units and attribution; checks canonical URLs, DOI and reported incidents for duplicates, and performs an assistant editorial pass before assigning Accept;
4. validates the full JSON payload and its blob hash, then commits a new snapshot using an expected-head check so concurrent edits are preserved;
5. follows the exact commit's GitHub Pages build and deployment, parses the deployed archive JSON, and verifies every new ID and the expected record-count increase before reporting completion.

Scheduled records are marked `auto: true` and show the "Auto-collected" badge. Run and discovery entries identify the collector as `scheduled-chat` and record the assistant's editorial checks. The owner authorizes Accept after those checks; unread, duplicate or unresolved content is deferred or excluded. Accept is archive inclusion and faithful source representation, not independent verification of allegations. A green workflow or a run with zero additions does not establish successful collection.

The first scheduled test on 25 October 2026 added three distinct News records and verified all three on the public site, increasing the archive from 270 to 273 records. The test snapshot is `snapshots/2026-10-25-scheduled-chat-first-success.json`.

The owner approved all 273 existing records for editorial inclusion on 25 October 2026, then authorized recurring assistant collection and editorial acceptance of new records that pass the source checks. The original decisions and summary maintenance are saved in `snapshots/2026-10-25-zz-editorial-review-all-current.json`. [Editorial policy](EDITORIAL_POLICY.md) defines acceptance, mandatory river/location names, source-stated figures and units, all-years priority, and credit-aware operation. The task does not purchase credits or enable paid overages. TinyFish free-tier limits and Firecrawl credit exhaustion are handled independently: an unavailable provider does not stop usable retrieval through the other. The task retains its daily schedule and reports a new actionable blocker if neither can provide sufficient evidence.

## Legacy manual collector

`.github/workflows/collect.yml` retains `workflow_dispatch` for manual diagnostics and its dry-run option. Its daily cron trigger is disabled after the successful scheduled-chat test. `collector/collect.mjs` needs a working supported provider credential, currently `GEMINI_API_KEY`, in repository Actions secrets. [GitHub Models was retired on 30 July 2026](https://docs.github.com/en/github-models); the script's historical fallback is not a working model provider. Without a valid supported provider, the script stops before collecting articles.

The manual script gathers discovery backlog, Bing News RSS, GDELT and OpenAlex candidates; it reads pages directly and can use Firecrawl v2 when `FIRECRAWL_API_KEY` is configured. Its limits remain 20 records, 30 model calls and 60 page reads per run, with at most three retrieval attempts per backlog item. This script is separate from the active scheduled chat.


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
