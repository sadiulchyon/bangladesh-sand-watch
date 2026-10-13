# Hosting migration status

## v4 preparation completed

- Standalone lightweight Cloudflare Worker, independent of Sites build and identity.
- Owner Basic authentication and separate bearer credential for collection; all assets/API requests protected.
- Free-plan write caps and 20-review frontend batches.
- Idempotent SQL import for 130 records, 130 reviews, 45 sources, 8 runs, 583 discovery hits, 66 searches and 574 backfill jobs.
- Authentication tests, existing frontend checks, SQLite import/replay checks and Wrangler dry-run pass.

## Pending

The owner has created and signed into a Cloudflare account. Deployment access is unavailable to the assistant in the owner's app browser. Actual D1 provisioning, secret setup, remote import, deployment, hosted verification and automation migration are pending. Follow cloudflare/README.md. The old daily automation still targets ChatGPT Sites. No hosting cutover has occurred.
