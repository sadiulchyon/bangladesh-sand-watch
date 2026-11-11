// Daily collector for Bangladesh Sand Watch, run by .github/workflows/collect.yml.
//
// 1. Search: TinyFish Search first (free daily allowance), plus free Bing News RSS, GDELT and the
//    unread discovery backlog.
// 2. Read: TinyFish Fetch first; a direct page read next; Firecrawl only as a credit-capped
//    fallback for blocked, incomplete or undated pages. Search snippets are never used as evidence.
// 3. Write: Claude drafts the bilingual record from the article body, quoting the source's date
//    line and every figure verbatim; the code checks each quote is really in the article.
// 4. Review: a second Claude pass checks places, figures, Bangla/English equivalence, attribution
//    and incident-level duplicates against the archive. Only records that pass are Accepted
//    (EDITORIAL_POLICY.md); anything unresolved is deferred to the discovery backlog.
// 5. Save: one snapshots/<date>-github-actions-<time>.json file in the GET /api/archive shape.
import Anthropic from '@anthropic-ai/sdk';
import {Readability} from '@mozilla/readability';
import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
import {writeFileSync, appendFileSync} from 'node:fs';
import path from 'node:path';
import {loadArchive, categories, root} from '../scripts/archive-data.mjs';

const env = process.env;
const MAX_RECORDS = Number(env.MAX_RECORDS || 20);
const MAX_SEARCHES = Number(env.MAX_SEARCHES || 24);        // TinyFish free: 12,000/day, 30/min
const MAX_FETCHES = Number(env.MAX_FETCHES || 60);          // TinyFish free: 1,000 URLs/day, 150/min
const MAX_FIRECRAWL = Number(env.MAX_FIRECRAWL || 10);      // credits per run (1 per scrape)
const FIRECRAWL_FLOOR = Number(env.FIRECRAWL_FLOOR || 5);   // never spend below this balance
const MAX_MODEL_CALLS = Number(env.MAX_MODEL_CALLS || 70);
const MODEL = env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const DRY_RUN = env.DRY_RUN === 'true';
const MAX_TEXT = 24000; // characters of article body sent to the model

const started = new Date(), stamp = started.toISOString();
const day = stamp.slice(0, 10), hhmm = stamp.slice(11, 16).replace(':', '');
const runId = `github-actions-${day}-${hhmm}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ---------- identity (must match server/catalogue.ts) ----------
export function canonicalUrl(value) {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Invalid source URL');
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}
export const keyFor = value => 'BSW-' + createHash('sha256').update(value).digest('hex').slice(0, 16);
const hash = s => createHash('sha256').update(s).digest('hex');
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// ---------- usage accounting (written into the run record) ----------
const usage = {
  tinyfish: {searchRequests: 0, fetchURLs: 0, fetchFailures: 0, paidAgentCalls: 0, paidBrowserCalls: 0},
  direct: {reads: 0},
  firecrawl: {before: null, after: null, scrapes: 0, fallbackReasons: {}},
  claude: {model: MODEL, calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0},
};

// ---------- network ----------
const UA = 'Mozilla/5.0 (compatible; BangladeshSandWatch/2.0; +https://sadiulchyon.github.io/bangladesh-sand-watch/)';
async function get(url, {type = 'text', timeout = 25000} = {}) {
  const res = await fetch(url, {headers: {'User-Agent': UA, 'Accept-Language': 'bn,en;q=0.8'}, redirect: 'follow', signal: AbortSignal.timeout(timeout)});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {url: res.url || url, body: type === 'json' ? await res.json() : await res.text()};
}

// ---------- search ----------
const relevant = /sand|gravel|stone|quarr|dredg|balumahal|topsoil|বালু|বালি|পাথর|নুড়ি|ড্রেজ|বালুমহাল|মাটি কাটা|উত্তোলন/i;
const publishers = ['prothomalo.com', 'jugantor.com', 'samakal.com', 'kalerkantho.com', 'ittefaq.com.bd', 'bd-pratidin.com',
  'jagonews24.com', 'banglatribune.com', 'risingbd.com', 'banglanews24.com', 'bssnews.net', 'dhakapost.com', 'somoynews.tv',
  'thedailystar.net', 'tbsnews.net', 'dhakatribune.com', 'newagebd.net', 'bdnews24.com', 'observerbd.com', 'daily-sun.com',
  'today.thefinancialexpress.com.bd', 'bonikbarta.com', 'dailyjanakantha.com', 'manabzamin.com', 'deshrupantor.com'];
const bnTerms = ['অবৈধ বালু উত্তোলন', 'বালু উত্তোলন জরিমানা', 'ড্রেজার দিয়ে বালু', 'বালুমহাল ইজারা', 'পাথর উত্তোলন', 'নদী ভাঙন বালু উত্তোলন', 'কৃষিজমির মাটি কাটা ড্রেজার'];
const enTerms = ['illegal sand extraction', 'sand mining river Bangladesh', 'sand lifting dredger fined', 'balumahal lease', 'stone extraction Sylhet', 'riverbank erosion sand dredging'];

// A different slice of publishers, terms and historical years every day, so runs do not repeat.
function plannedSearches() {
  const n = Math.floor(started.getTime() / 864e5);
  const pick = (list, k, offset = 0) => Array.from({length: k}, (_, i) => list[(n * k + i + offset) % list.length]);
  const recent = new Date(started.getTime() - 14 * 864e5).toISOString().slice(0, 10);
  const plans = [];
  // 1. Newest reporting: open news search, both languages, last 14 days.
  for (const q of pick(bnTerms, 3)) plans.push({query: q, language: 'bn', domain_type: 'news', after_date: recent, label: 'recent'});
  for (const q of pick(enTerms, 2)) plans.push({query: q + ' Bangladesh', language: 'en', domain_type: 'news', after_date: recent, label: 'recent'});
  // 2. Publisher sweep: this run's publishers, current year.
  pick(publishers, 6).forEach((site, i) => {
    const bangla = !/thedailystar|tbsnews|dhakatribune|newagebd|bdnews24|observerbd|daily-sun|financialexpress/.test(site);
    plans.push({query: bangla ? bnTerms[(n + i) % bnTerms.length] : enTerms[(n + i) % enTerms.length], language: bangla ? 'bn' : 'en',
      include_domains: site, after_date: `${started.getUTCFullYear()}-01-01`, label: 'publisher'});
  });
  // 3. Backfill: two earlier years per run, newest first, cycling back to 2010.
  const years = Array.from({length: started.getUTCFullYear() - 2010}, (_, i) => started.getUTCFullYear() - 1 - i);
  for (const [i, year] of pick(years, 2).entries()) {
    plans.push({query: bnTerms[(n + i) % bnTerms.length], language: 'bn', after_date: `${year}-01-01`, before_date: `${year}-12-31`, label: `year ${year}`});
    plans.push({query: enTerms[(n + i) % enTerms.length] + ' Bangladesh', language: 'en', after_date: `${year}-01-01`, before_date: `${year}-12-31`, label: `year ${year}`});
  }
  return plans.slice(0, MAX_SEARCHES);
}

async function tinyfishSearch(plan) {
  const params = new URLSearchParams({query: plan.query});
  for (const k of ['language', 'domain_type', 'include_domains', 'after_date', 'before_date']) if (plan[k]) params.set(k, plan[k]);
  params.set('location', 'BD');
  for (let attempt = 1; attempt <= 3; attempt++) {
    usage.tinyfish.searchRequests++;
    const res = await fetch(`https://api.search.tinyfish.ai?${params}`, {headers: {'X-API-Key': env.TINYFISH_API_KEY}, signal: AbortSignal.timeout(30000)});
    if (res.status === 400 && params.has('location')) { params.delete('location'); continue; } // country code not accepted
    if (res.status === 429 || res.status === 503) { await sleep(5000 * attempt); continue; }
    if (res.status === 402) throw new Error('TinyFish free search allowance used up (HTTP 402)');
    if (!res.ok) throw new Error(`TinyFish search HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return (await res.json()).results ?? [];
  }
  throw new Error('TinyFish search rate limited');
}

const decodeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
async function bing() {
  const out = [];
  for (const q of ['অবৈধ বালু উত্তোলন', 'বালুমহাল', 'sand extraction Bangladesh']) {
    try {
      const {body} = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=${/[ঀ-৿]/.test(q) ? 'bn' : 'en'}&cc=BD`);
      for (const item of body.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
        const field = tag => decodeXml(item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1] ?? '');
        let url = field('link') || field('guid');
        if (!url) continue;
        try { url = new URL(url).searchParams.get('url') || url; } catch {}
        out.push({url, title: field('title'), query: 'Bing News RSS: ' + q, origin: 'bing'});
      }
    } catch (e) { log(`Bing "${q}" failed: ${e.message}`); }
    await sleep(1500);
  }
  return out;
}
async function gdelt() {
  const q = '(sand OR stone OR dredging) (extraction OR mining OR dredger) sourcecountry:bangladesh';
  try {
    const {body} = await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=50&timespan=14d&sort=datedesc`, {type: 'json'});
    return (body.articles ?? []).map(a => ({url: a.url, title: a.title, query: 'GDELT: ' + q, origin: 'gdelt'}));
  } catch (e) { log(`GDELT failed: ${e.message}`); return []; }
}

// ---------- reading ----------
const cleanText = s => String(s ?? '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')         // images
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // links -> text
  .replace(/[*_#>`|]+/g, ' ')
  .normalize('NFC').replace(/\s+/g, ' ').trim();
const isoDay = v => { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10); }; // Bangladesh time
function cleanTitle(t) {
  let s = String(t ?? '').replace(/\s+/g, ' ').trim();
  for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) { const parts = s.split(sep); if (parts.length > 1 && parts.at(-1).length < 40) s = parts.slice(0, -1).join(sep); }
  return s;
}

async function tinyfishFetch(urls) {
  const out = new Map();
  if (!env.TINYFISH_API_KEY || !urls.length) return out;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.fetch.tinyfish.ai', {method: 'POST', signal: AbortSignal.timeout(160000),
      headers: {'X-API-Key': env.TINYFISH_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({urls, format: 'markdown', per_url_timeout_ms: 60000})});
    if (res.status === 429 || res.status === 503) { await sleep(10000 * attempt); continue; }
    if (res.status === 402) { log('TinyFish free fetch allowance used up (HTTP 402); using fallbacks.'); return out; }
    if (!res.ok) { log(`TinyFish fetch HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`); return out; }
    const data = await res.json();
    for (const r of data.results ?? []) {
      usage.tinyfish.fetchURLs++;
      out.set(r.url, {ok: true, via: 'tinyfish', url: r.final_url || r.url, text: cleanText(r.text), title: cleanTitle(r.title), site: '', metaDate: r.published_date || ''});
    }
    for (const e of data.errors ?? []) { usage.tinyfish.fetchFailures++; out.set(e.url, {ok: false, error: `TinyFish ${e.error}${e.status ? ' ' + e.status : ''}`}); }
    return out;
  }
  log('TinyFish fetch rate limited three times; using fallbacks.');
  return out;
}

function metaDates(document) {
  const pick = (...sel) => { for (const s of sel) { const v = document.querySelector(s)?.getAttribute('content'); if (v) return v; } return ''; };
  let published = pick('meta[property="article:published_time"]', 'meta[name="article:published_time"]', 'meta[itemprop="datePublished"]', 'meta[name="publish-date"]', 'meta[name="pubdate"]');
  let modified = pick('meta[property="article:modified_time"]', 'meta[itemprop="dateModified"]', 'meta[property="og:updated_time"]');
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { for (const node of [JSON.parse(s.textContent)].flat().flatMap(n => n['@graph'] ?? [n])) { published ||= node.datePublished ?? ''; modified ||= node.dateModified ?? ''; } } catch {}
  }
  return {published, modified};
}
async function directRead(url) {
  usage.direct.reads++;
  const {url: finalUrl, body} = await get(url);
  const {document} = parseHTML(body);
  const dates = metaDates(document);
  const site = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '';
  const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.querySelector('h1')?.textContent || document.title;
  // Readability drops bylines and datelines, so keep the page's visible date elements separately.
  const dateline = [...new Set([...document.querySelectorAll('time, [itemprop="datePublished"], [class*="date"], [class*="publish"], [class*="time"]')]
    .map(el => cleanText(`${el.textContent} ${el.getAttribute('datetime') ?? el.getAttribute('dateTime') ?? ''}`))
    .filter(s => s.length > 4 && s.length < 140 && /\d|[০-৯]/.test(s)))].slice(0, 6).join(' · ');
  const text = cleanText(new Readability(document).parse()?.textContent);
  if (text.length < 600) throw new Error(`direct read too short (${text.length} chars)`);
  return {ok: true, via: 'direct', url: finalUrl, text: dateline ? `Page dateline: ${dateline}\n\n${text}` : text, title: cleanTitle(title), site,
    metaDate: dates.published || '', metaModified: dates.modified || '', publisherMeta: Boolean(dates.published)};
}

let firecrawlLeft = 0;
async function firecrawlBalance() {
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', {headers: {'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`}, signal: AbortSignal.timeout(20000)});
    const data = await res.json();
    const left = data?.data?.remainingCredits ?? data?.data?.remaining_credits;
    return typeof left === 'number' ? left : null;
  } catch { return null; }
}
async function firecrawlRead(url, reason) {
  if (!env.FIRECRAWL_API_KEY || firecrawlLeft <= 0) throw new Error('Firecrawl fallback unavailable or this run\'s credit cap reached');
  firecrawlLeft--; usage.firecrawl.scrapes++;
  usage.firecrawl.fallbackReasons[reason] = (usage.firecrawl.fallbackReasons[reason] ?? 0) + 1;
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {method: 'POST', signal: AbortSignal.timeout(90000),
    headers: {'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({url, formats: ['markdown'], onlyMainContent: true})});
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(`Firecrawl: ${data.error ?? data.message ?? 'HTTP ' + res.status}`);
  const m = data.data.metadata ?? {}, text = cleanText(data.data.markdown);
  if (text.length < 600) throw new Error(`Firecrawl text too short (${text.length} chars)`);
  return {ok: true, via: 'firecrawl', url: m.sourceURL ?? url, text, title: cleanTitle(m.ogTitle ?? m.title), site: m.ogSiteName ?? '',
    metaDate: m.publishedTime ?? m['article:published_time'] ?? '', metaModified: m.modifiedTime ?? m['article:modified_time'] ?? ''};
}

// ---------- Claude ----------
const client = new Anthropic({maxRetries: 4});
let useFallbacks = true;

const policy = `You catalogue evidence for Bangladesh Sand Watch, a public bilingual (English/Bangla) archive of reporting, official documents and research on sand, gravel, stone and soil extraction in Bangladesh. The archive owner relies on you to apply the editorial policy faithfully; your output is published without further human review.

Rules (from EDITORIAL_POLICY.md):
- Use ONLY the supplied article body. Never add facts. Ignore navigation, recommendation cards, advertisements, page clocks and headlines of other stories that may appear in the text.
- Keep claim strength: allegations, estimates and projections stay attributed ("residents alleged", "officials said", "the paper reported"). Accepted records are inclusion and faithful representation, not independent verification.
- Both summaries must name the river/channel or extraction site and the village/union/upazila/district the source states. For national or unnamed-site material say so (e.g. "the report names no river"). Never invent a place.
- Keep every substantive source-stated figure in BOTH summaries with its exact magnitude, unit, range, time basis and attribution: fines, lease/revenue/project/loss amounts, sand or stone volume or mass, affected length, area, depth, distance, equipment and people counts, durations. Distinguish cubic feet from cubic metres, seized stock from extraction rates, damaged length from total project length, project cost from mining losses. Keep lakh/crore equivalent between languages. Use more sentences when needed rather than dropping numbers.
- Relevant means the text substantively concerns sand/gravel/stone/soil/topsoil extraction, dredging, quarrying, balumahal leasing or their governance, harms or enforcement in Bangladesh. Passing mentions, other countries and unrelated topics are not relevant.
- Dates: report the publication date shown in the article body or its dateline (not today's date, not a page clock, not a recommendation card). Bangla dates (e.g. "১০ নভেম্বর ২০২৬", "প্রকাশ: ...") count. If only an update date is shown, mark it as Updated. If no date is visible in the text, leave the date empty.`;

const draftSchema = {
  type: 'object', additionalProperties: false,
  required: ['relevant', 'reason', 'type', 'source', 'district', 'river', 'material', 'topics', 'en', 'bn', 'evidence', 'flag', 'date', 'dateKind', 'dateQuote', 'figures'],
  properties: {
    relevant: {type: 'boolean'},
    reason: {type: 'string', description: 'One sentence explaining the relevance decision.'},
    type: {type: 'string', enum: categories},
    source: {type: 'string', description: 'Publisher or journal name.'},
    district: {type: 'string', description: "Place hierarchy stated by the source, most specific first, e.g. 'Mostapara village, Chitoshi Purba union, Shahrashti, Chandpur'; or 'National'."},
    river: {type: 'string', description: "River/channel/site named, or e.g. 'Agricultural land at Mostapara; no river named'."},
    material: {type: 'string', description: "Sand, Stone, Gravel, Soil, Topsoil, or a '; ' list."},
    topics: {type: 'string', description: "2-5 short topics separated by '; '."},
    en: {type: 'string', description: 'Attributed English summary with named site, place and all substantive figures.'},
    bn: {type: 'string', description: 'The same content in natural Bangla, same places, figures, units and attribution.'},
    evidence: {type: 'string', description: 'What the text rests on, e.g. officials quoted, reporter site visit, court order.'},
    flag: {type: 'string', description: "Limitations a reader should know, e.g. 'Allegations by residents', 'Updated date only', or ''."},
    date: {type: 'string', description: 'YYYY-MM-DD read from the article text, or empty.'},
    dateKind: {type: 'string', enum: ['Published', 'Updated', '']},
    dateQuote: {type: 'string', description: 'The exact characters of the date line copied from the text, or empty.'},
    figures: {type: 'array', description: 'Every figure used in the summaries, each copied verbatim from the text.', items: {
      type: 'object', additionalProperties: false, required: ['quote', 'meaning'],
      properties: {quote: {type: 'string', description: 'Exact short excerpt from the text containing the figure.'}, meaning: {type: 'string'}}}},
  },
};
const reviewSchema = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'issues', 'duplicateOf', 'en', 'bn'],
  properties: {
    verdict: {type: 'string', enum: ['pass', 'revise', 'reject']},
    issues: {type: 'array', items: {type: 'string'}},
    duplicateOf: {type: 'string', description: 'ID of an existing record reporting the same incident/action, or empty.'},
    en: {type: 'string', description: 'Corrected English summary when verdict is revise, else empty.'},
    bn: {type: 'string', description: 'Corrected Bangla summary when verdict is revise, else empty.'},
  },
};

async function ask(prompt, schema, effort) {
  if (usage.claude.calls >= MAX_MODEL_CALLS) throw new Error('model call budget reached');
  usage.claude.calls++;
  const req = {
    model: MODEL, max_tokens: 16000,
    system: [{type: 'text', text: policy, cache_control: {type: 'ephemeral'}}],
    messages: [{role: 'user', content: prompt}],
    output_config: {effort, format: {type: 'json_schema', schema}},
    ...(useFallbacks ? {betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'} : {}),
  };
  const res = await client.beta.messages.create(req);
  usage.claude.inputTokens += res.usage.input_tokens ?? 0;
  usage.claude.outputTokens += res.usage.output_tokens ?? 0;
  usage.claude.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
  if (res.stop_reason === 'refusal') throw new Error(`model refusal (${res.stop_details?.category ?? 'no category'})`);
  if (res.stop_reason === 'max_tokens') throw new Error('model output hit max_tokens');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

async function probeModel() {
  for (const fallbacks of [true, false]) {
    useFallbacks = fallbacks;
    try {
      const out = await ask('Reply with {"verdict":"pass","issues":[],"duplicateOf":"","en":"","bn":""}.', reviewSchema, 'low');
      if (out.verdict) { log(`Claude ${MODEL} ready${fallbacks ? ' (server-side refusal fallback on)' : ''}.`); return true; }
    } catch (e) {
      log(`Claude probe${fallbacks ? ' with fallbacks' : ''} failed: ${e.message}`);
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return false;
    }
  }
  return false;
}

// ---------- checks ----------
const norm = s => cleanText(s).toLowerCase();
const inText = (quote, text) => quote && norm(text).includes(norm(quote));
const bangla = /[ঀ-৿]/;
const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 4000);
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

// Existing records that might report the same incident: same district/river words, nearby date.
function nearbyRecords(draft, pool) {
  const words = new Set(`${draft.district} ${draft.river}`.toLowerCase().split(/[^a-zঀ-৿']+/).filter(w => w.length > 3 && !/river|union|village|upazila|district|national|named/.test(w)));
  return pool.filter(r => {
    const place = `${r.district} ${r.river}`.toLowerCase();
    if (![...words].some(w => place.includes(w))) return false;
    return !draft.date || !r.date || dayDiff(draft.date, r.date) <= 45;
  }).slice(-15);
}

// ---------- main ----------
if (!env.ANTHROPIC_API_KEY) { log('ANTHROPIC_API_KEY is not set. Nothing was collected.'); process.exit(1); }
if (!env.TINYFISH_API_KEY) log('! TINYFISH_API_KEY is not set: using free search sources and direct reads only.');
if (!await probeModel()) { log('No working Claude endpoint. Nothing was collected or saved.'); process.exit(1); }
if (env.FIRECRAWL_API_KEY) {
  usage.firecrawl.before = await firecrawlBalance();
  firecrawlLeft = usage.firecrawl.before == null ? Math.min(MAX_FIRECRAWL, 3) : Math.max(0, Math.min(MAX_FIRECRAWL, usage.firecrawl.before - FIRECRAWL_FLOOR));
  log(`Firecrawl balance ${usage.firecrawl.before ?? 'unknown'}; fallback cap this run ${firecrawlLeft}.`);
}

const archive = loadArchive({log: () => {}});
const knownUrls = new Set();
for (const r of archive.records) for (const u of [r.url, r.alternateUrl]) { try { if (u) knownUrls.add(canonicalUrl(u)); } catch {} }
const knownIds = new Set(archive.records.map(r => r.id));
const priorDiscovery = new Map();
for (const d of archive.discovery) { try { const u = canonicalUrl(d.url); const old = priorDiscovery.get(u); if (!old || String(d.loggedAt ?? '') > String(old.loggedAt ?? '')) priorDiscovery.set(u, d); } catch {} }
const retryable = new Set(['Awaiting retrieval', 'Awaiting source review', 'Retry', 'Body missing', 'Date unresolved', 'Failed retrieval', 'Deferred']);

// 1. Search
const searches = [], hits = [];
if (env.TINYFISH_API_KEY) {
  for (const [i, plan] of plannedSearches().entries()) {
    const entry = {id: `${runId}-search-${i + 1}`, query: plan.query, filters: Object.fromEntries(Object.entries(plan).filter(([k]) => !['query', 'label'].includes(k))),
      label: plan.label, checkedAt: new Date().toISOString(), collector: 'github-actions', retrievalProvider: 'tinyfish'};
    try {
      const results = await tinyfishSearch(plan);
      Object.assign(entry, {status: 'Checked', count: results.length});
      results.forEach((r, rank) => hits.push({url: r.url, title: r.title, snippetDate: r.date ?? '', query: plan.query, rank: rank + 1, origin: 'tinyfish'}));
    } catch (e) {
      Object.assign(entry, {status: 'Failed', count: 0, error: e.message});
      log(`! search "${plan.query}": ${e.message}`);
      if (/allowance/.test(e.message)) { searches.push(entry); break; }
    }
    searches.push(entry);
    await sleep(2200); // stays under 30 searches/minute
  }
}
hits.push(...await bing(), ...await gdelt());
// Video and social pages carry no article body to read, so they never become records.
const notArticle = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|x\.com|twitter\.com|scribd\.com|academia\.edu)$/;
const backlog = archive.discovery.filter(d => retryable.has(d.status) && d.url && (d.autoAttempts ?? 0) < 3 && !notArticle.test(hostOf(d.url)))
  .map(d => ({url: d.url, title: d.title, query: d.query ?? 'backlog', origin: 'backlog', prior: d}));

// 2. Candidates: new, relevant-looking, not archived, publisher round-robin so one site cannot use the budget.
const seen = new Set(), byHost = new Map();
for (const c of [...hits, ...backlog]) {
  let url; try { url = canonicalUrl(c.url); } catch { continue; }
  if (seen.has(url) || knownUrls.has(url) || knownIds.has(keyFor(url)) || notArticle.test(hostOf(url))) continue;
  if (c.origin !== 'backlog' && !relevant.test(c.title ?? '')) continue;
  const prior = c.prior ?? priorDiscovery.get(url);
  if (prior && c.origin !== 'backlog' && (!retryable.has(prior.status) || (prior.autoAttempts ?? 0) >= 3)) continue;
  seen.add(url);
  const host = hostOf(url);
  if (!byHost.has(host)) byHost.set(host, []);
  byHost.get(host).push({...c, url, prior});
}
const queues = [...byHost.values()], candidates = [];
for (let i = 0; queues.some(q => q.length); i++) { const q = queues[i % queues.length]; if (q.length) candidates.push(q.shift()); }
log(`Searches ${searches.length}, hits ${hits.length}, candidates ${candidates.length} (backlog ${candidates.filter(c => c.origin === 'backlog').length}).`);

// 3-4. Read, draft, review
const records = [], reviews = {}, editorialReviews = {}, discovery = [], errors = [];
const logEntry = (c, status, reason, recordId) => discovery.push({
  ...(c.prior ?? {}), id: c.prior?.id ?? `gha-${hash(c.url).slice(0, 16)}`, url: c.url, title: c.prior?.title ?? c.title ?? c.url,
  query: c.prior?.query ?? c.query, rank: c.rank, status, reason, recordId: recordId ?? c.prior?.recordId,
  autoAttempts: (c.prior?.autoAttempts ?? 0) + (status === 'Awaiting retrieval' ? 0 : 1),
  loggedAt: stamp, collector: 'github-actions', runId});

let fetched = 0, modelFailures = 0;
for (let start = 0; start < candidates.length && records.length < MAX_RECORDS && fetched < MAX_FETCHES; start += 10) {
  const batch = candidates.slice(start, Math.min(start + 10, start + MAX_FETCHES - fetched));
  fetched += batch.length;
  const tf = await tinyfishFetch(batch.map(c => c.url));
  for (const c of batch) {
    if (records.length >= MAX_RECORDS) { logEntry(c, 'Awaiting retrieval', 'record limit for this run reached'); continue; }
    try {
      // Read: TinyFish, then direct, then Firecrawl.
      let page = tf.get(c.url), why = page?.ok ? '' : (page?.error ?? 'no TinyFish result');
      if (page?.ok && page.text.length < 600) { why = 'TinyFish body too short'; page = null; }
      if (!page?.ok) { try { page = await directRead(c.url); } catch (e) { why += `; direct: ${e.message}`; page = null; } }
      if (!page?.ok) { try { page = await firecrawlRead(c.url, 'blocked_or_incomplete'); } catch (e) { why += `; ${e.message}`; } }
      if (!page?.ok) { logEntry(c, 'Failed retrieval', why); errors.push(`${c.url}: ${why}`); continue; }
      if (notArticle.test(hostOf(page.url))) { logEntry(c, 'Excluded', 'redirects to a video or social media page'); continue; }
      try { const finalUrl = canonicalUrl(page.url); if (knownUrls.has(finalUrl) || knownIds.has(keyFor(finalUrl))) { logEntry(c, 'Already archived', 'redirects to an archived URL', keyFor(finalUrl)); continue; } } catch { page.url = c.url; }
      if (!relevant.test(page.title + ' ' + page.text.slice(0, 5000))) { logEntry(c, 'Excluded', 'no extraction terms in article body'); continue; }

      const body = page.text.length > MAX_TEXT ? page.text.slice(0, MAX_TEXT) : page.text;
      const prompt = p => `Source URL: ${p.url}\nPage title: ${p.title}\nSite: ${p.site || hostOf(p.url)}\nProvider date metadata (a hint only, not evidence): ${p.metaDate || 'none'}${p.text.length > MAX_TEXT ? `\nNote: body truncated to the first ${MAX_TEXT} of ${p.text.length} characters.` : ''}\n\nArticle body:\n${p.text.slice(0, MAX_TEXT)}\n\nDecide relevance, then draft the archive record as JSON.`;
      let draft = await ask(prompt({...page, text: body}), draftSchema, 'medium');
      modelFailures = 0;
      if (!draft.relevant) { logEntry(c, 'Excluded', `not relevant: ${draft.reason}`); continue; }

      // Date: the date line must really be in the article; otherwise try Firecrawl once for a fuller page.
      let dateOk = draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && inText(draft.dateQuote, page.text);
      let dateSource = 'article text';
      // Next: the publisher's own page metadata (article:published_time / JSON-LD datePublished),
      // read directly from the original page. TinyFish's extracted date alone is only a hint.
      if (!dateOk) {
        let own = page.publisherMeta ? page : null;
        if (!own && page.via === 'tinyfish') { try { own = await directRead(c.url); } catch {} }
        const d = own?.publisherMeta ? isoDay(own.metaDate) : '';
        if (d) { Object.assign(draft, {date: d, dateKind: 'Published', dateQuote: `page metadata: ${own.metaDate}`}); dateOk = true; dateSource = 'publisher page metadata'; }
      }
      if (!dateOk && page.via !== 'firecrawl') {
        try {
          const fuller = await firecrawlRead(c.url, 'publisher_date_omitted');
          const second = await ask(prompt(fuller), draftSchema, 'medium');
          if (second.relevant && second.date && inText(second.dateQuote, fuller.text)) { page = fuller; draft = second; dateOk = true; }
        } catch (e) { log(`  date fallback for ${c.url}: ${e.message}`); }
      }
      const meta = isoDay(page.metaDate);
      if (!dateOk) { logEntry(c, 'Date unresolved', 'no publication date visible in the article body'); continue; }
      if (meta && draft.dateKind === 'Published' && dateSource === 'article text' && dayDiff(meta, draft.date) > 2) { logEntry(c, 'Date unresolved', `article shows ${draft.date} but metadata says ${meta}`); continue; }

      // Figures and basic shape.
      const missing = draft.figures.filter(f => !inText(f.quote, page.text));
      if (missing.length) { logEntry(c, 'Deferred', `figure quotes not found in the article: ${missing.map(f => f.quote).join(' | ').slice(0, 300)}`); continue; }
      if (!bangla.test(draft.bn) || draft.en.length < 60 || draft.bn.length < 40) { logEntry(c, 'Deferred', 'summary missing or too short'); continue; }

      // Editorial review + incident-level dedup.
      const pool = [...archive.records, ...records];
      const near = nearbyRecords(draft, pool);
      const reviewPrompt = (en, bn) => `Article body:\n${page.text.slice(0, MAX_TEXT)}\n\nDraft record:\n${JSON.stringify({type: draft.type, date: draft.date, district: draft.district, river: draft.river, material: draft.material, en, bn, evidence: draft.evidence, flag: draft.flag}, null, 1)}\n\nExisting archive records that may report the same incident:\n${near.length ? near.map(r => `- ${r.id} | ${r.date || 'undated'} | ${r.district} | ${r.river} | ${String(r.en).slice(0, 300)}`).join('\n') : '(none)'}\n\nAct as the editor. Check that: the record is relevant; both summaries name the river/site and stated places; every substantive figure in the article is present, correct and identically stated in both languages (units, lakh/crore, ranges, time basis); allegations stay attributed; nothing is added beyond the article; type and date fit. If it is the same incident or action as an existing record (repeat, translated or syndicated coverage) set duplicateOf; a distinct dated follow-up with new evidence is not a duplicate. Verdict: pass if publishable as is; revise if only the summaries need fixing (give corrected en and bn); reject if not publishable.`;
      let rev = await ask(reviewPrompt(draft.en, draft.bn), reviewSchema, 'high');
      let en = draft.en, bn = draft.bn, revised = false;
      if (rev.verdict === 'revise' && bangla.test(rev.bn) && rev.en.length >= 60) {
        en = rev.en; bn = rev.bn; revised = true;
        rev = await ask(reviewPrompt(en, bn), reviewSchema, 'high');
      }
      if (rev.duplicateOf && pool.some(r => r.id === rev.duplicateOf)) { logEntry(c, 'Already archived', `same incident as ${rev.duplicateOf}`, rev.duplicateOf); continue; }
      if (rev.verdict !== 'pass') { logEntry(c, 'Deferred', `editorial review: ${rev.issues.join('; ').slice(0, 400) || rev.verdict}`); continue; }

      const url = canonicalUrl(page.url.startsWith('http') ? page.url : c.url), id = keyFor(url);
      if (knownIds.has(id) || records.some(r => r.id === id)) { logEntry(c, 'Already archived', 'duplicate canonical URL', id); continue; }
      const record = {
        source: clean(draft.source) || page.site || hostOf(url), title: clean(page.title) || clean(c.title), date: draft.date, dateKind: draft.dateKind,
        district: clean(draft.district), river: clean(draft.river), material: clean(draft.material), topics: clean(draft.topics),
        language: (page.text.match(/[ঀ-৿]/g)?.length ?? 0) > page.text.length * 0.3 ? 'Bangla' : 'English',
        en: clean(en), bn: clean(bn), evidence: clean(draft.evidence), flag: clean(draft.flag), id, url, type: draft.type,
        documentId: '', otherDate: meta && meta !== draft.date ? `Metadata ${meta}` : '', alternateUrl: '',
        notes: `Collected ${day} by GitHub Actions (${page.via} read, ${page.text.length} characters); summaries by ${MODEL}; editorial review passed${revised ? ' after revision' : ''}.`,
        decision: 'Accept', reviewNotes: '', collectedAt: new Date().toISOString(), auto: true, collector: 'github-actions'};
      if (!record.title || !categories.includes(record.type)) { logEntry(c, 'Deferred', 'missing title or invalid type'); continue; }
      records.push(record);
      reviews[id] = {decision: 'Accept', notes: '', auto: true, reviewer: `github-actions:${MODEL}`, reviewedAt: record.collectedAt};
      editorialReviews[id] = {decision: 'Accept', reviewer: `github-actions:${MODEL}`, reviewedAt: record.collectedAt,
        sourceReads: [{provider: page.via, sourceUrl: page.url, sourceBodySha256: hash(page.text), sourceCharacters: page.text.length, usedAsArticleEvidence: true}],
        dateEvidence: {source: dateSource, quote: draft.dateQuote, metadata: page.metaDate || ''},
        figureQuotes: draft.figures.map(f => f.quote), incidentCandidates: near.map(r => r.id), revised,
        checksPassed: ['original article body read', `publication date from ${dateSource}`, 'every figure quote found in article body', 'bilingual places, figures and attribution reviewed', 'canonical URL and incident-level deduplication']};
      logEntry(c, 'Added', 'article body, date and figures checked; editorial review passed', id);
      log(`+ ${id} ${record.date} ${record.source}: ${record.title.slice(0, 80)}`);
    } catch (e) {
      errors.push(`${c.url}: ${e.message}`); log(`! ${c.url}: ${e.message}`);
      logEntry(c, 'Retry', e.message.slice(0, 200));
      if (/budget/.test(e.message)) break;
      if (e instanceof Anthropic.APIError && ++modelFailures >= 3) { log('Three model errors in a row; stopping.'); break; }
    }
  }
  if (modelFailures >= 3 || usage.claude.calls >= MAX_MODEL_CALLS) break;
}
for (const c of candidates) if (!discovery.some(d => d.url === c.url) && c.origin !== 'backlog') logEntry(c, 'Awaiting retrieval', 'found by search; not processed this run');

// 5. Save
if (env.FIRECRAWL_API_KEY && usage.firecrawl.scrapes) usage.firecrawl.after = await firecrawlBalance();
const cost = (usage.claude.inputTokens * 2 + usage.claude.outputTokens * 10 + usage.claude.cacheReadTokens * 0.1) / 1e6;
const run = {
  id: runId, startedAt: stamp, finishedAt: new Date().toISOString(), status: errors.length ? 'partial' : 'completed',
  collector: 'github-actions', retrievalProvider: 'tinyfish-first', fallbackProvider: 'firecrawl', model: MODEL,
  found: candidates.length, added: records.length, fetches: fetched,
  duplicates: discovery.filter(d => d.status === 'Already archived').length,
  deferred: discovery.filter(d => ['Deferred', 'Date unresolved'].includes(d.status)).length,
  recordIds: records.map(r => r.id), queries: searches.map(s => s.query), creditUsage: usage, estimatedModelCostUSD: Number(cost.toFixed(3)),
  editorialDecision: 'Accept', editorialReviewer: `github-actions:${MODEL}`, errors: errors.slice(0, 20)};
log(`Run ${runId}: ${records.length} added, ${run.duplicates} duplicates, ${run.deferred} deferred, ${errors.length} errors; Claude ${usage.claude.calls} calls (~$${cost.toFixed(2)}), TinyFish ${usage.tinyfish.searchRequests} searches / ${usage.tinyfish.fetchURLs} fetches, Firecrawl ${usage.firecrawl.scrapes} scrapes.`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = records.map(r => `| ${r.date} | ${r.source} | [${r.title.replace(/\|/g, '/').slice(0, 90)}](${r.url}) | ${r.river.replace(/\|/g, '/').slice(0, 50)} |`).join('\n');
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## Collector run ${runId}${DRY_RUN ? ' (dry run, nothing saved)' : ''}\n\n` +
    `**${records.length} new records**, ${run.duplicates} duplicates, ${run.deferred} deferred, ${errors.length} errors.\n\n` +
    `Claude ${MODEL}: ${usage.claude.calls} calls, about $${cost.toFixed(2)}. TinyFish: ${usage.tinyfish.searchRequests} searches, ${usage.tinyfish.fetchURLs} fetched URLs. ` +
    `Firecrawl: ${usage.firecrawl.scrapes} scrapes (balance ${usage.firecrawl.before ?? '–'} → ${usage.firecrawl.after ?? usage.firecrawl.before ?? '–'}).\n\n` +
    (rows ? `| Date | Source | Title | River/site |\n|---|---|---|---|\n${rows}\n` : '') +
    (errors.length ? `\n<details><summary>Errors</summary>\n\n${errors.slice(0, 30).map(e => '- ' + e.replace(/[<>]/g, '')).join('\n')}\n</details>\n` : ''));
}
if (!DRY_RUN && (records.length || discovery.length)) {
  const file = path.join(root, 'snapshots', `${day}-github-actions-${hhmm}.json`);
  writeFileSync(file, JSON.stringify({records, reviews, runs: [run], searches, discovery, editorialReviews}, null, 1));
  log(`Wrote ${path.relative(root, file)}`);
}
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `added=${records.length}\nids=${records.map(r => r.id).join(',')}\n`);
if (modelFailures >= 3 && !records.length) process.exitCode = 1;
