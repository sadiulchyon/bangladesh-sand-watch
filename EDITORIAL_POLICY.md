# Editorial decisions and summary requirements

On 25 October 2026, the archive owner authorized **Accept** for all 273 records existing at main commit `19e96bd803fc4779a40b1486b857abe4fda71fac`. The snapshot `snapshots/2026-10-25-zz-editorial-review-all-current.json` records those exact IDs.

The owner's subsequent instruction authorizes the assistant to continue the recurring collection and perform editorial review for new records. The scheduled-chat collector may publish **Accept** after it reads the original article and checks relevance, duplicates, dates, named places, every quantitative statement, bilingual equivalence, attribution and source limitations. Record that assistant review in the run/snapshot provenance. Unread or unresolved material must be deferred or excluded rather than receiving an automatic pass. The legacy manual script and private ingestion API may still stage unreviewed material as **Pending**; machine generation alone is not editorial review.

Prioritize the current year and newest reports, then work backward through earlier years. Any available source year can qualify; there is no lower-year cutoff for the scheduled-chat collector. Keep actual source publication/update dates and historical context. Count translated, syndicated and repeated coverage of the same incident once, while allowing a distinct dated follow-up action with new evidence.

Check Firecrawl's balance at the beginning and end of each run. The normal per-run ceiling is 40 net credits and up to 20 new records, reduced when credits or source evidence are insufficient. Prefer markdown article reads over costly structured extraction when the article text suffices. Never buy credits, enable overages or subscribe automatically. If credits are exhausted, leave the daily schedule active to recheck availability, avoid repeated paid calls and notify only for a new actionable blocker.

Accept means approved for inclusion and source representation. It does not independently verify allegations, convert reported court orders into a current legal determination, or remove abstract-only/OCR/inaccessible-source limitations.

Every new or revised English and Bangla summary must include:

1. The named river/channel or extraction site, and the relevant village, union, upazila and/or district stated in the original source. For national or unnamed-site material, retain that scope and say when a specific river is not identified.
2. The substantive quantitative details supplied by the source: fine/lease/revenue/project/loss amounts; sand or stone volumes or mass; affected river length, land area, depth and distance; relevant equipment/people counts and duration. Do not omit figures merely to fit a short sentence limit.
3. Exact magnitudes, units, ranges, time bases and attribution in both languages. Distinguish cubic feet from cubic metres, stock from extraction rates, damaged length from total project length, and project expenditure from mining losses. Preserve lakh/crore equivalence if converting. Keep estimates, allegations, projections and official statements identified as such.

Read the original article or document body. Never take quantities from search snippets, unrelated recommendation cards, navigation, publication clocks or advertisements. Do not invent a river, location or number when absent; retain uncertainty, source limitations and conflicting accounts. Numbers in an abstract remain abstract-reported results.

The October 25 maintenance snapshot adds the existing location/site metadata to all 273 bilingual summaries. Eight older summaries were also reread against their original articles and expanded with quantitative context; their IDs are listed in the snapshot. Other historical summaries retain their existing quantitative content. This maintenance pass is not a claim that every quantitative statement in every historical full text has been re-audited.

The active scheduled chat and legacy manual collector prompt both use this policy. Validate named places, numerical equivalence, category, dates, IDs and URLs before publishing. Confirm the deployed review decisions and record count from parsed `data/archive.json`.
