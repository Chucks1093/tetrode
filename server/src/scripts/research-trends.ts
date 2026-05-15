import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../utils/prisma.utils';

type TrendRecord = {
   id: string;
   title: string;
   url: string;
   category: string;
   publishedAt: Date | null;
   capturedAt: Date;
};

type SourceType =
   | 'official_statement'
   | 'news_article'
   | 'social_post'
   | 'repo'
   | 'other';

type Reliability = 'HIGH' | 'MEDIUM' | 'LOW';

type CandidateSource = {
   url: string;
   title: string;
   publisher: string;
   publishedAt: string | null;
   snippet: string;
   imageUrl: string | null;
   sourceType: SourceType;
   reliability: Reliability;
   relevance: number;
};

type NormalizedSource = {
   url: string;
   title: string;
   publisher: string;
   published_at: string | null;
   snippet: string;
   image_url: string | null;
   source_type: SourceType;
   reliability: Reliability;
};

type TrendSourcesOutput = {
   trend_id: string;
   trend_title: string;
   query: string;
   sources: NormalizedSource[];
   total_sources: number;
};

type PersistedTrendOutput = TrendSourcesOutput & {
   stored_sources: number;
};

type GoogleNewsItem = {
   title?: string;
   link?: string;
   pubDate?: string;
};

type HNHit = {
   title?: string;
   url?: string;
   story_url?: string;
   created_at?: string;
};

type HNResponse = {
   hits?: HNHit[];
};

type RedditPost = {
   title?: string;
   url?: string;
   selftext?: string;
   created_utc?: number;
};

type RedditListing = {
   data?: {
      children?: Array<{ data?: RedditPost }>;
   };
};

type GenericRssItem = {
   title?: string;
   link?: string;
   pubDate?: string;
   description?: string;
};

type GuardianSearchResponse = {
   response?: {
      results?: Array<{
         webTitle?: string;
         webUrl?: string;
         webPublicationDate?: string;
         fields?: {
            trailText?: string;
            thumbnail?: string;
            headline?: string;
         };
      }>;
   };
};

type GdeltSearchResponse = {
   articles?: Array<{
      url?: string;
      title?: string;
      seendate?: string;
      domain?: string;
      image?: string;
      socialimage?: string;
   }>;
};

type FirecrawlScrapeResponse = {
   success?: boolean;
   data?: {
      markdown?: string;
      metadata?: {
         title?: string;
         description?: string;
         sourceURL?: string;
         url?: string;
         ogImage?: string;
         twitterImage?: string;
      };
   };
   error?: string;
};

const TARGET_TOTAL_SOURCES = 7;
const TREND_LIMIT = Number(process.env.TRENDS_RESEARCH_LIMIT ?? '8');
const MAX_EXPANSION_PAGES = 6;
const MAX_LINKS_PER_PAGE = 8;
const MIN_RELEVANCE_SCORE = Number(
   process.env.TRENDS_MIN_RELEVANCE_SCORE ?? '0.14'
);
const LOW_RELIABILITY_MIN_RELEVANCE = Number(
   process.env.TRENDS_LOW_RELIABILITY_MIN_RELEVANCE ?? '0.28'
);
const MAX_SOURCES_PER_DOMAIN = 2;
const MIN_FINAL_SOURCES = Number(process.env.TRENDS_MIN_FINAL_SOURCES ?? '5');
const REQUEST_TIMEOUT_MS = 8000;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_BASE =
   process.env.FIRECRAWL_API_BASE_URL ?? 'https://api.firecrawl.dev/v2';
const FIRECRAWL_TIMEOUT_MS = Number(
   process.env.FIRECRAWL_TIMEOUT_MS ?? '12000'
);
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;
const GDELT_MAX_RECORDS = Number(process.env.GDELT_MAX_RECORDS ?? '20');
const GUARDIAN_PAGE_SIZE = Number(process.env.GUARDIAN_PAGE_SIZE ?? '20');

const PUBLISHER_RSS_FEEDS: Array<{ category: string; url: string }> = [
   { category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
   { category: 'business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
   { category: 'world', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
   { category: 'business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
   { category: 'tech', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
   { category: 'world', url: 'https://feeds.npr.org/1001/rss.xml' },
   { category: 'tech', url: 'https://developers.cloudflare.com/changelog/rss.xml' },
   { category: 'tech', url: 'https://dev.to/feed/tag/ai' },
   { category: 'tech', url: 'https://dev.to/feed/tag/vibecoding' },
   { category: 'tech', url: 'https://medium.com/feed/tag/ai' },
   { category: 'tech', url: 'https://medium.com/feed/tag/vibecoding' },
   { category: 'tech', url: 'https://aws.amazon.com/blogs/aws/feed/' },
   { category: 'tech', url: 'https://developers.googleblog.com/atom.xml' },
   { category: 'tech', url: 'https://hnrss.org/frontpage' },
   { category: 'tech', url: 'https://huggingface.co/blog/feed.xml' },
   { category: 'tech', url: 'https://openai.com/news/rss.xml' },
   { category: 'tech', url: 'https://www.anthropic.com/news/rss.xml' },
];

const TECH_DISCOVERY_SEED_URLS: Array<{ title: string; publisher: string; url: string }> = [
   {
      title: 'Cloudflare Core Platform Changelog',
      publisher: 'developers.cloudflare.com',
      url: 'https://developers.cloudflare.com/changelog/',
   },
   { title: 'DEV Community AI', publisher: 'dev.to', url: 'https://dev.to/t/ai' },
   {
      title: 'DEV Community Vibe Coding',
      publisher: 'dev.to',
      url: 'https://dev.to/t/vibecoding',
   },
   { title: 'Virlo Top Videos', publisher: 'virlo.ai', url: 'https://virlo.ai/' },
   { title: 'Medium AI', publisher: 'medium.com', url: 'https://medium.com/tag/ai' },
   {
      title: 'Medium Vibe Coding',
      publisher: 'medium.com',
      url: 'https://medium.com/tag/vibecoding',
   },
   { title: 'Amazon AWS Blogs', publisher: 'aws.amazon.com', url: 'https://aws.amazon.com/blogs/' },
   { title: 'Manus Blog', publisher: 'manus.im', url: 'https://manus.im/blog' },
   {
      title: 'Google Developers Blog',
      publisher: 'developers.googleblog.com',
      url: 'https://developers.googleblog.com/',
   },
   {
      title: 'Hacker News',
      publisher: 'news.ycombinator.com',
      url: 'https://news.ycombinator.com/',
   },
   { title: 'Hugging Face Blog', publisher: 'huggingface.co', url: 'https://huggingface.co/blog' },
   { title: 'Ollama Blog', publisher: 'ollama.com', url: 'https://ollama.com/blog' },
   {
      title: 'DeepSeek News',
      publisher: 'api-docs.deepseek.com',
      url: 'https://api-docs.deepseek.com/updates/',
   },
   { title: 'Meta AI Blog', publisher: 'ai.meta.com', url: 'https://ai.meta.com/blog/' },
   { title: 'Kiro Blog', publisher: 'kiro.dev', url: 'https://kiro.dev/blog/' },
   { title: 'OpenAI News', publisher: 'openai.com', url: 'https://openai.com/news/' },
   {
      title: 'Anthropic News',
      publisher: 'anthropic.com',
      url: 'https://www.anthropic.com/news',
   },
];

const STOPWORDS = new Set([
   'the',
   'a',
   'an',
   'is',
   'are',
   'was',
   'were',
   'to',
   'of',
   'for',
   'on',
   'in',
   'at',
   'by',
   'with',
   'and',
   'or',
   'from',
   'as',
   'has',
   'have',
   'had',
   'after',
   'into',
   'over',
   'under',
   'this',
   'that',
   'it',
   'its',
   'their',
   'his',
   'her',
   'be',
   'been',
   'being',
   'will',
   'would',
   'could',
   'should',
   'about',
   'just',
   'new',
]);

const TRUSTED_NEWS_DOMAINS = [
   'reuters.com',
   'apnews.com',
   'bbc.com',
   'ft.com',
   'wsj.com',
   'nytimes.com',
   'cnbc.com',
   'bloomberg.com',
   'aljazeera.com',
   'politico.com',
   'theguardian.com',
];

const BLOCKED_DOMAINS = [
   'google-analytics.com',
   'googletagmanager.com',
   'doubleclick.net',
   'googleusercontent.com',
   'googleapis.com',
   'gstatic.com',
   'facebook.com',
   'fbcdn.net',
   'scorecardresearch.com',
];

const canonicalUrlCache = new Map<string, string>();

function normalizeWhitespace(value: string): string {
   return value.replace(/\s+/g, ' ').trim();
}

function stripTags(html: string): string {
   return normalizeWhitespace(html.replace(/<[^>]+>/g, ' '));
}

function sanitizeTextForDb(value: string): string {
   return normalizeWhitespace(value.replace(/[\u0000-\u001F\u007F]/g, ' '));
}

function sanitizeUrlForDb(value: string): string {
   return value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function extractTokens(value: string): string[] {
   return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function isTechTrend(trend: TrendRecord): boolean {
   const category = trend.category.toLowerCase();
   if (category.includes('tech')) return true;
   const title = trend.title.toLowerCase();
   return (
      title.includes('ai') ||
      title.includes('artificial intelligence') ||
      title.includes('model') ||
      title.includes('software') ||
      title.includes('app') ||
      title.includes('cloud')
   );
}

function buildTrendQuery(title: string): string {
   const tokens = extractTokens(title);
   const unique = Array.from(new Set(tokens)).slice(0, 8);
   return unique.length > 0 ? unique.join(' ') : title;
}

function parseDate(value?: string): string | null {
   if (!value) return null;
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateOrNull(value: string | null): Date | null {
   if (!value) return null;
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
   return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(
         () => reject(new Error(`Request timed out after ${ms}ms`)),
         ms
      );
      promise
         .then(value => {
            clearTimeout(timeoutId);
            resolve(value);
         })
         .catch(error => {
            clearTimeout(timeoutId);
            reject(error);
         });
   });
}

function normalizeUrl(rawUrl: string): string | null {
   try {
      const parsed = new URL(rawUrl);
      parsed.hash = '';
      const removable = [
         'utm_source',
         'utm_medium',
         'utm_campaign',
         'utm_term',
         'utm_content',
         'fbclid',
         'gclid',
         'oc',
         'ref',
         'hl',
         'gl',
         'ceid',
      ];
      removable.forEach(key => parsed.searchParams.delete(key));
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      const normalized = parsed.toString();
      return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
   } catch {
      return null;
   }
}

function isLikelyArticleUrl(url: string): boolean {
   const domain = getDomain(url);
   if (!domain) return false;
   if (BLOCKED_DOMAINS.some(blocked => domain.includes(blocked))) {
      return false;
   }
   const path = (() => {
      try {
         return new URL(url).pathname.toLowerCase();
      } catch {
         return '';
      }
   })();
   const blockedExt = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
      '.ico',
      '.mp4',
      '.mov',
      '.mp3',
      '.wav',
      '.js',
      '.mjs',
      '.css',
      '.json',
      '.map',
      '.xml',
      '.woff',
      '.woff2',
      '.ttf',
   ];
   return !blockedExt.some(ext => path.endsWith(ext));
}

function isGoogleNewsWrapper(url: string): boolean {
   const domain = getDomain(url);
   return domain === 'news.google.com' && url.includes('/rss/articles/');
}

function extractFirstExternalUrlFromGoogleNewsHtml(html: string): string | null {
   const matches = html.match(/https?:\/\/[^\s"'<>\\]+/g) ?? [];
   for (const raw of matches) {
      const normalized = normalizeUrl(raw);
      if (!normalized) continue;
      const domain = getDomain(normalized);
      if (!domain) continue;
      if (
         domain.includes('google.com') ||
         domain.includes('gstatic.com') ||
         domain.includes('googleusercontent.com')
      ) {
         continue;
      }
      if (!isLikelyArticleUrl(normalized)) continue;
      return normalized;
   }
   return null;
}

async function resolveCanonicalUrl(rawUrl: string): Promise<string | null> {
   const normalized = normalizeUrl(rawUrl);
   if (!normalized) return null;
   if (!isGoogleNewsWrapper(normalized)) return normalized;

   const cached = canonicalUrlCache.get(normalized);
   if (cached) return cached;

   try {
      const response = await withTimeout(
         fetch(normalized, {
            redirect: 'follow',
            headers: { 'User-Agent': 'proofline-trend-researcher/0.1' },
         }),
         REQUEST_TIMEOUT_MS
      );
      let resolved = normalizeUrl(response.url) ?? normalized;
      if (isGoogleNewsWrapper(resolved)) {
         const html = await response.text();
         const extracted = extractFirstExternalUrlFromGoogleNewsHtml(html);
         if (extracted) {
            resolved = extracted;
         }
      }
      canonicalUrlCache.set(normalized, resolved);
      return resolved;
   } catch {
      canonicalUrlCache.set(normalized, normalized);
      return normalized;
   }
}

function getDomain(url: string): string {
   try {
      return new URL(url).hostname.toLowerCase();
   } catch {
      return '';
   }
}

function getFaviconUrl(url: string): string | null {
   const domain = getDomain(url);
   if (!domain) return null;
   return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function inferPublisherFromTitle(title: string): string {
   const parts = title.split(' - ').map(part => normalizeWhitespace(part));
   if (parts.length > 1) {
      return parts[parts.length - 1];
   }
   return '';
}

function sourceGroupKey(source: CandidateSource): string {
   const domain = getDomain(source.url);
   if (domain === 'news.google.com' && source.publisher) {
      return `publisher:${source.publisher.toLowerCase()}`;
   }
   return domain;
}

function guessSourceType(url: string): SourceType {
   const domain = getDomain(url);
   if (domain.includes('github.com') || domain.includes('gitlab.com')) {
      return 'repo';
   }
   if (
      domain.includes('reddit.com') ||
      domain.includes('x.com') ||
      domain.includes('twitter.com') ||
      domain.includes('news.ycombinator.com')
   ) {
      return 'social_post';
   }
   if (
      domain.endsWith('.gov') ||
      domain.endsWith('.edu') ||
      domain.includes('sec.gov') ||
      domain.includes('justice.gov') ||
      domain.includes('treasury.gov')
   ) {
      return 'official_statement';
   }
   if (
      TRUSTED_NEWS_DOMAINS.some(trusted => domain.includes(trusted)) ||
      domain.includes('news')
   ) {
      return 'news_article';
   }
   return 'other';
}

function guessReliability(url: string): Reliability {
   const domain = getDomain(url);
   if (
      domain.endsWith('.gov') ||
      domain.endsWith('.edu') ||
      domain.includes('who.int') ||
      domain.includes('fda.gov') ||
      domain.includes('cdc.gov') ||
      TRUSTED_NEWS_DOMAINS.some(trusted => domain.includes(trusted))
   ) {
      return 'HIGH';
   }
   if (
      domain.includes('reddit.com') ||
      domain.includes('x.com') ||
      domain.includes('twitter.com')
   ) {
      return 'LOW';
   }
   return 'MEDIUM';
}

function isCredibleDomain(url: string): boolean {
   const domain = getDomain(url);
   if (!domain) return false;
   if (domain.endsWith('.gov') || domain.endsWith('.edu')) return true;
   if (TRUSTED_NEWS_DOMAINS.some(trusted => domain.includes(trusted))) {
      return true;
   }
   if (
      domain.includes('github.com') ||
      domain.includes('gitlab.com') ||
      domain.includes('wikipedia.org')
   ) {
      return true;
   }
   return false;
}

function computeRelevanceScore(query: string, text: string): number {
   const queryTokens = new Set(extractTokens(query));
   const textTokens = extractTokens(text);
   if (queryTokens.size === 0 || textTokens.length === 0) return 0;
   let matches = 0;
   textTokens.forEach(token => {
      if (queryTokens.has(token)) matches += 1;
   });
   return matches / Math.max(queryTokens.size, 1);
}

function hasEnoughRelevance(source: CandidateSource): boolean {
   if (source.reliability === 'LOW') {
      return source.relevance >= LOW_RELIABILITY_MIN_RELEVANCE;
   }
   return source.relevance >= MIN_RELEVANCE_SCORE;
}

function reliabilityWeight(value: Reliability): number {
   if (value === 'HIGH') return 1;
   if (value === 'MEDIUM') return 0.6;
   return 0.25;
}

function recencyWeight(dateValue: string | null): number {
   if (!dateValue) return 0.2;
   const published = new Date(dateValue).getTime();
   if (Number.isNaN(published)) return 0.2;
   const hours = (Date.now() - published) / (1000 * 60 * 60);
   if (hours <= 24) return 1;
   if (hours <= 72) return 0.75;
   if (hours <= 168) return 0.5;
   return 0.2;
}

function isRecentWithinDays(dateValue: string | null, days: number): boolean {
   if (!dateValue) return true;
   const published = new Date(dateValue).getTime();
   if (Number.isNaN(published)) return true;
   const ageDays = (Date.now() - published) / (1000 * 60 * 60 * 24);
   return ageDays <= days;
}

async function fetchGoogleNewsSearch(
   query: string
): Promise<CandidateSource[]> {
   const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
   const res = await fetch(url);
   if (!res.ok) return [];

   const xml = await res.text();
   const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
      htmlEntities: false,
   });
   const parsed = parser.parse(xml) as {
      rss?: { channel?: { item?: GoogleNewsItem[] | GoogleNewsItem } };
   };
   const items = parsed?.rss?.channel?.item ?? [];
   const list = Array.isArray(items) ? items : [items];

   const baseItems = list
      .map(item => ({
         url: item.link ?? '',
         title: item.title ?? 'Untitled',
         publishedAt: parseDate(item.pubDate),
      }))
      .slice(0, 12);

   const resolvedItems = await Promise.all(
      baseItems.map(async item => ({
         url: await resolveCanonicalUrl(item.url),
         title: item.title,
         publishedAt: item.publishedAt,
      }))
   );

   return resolvedItems
      .filter(
         (
            item
         ): item is {
            url: string;
            title: string;
            publishedAt: string | null;
         } =>
            Boolean(
               item.url &&
                  isLikelyArticleUrl(item.url) &&
                  !isGoogleNewsWrapper(item.url)
            )
      )
      .map(item => {
         const publisher =
            inferPublisherFromTitle(item.title) || getDomain(item.url);
         const sourceType = guessSourceType(item.url);
         const reliability = guessReliability(item.url);
         return {
            url: item.url,
            title: item.title,
            publisher,
            publishedAt: item.publishedAt,
            snippet: '',
            imageUrl: null,
            sourceType,
            reliability,
            relevance: computeRelevanceScore(query, item.title),
         };
      })
      .filter(hasEnoughRelevance);
}

async function fetchHackerNewsSearch(
   query: string
): Promise<CandidateSource[]> {
   const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
   const res = await fetch(url);
   if (!res.ok) return [];

   const data = (await res.json()) as HNResponse;
   const hits = data.hits ?? [];
   return hits
      .map(hit => {
         const rawUrl = hit.url || hit.story_url;
         const normalized = rawUrl ? normalizeUrl(rawUrl) : null;
         return {
            url: normalized,
            title: hit.title ?? 'Untitled',
            publishedAt: parseDate(hit.created_at),
         };
      })
      .filter(
         (
            item
         ): item is {
            url: string;
            title: string;
            publishedAt: string | null;
         } => Boolean(item.url && isLikelyArticleUrl(item.url))
      )
      .slice(0, 10)
      .map(item => ({
         url: item.url,
         title: item.title,
         publisher: getDomain(item.url),
         publishedAt: item.publishedAt,
         snippet: '',
         imageUrl: null,
         sourceType: guessSourceType(item.url),
         reliability: guessReliability(item.url),
         relevance: computeRelevanceScore(query, item.title),
      }))
      .filter(hasEnoughRelevance);
}

async function fetchRedditSearch(query: string): Promise<CandidateSource[]> {
   const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=week&limit=12`;
   const res = await fetch(url, {
      headers: { 'User-Agent': 'proofline-trend-researcher/0.1' },
   });
   if (!res.ok) return [];

   const data = (await res.json()) as RedditListing;
   const children = data.data?.children ?? [];
   return children
      .map(child => child.data)
      .filter((item): item is RedditPost => Boolean(item?.title && item?.url))
      .map(item => {
         const normalized = normalizeUrl(item.url ?? '');
         return {
            url: normalized,
            title: item.title ?? 'Untitled',
            snippet: normalizeWhitespace(item.selftext ?? '').slice(0, 240),
            publishedAt: item.created_utc
               ? new Date(item.created_utc * 1000).toISOString()
               : null,
         };
      })
      .filter(
         (
            item
         ): item is {
            url: string;
            title: string;
            snippet: string;
            publishedAt: string | null;
         } => Boolean(item.url && isLikelyArticleUrl(item.url))
      )
      .map(item => ({
         url: item.url,
         title: item.title,
         publisher: getDomain(item.url),
         publishedAt: item.publishedAt,
         snippet: item.snippet,
         imageUrl: null,
         sourceType: guessSourceType(item.url),
         reliability: guessReliability(item.url),
         relevance: computeRelevanceScore(
            query,
            `${item.title} ${item.snippet}`
         ),
      }))
      .filter(hasEnoughRelevance);
}

async function fetchGdeltSearch(query: string): Promise<CandidateSource[]> {
   const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?` +
      `query=${encodeURIComponent(query)}&mode=ArtList&format=json&sort=HybridRel&maxrecords=${GDELT_MAX_RECORDS}`;

   const res = await fetch(url, {
      headers: { 'User-Agent': 'proofline-trend-researcher/0.1' },
   });
   if (!res.ok) return [];

   const data = (await res.json()) as GdeltSearchResponse;
   const articles = data.articles ?? [];

   return articles
      .map(article => {
         const normalized = normalizeUrl(article.url ?? '');
         if (!normalized || !isLikelyArticleUrl(normalized)) return null;

         const title = normalizeWhitespace(article.title ?? 'Untitled');
         const publishedAt = parseDate(article.seendate);
         const snippet = title;
         const imageUrl = normalizeUrl(article.image ?? article.socialimage ?? '');

         return {
            url: normalized,
            title,
            publisher: article.domain || getDomain(normalized),
            publishedAt,
            snippet,
            imageUrl,
            sourceType: guessSourceType(normalized),
            reliability: guessReliability(normalized),
            relevance: computeRelevanceScore(query, title),
         } satisfies CandidateSource;
      })
      .filter((item): item is CandidateSource => Boolean(item))
      .filter(hasEnoughRelevance);
}

async function fetchGuardianSearch(query: string): Promise<CandidateSource[]> {
   if (!GUARDIAN_API_KEY) return [];

   const url =
      `https://content.guardianapis.com/search?` +
      `q=${encodeURIComponent(query)}` +
      `&api-key=${encodeURIComponent(GUARDIAN_API_KEY)}` +
      `&show-fields=trailText,thumbnail,headline` +
      `&order-by=relevance` +
      `&page-size=${GUARDIAN_PAGE_SIZE}`;

   const res = await fetch(url, {
      headers: { 'User-Agent': 'proofline-trend-researcher/0.1' },
   });
   if (!res.ok) return [];

   const data = (await res.json()) as GuardianSearchResponse;
   const results = data.response?.results ?? [];

   return results
      .map(item => {
         const normalized = normalizeUrl(item.webUrl ?? '');
         if (!normalized || !isLikelyArticleUrl(normalized)) return null;

         const title = normalizeWhitespace(
            item.fields?.headline || item.webTitle || 'Untitled'
         );
         const snippet = normalizeWhitespace(item.fields?.trailText || title).slice(
            0,
            280
         );
         const imageUrl = normalizeUrl(item.fields?.thumbnail || '');

         return {
            url: normalized,
            title,
            publisher: 'theguardian.com',
            publishedAt: parseDate(item.webPublicationDate),
            snippet,
            imageUrl,
            sourceType: 'news_article' as SourceType,
            reliability: 'HIGH' as Reliability,
            relevance: computeRelevanceScore(query, `${title} ${snippet}`),
         } satisfies CandidateSource;
      })
      .filter((item): item is CandidateSource => Boolean(item))
      .filter(hasEnoughRelevance);
}

async function fetchPublisherRssSearch(
   query: string,
   trendCategory: string
): Promise<CandidateSource[]> {
   const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
      htmlEntities: false,
   });

   const shouldPreferTech = trendCategory.toLowerCase().includes('tech');
   const feedsToUse = shouldPreferTech
      ? PUBLISHER_RSS_FEEDS.filter(feed => feed.category === 'tech')
      : PUBLISHER_RSS_FEEDS;

   const all = await Promise.all(
      feedsToUse.map(async feed => {
         try {
            const res = await fetch(feed.url, {
               headers: {
                  'User-Agent': 'proofline-trend-researcher/0.1',
                  Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
               },
            });
            if (!res.ok) return [] as CandidateSource[];

            const xml = await res.text();
            const parsed = parser.parse(xml) as {
               rss?: { channel?: { item?: GenericRssItem[] | GenericRssItem } };
            };
            const rawItems = parsed?.rss?.channel?.item ?? [];
            const items = Array.isArray(rawItems) ? rawItems : [rawItems];

            return items
               .map(item => {
                  const normalized = normalizeUrl(item.link ?? '');
                  if (!normalized || !isLikelyArticleUrl(normalized)) return null;

                  const title = normalizeWhitespace(item.title ?? 'Untitled');
                  const description = stripTags(item.description ?? '');
                  const snippet = normalizeWhitespace(description || title).slice(0, 280);
                  const relevance = computeRelevanceScore(query, `${title} ${snippet}`);
                  if (relevance < MIN_RELEVANCE_SCORE * 0.85) return null;

                  const candidate: CandidateSource = {
                     url: normalized,
                     title,
                     publisher: getDomain(normalized),
                     publishedAt: parseDate(item.pubDate),
                     snippet,
                     imageUrl: null,
                     sourceType: 'news_article',
                     reliability: guessReliability(normalized),
                     relevance,
                  };

                  return candidate;
               })
               .filter((item): item is CandidateSource => Boolean(item))
               .slice(0, 8);
         } catch {
            return [] as CandidateSource[];
         }
      })
   );

   return all.flat();
}

function getTechDiscoverySeedSources(query: string, trend: TrendRecord): CandidateSource[] {
   if (!isTechTrend(trend)) return [];

   return TECH_DISCOVERY_SEED_URLS.map(item => ({
      url: item.url,
      title: item.title,
      publisher: item.publisher,
      publishedAt: null,
      snippet: item.title,
      imageUrl: null,
      sourceType: 'other',
      reliability: guessReliability(item.url),
      relevance: computeRelevanceScore(query, `${item.title} ${item.publisher}`),
   }));
}

function extractHttpLinks(baseUrl: string, html: string): string[] {
   const hrefMatches = html.match(/href\s*=\s*["']([^"']+)["']/gi) ?? [];
   const links: string[] = [];

   hrefMatches.forEach(match => {
      const href = match
         .replace(/^href\s*=\s*["']/, '')
         .replace(/["']$/, '')
         .trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:'))
         return;

      try {
         const resolved = new URL(href, baseUrl).toString();
         const normalized = normalizeUrl(resolved);
         if (normalized) links.push(normalized);
      } catch {
         // skip bad URL
      }
   });

   return links;
}

async function expandPrimarySources(
   seedSources: CandidateSource[],
   query: string
): Promise<CandidateSource[]> {
   const expanded: CandidateSource[] = [];
   const seeds = seedSources.slice(0, MAX_EXPANSION_PAGES);

   for (const seed of seeds) {
      try {
         const res = await fetch(seed.url);
         if (!res.ok) continue;
         const html = await res.text();
         const textSnippet = stripTags(html).slice(0, 280);
         const links = extractHttpLinks(seed.url, html).slice(
            0,
            MAX_LINKS_PER_PAGE
         );

         links.forEach(url => {
            if (!isCredibleDomain(url)) return;
            const candidate: CandidateSource = {
               url,
               title: `Reference from ${seed.publisher}`,
               publisher: getDomain(url),
               publishedAt: null,
               snippet: textSnippet,
               imageUrl: null,
               sourceType: guessSourceType(url),
               reliability: guessReliability(url),
               relevance: computeRelevanceScore(
                  query,
                  `${seed.title} ${textSnippet}`
               ),
            };
            if (hasEnoughRelevance(candidate)) expanded.push(candidate);
         });
      } catch {
         // skip fetch/parse failures
      }
   }

   return expanded;
}

function dedupeByUrl(sources: CandidateSource[]): CandidateSource[] {
   const map = new Map<string, CandidateSource>();

   sources.forEach(source => {
      const normalized = normalizeUrl(source.url);
      if (!normalized) return;

      const existing = map.get(normalized);
      if (!existing) {
         map.set(normalized, { ...source, url: normalized });
         return;
      }

      const existingScore =
         existing.relevance +
         reliabilityWeight(existing.reliability) +
         recencyWeight(existing.publishedAt);
      const nextScore =
         source.relevance +
         reliabilityWeight(source.reliability) +
         recencyWeight(source.publishedAt);

      if (nextScore > existingScore) {
         map.set(normalized, { ...source, url: normalized });
      }
   });

   return Array.from(map.values());
}

function rankSources(sources: CandidateSource[]): CandidateSource[] {
   return [...sources].sort((a, b) => {
      const scoreA =
         a.relevance +
         reliabilityWeight(a.reliability) +
         recencyWeight(a.publishedAt);
      const scoreB =
         b.relevance +
         reliabilityWeight(b.reliability) +
         recencyWeight(b.publishedAt);
      return scoreB - scoreA;
   });
}

function extractMetaContent(
   html: string,
   attrName: 'name' | 'property',
   attrValue: string
): string {
   const pattern = new RegExp(
      `<meta[^>]*${attrName}=["']${attrValue}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      'i'
   );
   const match = html.match(pattern);
   return match?.[1] ? normalizeWhitespace(match[1]) : '';
}

function extractParagraphSnippet(html: string): string {
   const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
   if (!paragraphMatch?.[1]) return '';
   return stripTags(paragraphMatch[1]).slice(0, 280);
}

function resolveUrlFromMeta(baseUrl: string, value: string): string | null {
   const raw = normalizeWhitespace(value);
   if (!raw) return null;
   if (raw.startsWith('data:')) return null;

   try {
      const resolved = new URL(raw, baseUrl).toString();
      return resolved;
   } catch {
      return null;
   }
}

function extractImageUrl(html: string, pageUrl: string): string | null {
   const og =
      extractMetaContent(html, 'property', 'og:image') ||
      extractMetaContent(html, 'name', 'twitter:image');
   if (!og) return null;

   return resolveUrlFromMeta(pageUrl, og);
}

function extractSnippetFromMarkdown(markdown: string): string {
   const cleaned = markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#>*_`~-]/g, ' ');
   return normalizeWhitespace(cleaned).slice(0, 280);
}

async function scrapeWithFirecrawl(
   url: string
): Promise<{
   canonicalUrl: string | null;
   snippet: string | null;
   imageUrl: string | null;
}> {
   if (!FIRECRAWL_API_KEY) {
      return {
         canonicalUrl: null,
         snippet: null,
         imageUrl: null,
      };
   }

   try {
      const response = await withTimeout(
         fetch(`${FIRECRAWL_API_BASE}/scrape`, {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               url,
               formats: ['markdown'],
               onlyMainContent: true,
               timeout: 30000,
               blockAds: true,
               removeBase64Images: true,
            }),
         }),
         FIRECRAWL_TIMEOUT_MS
      );

      if (!response.ok) {
         return {
            canonicalUrl: null,
            snippet: null,
            imageUrl: null,
         };
      }

      const payload = (await response.json()) as FirecrawlScrapeResponse;
      if (!payload.success || !payload.data) {
         return {
            canonicalUrl: null,
            snippet: null,
            imageUrl: null,
         };
      }

      const metadata = payload.data.metadata ?? {};
      const canonicalUrl = normalizeUrl(metadata.sourceURL || metadata.url || '');
      const snippet = normalizeWhitespace(
         metadata.description || extractSnippetFromMarkdown(payload.data.markdown ?? '')
      ).slice(0, 280);
      const imageUrl = normalizeUrl(metadata.ogImage || metadata.twitterImage || '');

      return {
         canonicalUrl,
         snippet: snippet.length > 0 ? snippet : null,
         imageUrl,
      };
   } catch {
      return {
         canonicalUrl: null,
         snippet: null,
         imageUrl: null,
      };
   }
}

async function fillMissingSnippets(
   sources: CandidateSource[]
): Promise<CandidateSource[]> {
   const updated: CandidateSource[] = [];

   for (const source of sources) {
      if (
         source.snippet &&
         source.snippet.trim().length >= 30 &&
         source.imageUrl
      ) {
         updated.push(source);
         continue;
      }

      if (getDomain(source.url) === 'news.google.com') {
         updated.push({
            ...source,
            snippet: source.title,
            imageUrl: source.imageUrl,
         });
         continue;
      }

      const firecrawl = await scrapeWithFirecrawl(source.url);
      if (firecrawl.snippet || firecrawl.imageUrl || firecrawl.canonicalUrl) {
         const nextUrl = firecrawl.canonicalUrl ?? source.url;
         updated.push({
            ...source,
            url: nextUrl,
            publisher: source.publisher || getDomain(nextUrl),
            sourceType: guessSourceType(nextUrl),
            reliability: guessReliability(nextUrl),
            snippet: firecrawl.snippet || source.snippet || source.title,
            imageUrl: source.imageUrl || firecrawl.imageUrl,
         });
         continue;
      }

      try {
         const response = await withTimeout(
            fetch(source.url, {
               headers: { 'User-Agent': 'proofline-trend-researcher/0.1' },
            }),
            REQUEST_TIMEOUT_MS
         );
         if (!response.ok) {
            updated.push({
               ...source,
               snippet: source.snippet || source.title,
               imageUrl: source.imageUrl,
            });
            continue;
         }

         const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
         if (!contentType.includes('text/html')) {
            updated.push({
               ...source,
               snippet: source.snippet || source.title,
               imageUrl: source.imageUrl,
            });
            continue;
         }

         const html = await response.text();
         const description =
            extractMetaContent(html, 'name', 'description') ||
            extractMetaContent(html, 'property', 'og:description');
         const paragraph = extractParagraphSnippet(html);
         const fallback = stripTags(html).slice(0, 240);
         const snippet = normalizeWhitespace(
            description || paragraph || fallback || source.title
         ).slice(0, 280);
         const imageUrl = source.imageUrl || extractImageUrl(html, source.url);

         updated.push({
            ...source,
            snippet,
            imageUrl,
         });
      } catch {
         updated.push({
            ...source,
            snippet: source.snippet || source.title,
            imageUrl: source.imageUrl,
         });
      }
   }

   return updated;
}

async function resolveSourceUrls(
   sources: CandidateSource[]
): Promise<CandidateSource[]> {
   const resolved = await Promise.all(
      sources.map(async source => {
         const canonical = await resolveCanonicalUrl(source.url);
         const nextUrl = canonical ?? source.url;
         return {
            ...source,
            url: nextUrl,
            publisher: source.publisher || getDomain(nextUrl),
            sourceType: guessSourceType(nextUrl),
            reliability: guessReliability(nextUrl),
         };
      })
   );

   return dedupeByUrl(resolved);
}

function enforceSourceDiversity(
   originalSource: CandidateSource,
   rankedSources: CandidateSource[]
): CandidateSource[] {
   const selected: CandidateSource[] = [originalSource];
   const domainCount = new Map<string, number>();
   const originalDomain = sourceGroupKey(originalSource);
   if (originalDomain) domainCount.set(originalDomain, 1);

   let hasHighReliability = originalSource.reliability === 'HIGH';
   const candidates = rankedSources.filter(
      source => source.url !== originalSource.url
   );

   if (!hasHighReliability) {
      const highCandidate = candidates.find(source => {
         if (source.reliability !== 'HIGH') return false;
         const domain = sourceGroupKey(source);
         const count = domain ? domainCount.get(domain) ?? 0 : 0;
         return count < MAX_SOURCES_PER_DOMAIN;
      });

      if (highCandidate) {
         selected.push(highCandidate);
         const domain = sourceGroupKey(highCandidate);
         if (domain) {
            domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
         }
         hasHighReliability = true;
      }
   }

   for (const source of candidates) {
      if (selected.length >= TARGET_TOTAL_SOURCES) break;
      if (selected.some(item => item.url === source.url)) continue;
      if (!hasEnoughRelevance(source)) continue;
      if (!isRecentWithinDays(source.publishedAt, 45)) continue;

      const domain = sourceGroupKey(source);
      const count = domain ? domainCount.get(domain) ?? 0 : 0;
      if (count >= MAX_SOURCES_PER_DOMAIN) continue;

      selected.push(source);
      if (domain) domainCount.set(domain, count + 1);
      if (source.reliability === 'HIGH') hasHighReliability = true;
   }

   // Fallback: if strict filters are too narrow, relax constraints to keep article depth.
   if (selected.length < 5) {
      for (const source of candidates) {
         if (selected.length >= TARGET_TOTAL_SOURCES) break;
         if (selected.some(item => item.url === source.url)) continue;
         if (!isRecentWithinDays(source.publishedAt, 180)) continue;

         const domain = sourceGroupKey(source);
         const count = domain ? domainCount.get(domain) ?? 0 : 0;
         if (count >= MAX_SOURCES_PER_DOMAIN + 2) continue;
         if (source.relevance < 0.1) continue;

         selected.push(source);
         if (domain) domainCount.set(domain, count + 1);
      }
   }

   return selected.slice(0, TARGET_TOTAL_SOURCES);
}

function normalizeOutput(sources: CandidateSource[]): NormalizedSource[] {
   return sources.map(source => ({
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      published_at: source.publishedAt,
      snippet: source.snippet,
      image_url: source.imageUrl ?? null,
      source_type: source.sourceType,
      reliability: source.reliability,
   }));
}

async function getRecentTrends(limit: number): Promise<TrendRecord[]> {
   const rows = await prisma.trend.findMany({
      orderBy: { capturedAt: 'desc' },
      take: limit,
      select: {
         id: true,
         title: true,
         url: true,
         category: true,
         publishedAt: true,
         capturedAt: true,
      },
   });

   return rows.map(row => ({
      id: row.id,
      title: row.title,
      url: row.url,
      category: row.category,
      publishedAt: row.publishedAt,
      capturedAt: row.capturedAt,
   }));
}

async function researchTrend(trend: TrendRecord): Promise<TrendSourcesOutput> {
   const query = buildTrendQuery(trend.title);

   const settled = await Promise.allSettled([
      fetchGoogleNewsSearch(query),
      fetchHackerNewsSearch(query),
      fetchRedditSearch(query),
      fetchGdeltSearch(query),
      fetchGuardianSearch(query),
      fetchPublisherRssSearch(query, trend.category),
   ]);

   const sourcesByFetcher = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const names = [
         'google',
         'hackernews',
         'reddit',
         'gdelt',
         'guardian',
         'publisher-rss',
      ] as const;
      const message =
         result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
      console.warn(
         `[research-trends] ${names[index]} fetch failed for trend ${trend.id}: ${message}`
      );
      return [] as CandidateSource[];
   });

   const [
      googleSources,
      hnSources,
      redditSources,
      gdeltSources,
      guardianSources,
      publisherRssSources,
   ] = sourcesByFetcher;
   const techSeedSources = getTechDiscoverySeedSources(query, trend);

   const seedSources = dedupeByUrl([
      ...googleSources,
      ...hnSources,
      ...redditSources,
      ...gdeltSources,
      ...guardianSources,
      ...publisherRssSources,
      ...techSeedSources,
   ]);
   const expandedSources = await expandPrimarySources(seedSources, query);

   const canonicalTrendUrl = await resolveCanonicalUrl(trend.url);
   const originalTrendUrl = canonicalTrendUrl ?? normalizeUrl(trend.url) ?? trend.url;

   const originalTrendSource: CandidateSource = {
      url: originalTrendUrl,
      title: trend.title,
      publisher: getDomain(originalTrendUrl),
      publishedAt: trend.publishedAt ? trend.publishedAt.toISOString() : null,
      snippet: '',
      imageUrl: null,
      sourceType: guessSourceType(originalTrendUrl),
      reliability: guessReliability(originalTrendUrl),
      relevance: 1,
   };

   const allSources = dedupeByUrl([
      originalTrendSource,
      ...seedSources,
      ...expandedSources,
   ]);

   const ranked = rankSources(allSources);
   const selectedWithPolicy = enforceSourceDiversity(originalTrendSource, ranked);
   const resolvedSources = await resolveSourceUrls(selectedWithPolicy);
   let finalSources = await fillMissingSnippets(resolvedSources);

   if (finalSources.length < MIN_FINAL_SOURCES) {
      const seen = new Set(
         finalSources.map(source => normalizeUrl(source.url) ?? source.url)
      );
      const fallbackPool = ranked.filter(source => {
         const normalized = normalizeUrl(source.url) ?? source.url;
         return !seen.has(normalized);
      });

      if (fallbackPool.length > 0) {
         const fallbackResolved = await resolveSourceUrls(
            fallbackPool.slice(0, TARGET_TOTAL_SOURCES * 2)
         );
         const fallbackFilled = await fillMissingSnippets(fallbackResolved);
         const merged = dedupeByUrl([...finalSources, ...fallbackFilled]);
         finalSources = rankSources(merged).slice(
            0,
            Math.max(TARGET_TOTAL_SOURCES, MIN_FINAL_SOURCES)
         );
      }
   }

   return {
      trend_id: trend.id,
      trend_title: trend.title,
      query,
      sources: normalizeOutput(finalSources),
      total_sources: finalSources.length,
   };
}

async function persistTrendSources(
   output: TrendSourcesOutput
): Promise<{ storedSources: number }> {
   return prisma.$transaction(async tx => {
      await tx.source.deleteMany({
         where: { trendId: output.trend_id },
      });

      if (output.sources.length === 0) {
         return {
            storedSources: 0,
         };
      }

      const preparedSources = output.sources
         .map(source => {
            const url = sanitizeUrlForDb(source.url);
            const title = sanitizeTextForDb(source.title || 'Untitled').slice(
               0,
               500
            );
            const publisher = sanitizeTextForDb(
               source.publisher || getDomain(source.url) || 'unknown'
            ).slice(0, 255);
            const snippet = sanitizeTextForDb(
               source.snippet || source.title || 'No snippet available'
            ).slice(0, 280);
            const imageUrl = source.image_url
               ? sanitizeUrlForDb(source.image_url)
               : null;

            return {
               url,
               title,
               publisher,
               snippet,
               publishedAt: toDateOrNull(source.published_at),
               imageUrl: imageUrl ? normalizeUrl(imageUrl) ?? imageUrl : null,
               faviconUrl: getFaviconUrl(url),
               sourceType: source.source_type,
               reliability: source.reliability,
            };
         })
         .filter(source => Boolean(source.url));

      if (preparedSources.length === 0) {
         return {
            storedSources: 0,
         };
      }

      const created = await tx.source.createMany({
         data: preparedSources.map((source, index) => ({
            trendId: output.trend_id,
            url: source.url,
            title: source.title || 'Untitled',
            publisher: source.publisher || 'unknown',
            publishedAt: source.publishedAt,
            snippet: source.snippet || source.title || 'No snippet available',
            imageUrl: source.imageUrl,
            faviconUrl: source.faviconUrl,
            sourceType: source.sourceType,
            reliability: source.reliability,
            rank: index + 1,
         })),
      });

      return {
         storedSources: created.count,
      };
   });
}

async function main(): Promise<void> {
   const trends = await getRecentTrends(TREND_LIMIT);
   if (trends.length === 0) {
      console.log(
         JSON.stringify(
            {
               message: 'No trends found in DB. Run trends:fetch first.',
               results: [],
            },
            null,
            2
         )
      );
      return;
   }

   const results: PersistedTrendOutput[] = [];
   for (const trend of trends) {
      const output = await researchTrend(trend);
      const persisted = await persistTrendSources(output);
      results.push({
         ...output,
         stored_sources: persisted.storedSources,
      });
   }

   console.log(
      JSON.stringify(
         {
            trends_processed: results.length,
            results,
         },
         null,
         2
      )
   );
}

main()
   .catch(error => {
      console.error('Trend research failed:', error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
