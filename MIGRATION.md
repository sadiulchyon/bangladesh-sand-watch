# Hosting migration status

## v4 preparation completed

- Standalone lightweight Cloudflare Worker, independent of Sites build and identity.
- Owner Basic authentication and separate bearer credential for collection; all assets/API requests protected.
- Free-plan write caps and 20-review frontend batches.
- Idempotent SQL import for 64 records, 64 reviews, 45 sources, 4 runs, 314 discovery hits, 40 searches and 450 backfill jobs.
- Authentication tests, existing frontend checks, SQLite import/replay checks and Wrangler dry-run pass.

## Pending

Cloudflare account creation is blocked in the cloud browser by a repeated security verification page. Actual D1 provisioning, secret setup, remote import, deployment, hosted verification and automation migration are pending. Follow cloudflare/README.md. The old daily automation still targets ChatGPT Sites. No hosting cutover has occurred.
