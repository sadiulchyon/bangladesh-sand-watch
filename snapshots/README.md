# Live archive exports

Put saved responses of `GET /api/archive` from a live host (the ChatGPT Sites version or the Cloudflare Worker) here as `.json` files, for example `2026-10-23-chatgpt.json`.

`scripts/build-pages.mjs` builds the public site from `cloudflare/initial-data_v2.sql` and then merges these files in filename order, so use dated names. Entries with the same `id` are replaced by the newer file. Editorial notes are always dropped; only decisions are published.

To export: sign in to the live site, open `/api/archive` in the same browser tab (for example `https://<your-site>/api/archive`), save the page as a `.json` file, and add it here. A push to `main` redeploys the public site.
