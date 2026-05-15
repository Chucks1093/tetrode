import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../utils/prisma.utils';

type TrendSource =
  | 'reddit'
  | 'hackernews'
  | 'google_news'
  | 'publisher_feed'
  | 'source_index';

type Trend = {
  source: TrendSource;
  category: string;
  title: string;
  url: string;
  score?: number;
  publishedAt?: string;
};

type RedditPost = {
  title: string;
  url: string;
  score: number;
  created_utc?: number;
};

type RedditListing = {
  data?: {
    children?: Array<{
      data?: RedditPost;
    }>;
  };
};

type RedditRssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
};

type HackerNewsItem = {
  title?: string;
  url?: string;
  score?: number;
  time?: number;
};

type HackerNewsTrend = {
  title: string;
  url: string;
  score: number | undefined;
  publishedAt: string | undefined;
};

type GoogleNewsItem = {
  title?: string;
  link?: string;
  pubDate?: string;
};

type GenericRssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
};

type GenericAtomEntry = {
  title?: string | { '#text'?: string };
  link?:
    | { '@_href'?: string; href?: string }
    | Array<{ '@_href'?: string; href?: string }>;
  published?: string;
  updated?: string;
};

type CategoryTarget = {
  category: string;
  min: number;
};

const REDDIT_SUBREDDITS: { category: string; subreddit: string }[] = [
  { category: 'world', subreddit: 'worldnews' },
  { category: 'politics', subreddit: 'politics' },
  { category: 'business', subreddit: 'business' },
  { category: 'finance', subreddit: 'finance' },
  { category: 'tech', subreddit: 'technology' },
  { category: 'work', subreddit: 'jobs' },
  { category: 'science', subreddit: 'science' },
];

const REDDIT_LIMIT = 10;
const TOP_PER_CATEGORY = Number(process.env.TRENDS_FETCH_TOP_PER_CATEGORY ?? '3');
const TARGET_TOTAL = Number(process.env.TRENDS_FETCH_TARGET_TOTAL ?? '24');
const FEED_TOP_PER_SOURCE = Number(
  process.env.TRENDS_FETCH_FEED_TOP_PER_SOURCE ?? '4'
);
const INDEX_TOP_PER_SOURCE = Number(
  process.env.TRENDS_FETCH_INDEX_TOP_PER_SOURCE ?? '3'
);
const ENABLE_REDDIT_FETCH = process.env.TRENDS_FETCH_ENABLE_REDDIT === 'true';
const ENABLE_HN_FETCH = process.env.TRENDS_FETCH_ENABLE_HN === 'true';
const ENABLE_GOOGLE_NEWS_FETCH =
  process.env.TRENDS_FETCH_ENABLE_GOOGLE_NEWS === 'true';
const ENABLE_PUBLISHER_FEEDS_FETCH =
  process.env.TRENDS_FETCH_ENABLE_PUBLISHER_FEEDS !== 'false';
const ENABLE_SOURCE_INDEX_FETCH =
  process.env.TRENDS_FETCH_ENABLE_SOURCE_INDEX !== 'false';
const REFRESH_EXISTING_TRENDS =
  process.env.TRENDS_FETCH_REFRESH_EXISTING === 'true';

const CATEGORY_TARGETS: CategoryTarget[] = [
  { category: 'world', min: 1 },
  { category: 'science', min: 1 },
  { category: 'finance', min: 1 },
  { category: 'tech', min: 4 },
  { category: 'work', min: 1 },
];

const PUBLISHER_TREND_FEEDS: Array<{ category: string; url: string }> = [
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

const SOURCE_INDEX_URLS: Array<{ category: string; url: string }> = [
  { category: 'tech', url: 'https://developers.cloudflare.com/changelog/' },
  { category: 'tech', url: 'https://dev.to/t/ai' },
  { category: 'tech', url: 'https://dev.to/t/vibecoding' },
  { category: 'tech', url: 'https://virlo.ai/' },
  { category: 'tech', url: 'https://medium.com/tag/ai' },
  { category: 'tech', url: 'https://medium.com/tag/vibecoding' },
  { category: 'tech', url: 'https://aws.amazon.com/blogs/' },
  { category: 'tech', url: 'https://manus.im/blog' },
  { category: 'tech', url: 'https://developers.googleblog.com/' },
  { category: 'tech', url: 'https://news.ycombinator.com/' },
  { category: 'tech', url: 'https://huggingface.co/blog' },
  { category: 'tech', url: 'https://ollama.com/blog' },
  { category: 'tech', url: 'https://api-docs.deepseek.com/updates/' },
  { category: 'tech', url: 'https://ai.meta.com/blog/' },
  { category: 'tech', url: 'https://kiro.dev/blog/' },
  { category: 'tech', url: 'https://openai.com/news/' },
  { category: 'tech', url: 'https://www.anthropic.com/news' },
];

const NOISE_TITLES = new Set([
  'home',
  'blog',
  'news',
  'updates',
  'english',
  'deutsch',
  'espanol',
  'francais',
  'view all',
  'all',
  'rss feed',
  'atom feed',
  'rss',
  'company',
  'products',
  'research',
  'featured',
  'new',
  'read the post',
  'subscribe to rss',
]);

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
    removable.forEach((key) => parsed.searchParams.delete(key));
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return null;
  }
}

function toDateOrNull(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function extractAtomTitle(entry: GenericAtomEntry): string {
  if (typeof entry.title === 'string') return normalizeWhitespace(entry.title);
  return normalizeWhitespace(entry.title?.['#text'] ?? '');
}

function extractAtomLink(entry: GenericAtomEntry): string {
  const link = entry.link;
  if (!link) return '';
  if (Array.isArray(link)) {
    const preferred = link.find(item => (item['@_href'] ?? item.href) && true);
    return preferred?.['@_href'] ?? preferred?.href ?? '';
  }
  return link['@_href'] ?? link.href ?? '';
}

function extractHttpLinks(baseUrl: string, html: string): Array<{ url: string; title: string }> {
  const hrefMatches = html.match(/<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) ?? [];
  const links: Array<{ url: string; title: string }> = [];

  hrefMatches.forEach(match => {
    const hrefPart = match.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const inner = match.match(/>([\s\S]*?)<\/a>/i)?.[1] ?? '';
    const title = stripTags(inner);
    if (!hrefPart || !title) return;
    if (hrefPart.startsWith('#') || hrefPart.startsWith('javascript:')) return;

    try {
      const resolved = new URL(hrefPart, baseUrl).toString();
      const normalized = normalizeUrl(resolved);
      if (!normalized) return;
      links.push({ url: normalized, title });
    } catch {
      // ignore
    }
  });

  return links;
}

function isLikelyArticleUrl(url: string): boolean {
  if (!url) return false;
  const lowered = url.toLowerCase();
  const path = (() => {
    try {
      return new URL(lowered).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!path || path === '/' || path === '/blog' || path === '/news') return false;
  if (path.endsWith('/rss') || path.endsWith('/feed') || path.endsWith('/feed.rss') || path.endsWith('/feed.atom')) return false;
  if (lowered.includes('/tag/')) return false;
  if (lowered.includes('/tags/')) return false;
  if (lowered.includes('/category/')) return false;
  if (lowered.includes('/categories/')) return false;
  if (lowered.includes('/topics/')) return false;
  if (lowered.includes('/about')) return false;
  if (lowered.includes('/privacy')) return false;
  if (lowered.includes('/terms')) return false;
  if (lowered.includes('/company')) return false;
  if (lowered.includes('/careers')) return false;
  if (lowered.includes('/contact')) return false;
  if (lowered.includes('/language')) return false;
  if (lowered.includes('/zh-cn/updates')) return false;
  return (
    lowered.includes('/blog') ||
    lowered.includes('/news') ||
    lowered.includes('/changelog') ||
    lowered.includes('/updates') ||
    lowered.includes('/post') ||
    lowered.includes('/article') ||
    lowered.includes('/p/')
  );
}

function isLikelyNoiseTitle(title: string): boolean {
  const normalized = normalizeWhitespace(stripTags(title)).toLowerCase();
  if (!normalized) return true;
  if (NOISE_TITLES.has(normalized)) return true;
  if (normalized.length < 10) return true;
  if (/^[\W_]+$/.test(normalized)) return true;
  return false;
}

function isValidTrendCandidate(title: string, url: string): boolean {
  if (isLikelyNoiseTitle(title)) return false;
  if (!isLikelyArticleUrl(url)) return false;
  return true;
}

function scoreTrendForSelection(trend: Trend): number {
  const score = trend.score ?? 0;
  const publishedAt = trend.publishedAt ? new Date(trend.publishedAt).getTime() : 0;
  return score + publishedAt / 1_000_000_000_000;
}

function selectBalancedTrends(input: Trend[]): Trend[] {
  const byCategory = new Map<string, Trend[]>();
  input.forEach((trend) => {
    const bucket = byCategory.get(trend.category) ?? [];
    bucket.push(trend);
    byCategory.set(trend.category, bucket);
  });

  for (const [, trends] of byCategory) {
    trends.sort((a, b) => scoreTrendForSelection(b) - scoreTrendForSelection(a));
  }

  const selected: Trend[] = [];
  const used = new Set<string>();

  for (const target of CATEGORY_TARGETS) {
    const bucket = byCategory.get(target.category) ?? [];
    let picked = 0;
    for (const trend of bucket) {
      const key = `${trend.category}:${trend.url}`;
      if (used.has(key)) continue;
      selected.push(trend);
      used.add(key);
      picked += 1;
      if (picked >= target.min) break;
    }
  }

  const remaining = [...input].sort(
    (a, b) => scoreTrendForSelection(b) - scoreTrendForSelection(a)
  );
  for (const trend of remaining) {
    if (selected.length >= TARGET_TOTAL) break;
    const key = `${trend.category}:${trend.url}`;
    if (used.has(key)) continue;
    selected.push(trend);
    used.add(key);
  }

  return selected;
}

function extractGoogleNewsTarget(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== 'news.google.com') return null;
    const direct = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (!direct) return null;
    return normalizeUrl(direct);
  } catch {
    return null;
  }
}

async function resolveGoogleNewsLink(rawUrl: string): Promise<string> {
  const direct = extractGoogleNewsTarget(rawUrl);
  if (direct) return direct;

  try {
    const response = await fetch(rawUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'proofline-trend-fetcher/0.1 (+https://proofline.app)',
      },
    });
    return normalizeUrl(response.url) ?? rawUrl;
  } catch {
    return normalizeUrl(rawUrl) ?? rawUrl;
  }
}

async function persistTrends(trends: Trend[]): Promise<number> {
  if (trends.length === 0) return 0;

  const dedupedMap = new Map<string, Trend>();
  for (const trend of trends) {
    const normalizedUrl = normalizeUrl(trend.url) ?? trend.url;
    const existing = dedupedMap.get(normalizedUrl);
    if (!existing) {
      dedupedMap.set(normalizedUrl, {
        ...trend,
        url: normalizedUrl,
      });
      continue;
    }

    const existingScore = existing.score ?? 0;
    const nextScore = trend.score ?? 0;
    const existingPublished = existing.publishedAt
      ? new Date(existing.publishedAt).getTime()
      : 0;
    const nextPublished = trend.publishedAt
      ? new Date(trend.publishedAt).getTime()
      : 0;

    if (nextScore > existingScore || nextPublished > existingPublished) {
      dedupedMap.set(normalizedUrl, {
        ...trend,
        url: normalizedUrl,
      });
    }
  }

  const deduped = Array.from(dedupedMap.values());
  if (!REFRESH_EXISTING_TRENDS) {
    const urls = deduped.map((trend) => trend.url);
    const existingRows = await prisma.trend.findMany({
      where: {
        url: {
          in: urls,
        },
      },
      select: {
        url: true,
      },
    });
    const existingUrls = new Set(existingRows.map((row) => row.url));

    const payload = deduped
      .filter((trend) => !existingUrls.has(trend.url))
      .map((trend) => ({
        source: trend.source,
        category: trend.category,
        title: trend.title,
        url: trend.url,
        score:
          typeof trend.score === 'number' && Number.isFinite(trend.score)
            ? Math.trunc(trend.score)
            : null,
        publishedAt: toDateOrNull(trend.publishedAt),
        capturedAt: new Date(),
      }));

    if (payload.length === 0) return 0;

    const result = await prisma.trend.createMany({
      data: payload,
    });

    return result.count;
  }

  const urls = deduped.map((trend) => trend.url);
  const existingRows = await prisma.trend.findMany({
    where: {
      url: {
        in: urls,
      },
    },
    select: {
      url: true,
    },
  });
  const existingUrls = new Set(existingRows.map((row) => row.url));

  const now = new Date();
  const toCreate: Array<{
    source: string;
    category: string;
    title: string;
    url: string;
    score: number | null;
    publishedAt: Date | null;
    capturedAt: Date;
  }> = [];
  const toUpdate: Array<{
    url: string;
    data: {
      source: string;
      category: string;
      title: string;
      url: string;
      score: number | null;
      publishedAt: Date | null;
      capturedAt: Date;
    };
  }> = [];

  for (const trend of deduped) {
    const data = {
      source: trend.source,
      category: trend.category,
      title: trend.title,
      url: trend.url,
      score:
        typeof trend.score === 'number' && Number.isFinite(trend.score)
          ? Math.trunc(trend.score)
          : null,
      publishedAt: toDateOrNull(trend.publishedAt),
      capturedAt: now,
    };

    if (existingUrls.has(trend.url)) {
      toUpdate.push({ url: trend.url, data });
    } else {
      toCreate.push(data);
    }
  }

  if (toCreate.length > 0) {
    await prisma.trend.createMany({
      data: toCreate,
    });
  }

  if (toUpdate.length > 0) {
    for (const item of toUpdate) {
      await prisma.trend.updateMany({
        where: { url: item.url },
        data: item.data,
      });
    }
  }

  return toCreate.length + toUpdate.length;
}

async function fetchRedditTop(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=${REDDIT_LIMIT}&t=day`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'proofline-trend-fetcher/0.1 (+https://proofline.app)',
      Accept: 'application/json',
    },
  });

  if (res.status === 403 || res.status === 429) {
    return fetchRedditTopFromRss(subreddit);
  }

  if (!res.ok) {
    throw new Error(
      `Reddit JSON fetch failed for r/${subreddit}: ${res.status}`
    );
  }
  const data = (await res.json()) as RedditListing;
  const children = data.data?.children ?? [];
  return children
    .map((item) => item.data)
    .filter((item): item is RedditPost => Boolean(item?.title && item?.url))
    .map((item) => ({
      title: item.title,
      url: item.url,
      score: item.score ?? 0,
      created_utc: item.created_utc,
    }));
}

async function fetchRedditTopFromRss(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top/.rss?t=day`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'proofline-trend-fetcher/0.1 (+https://proofline.app)',
      Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Reddit RSS fetch failed for r/${subreddit}: ${res.status}`);
  }

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    htmlEntities: false,
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RedditRssItem[] | RedditRssItem } };
  };
  const items = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];

  return list
    .filter((item): item is RedditRssItem => Boolean(item?.title && item?.link))
    .slice(0, REDDIT_LIMIT)
    .map((item) => ({
      title: item.title ?? 'Untitled',
      url: item.link ?? '',
      score: 0,
      created_utc: item.pubDate
        ? Math.floor(new Date(item.pubDate).getTime() / 1000)
        : undefined,
    }))
    .filter((item) => item.url.length > 0);
}

async function fetchHackerNewsTop(): Promise<HackerNewsTrend[]> {
  const topRes = await fetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json'
  );
  if (!topRes.ok) {
    throw new Error(`Hacker News topstories failed: ${topRes.status}`);
  }
  const ids = (await topRes.json()) as number[];
  const topIds = ids.slice(0, 15);
  const items = await Promise.all<HackerNewsTrend | null>(
    topIds.map(async (id) => {
      const itemRes = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      );
      if (!itemRes.ok) return null;
      const item = (await itemRes.json()) as HackerNewsItem;
      if (!item?.title) return null;
      return {
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${id}`,
        score: item.score,
        publishedAt: item.time
          ? new Date(item.time * 1000).toISOString()
          : undefined,
      };
    })
  );
  return items.filter(
    (item): item is HackerNewsTrend => item !== null
  );
}

async function fetchGoogleNewsRss(): Promise<
  { title: string; url: string; publishedAt?: string }[]
> {
  const res = await fetch(
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
  );
  if (!res.ok) {
    throw new Error(`Google News RSS failed: ${res.status}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    // Google News RSS can contain many entities; disable expansion to avoid parser limit crashes.
    processEntities: false,
    htmlEntities: false,
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: GoogleNewsItem[] | GoogleNewsItem } };
  };
  const rawItems = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];
  const entries = list
    .filter((item): item is GoogleNewsItem => Boolean(item?.title && item?.link))
    .map((item) => ({
      title: item.title ?? 'Untitled',
      url: item.link ?? '',
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    }))
    .filter((item) => item.url.length > 0);

  const resolved = await Promise.all(
    entries.map(async (item) => ({
      ...item,
      url: await resolveGoogleNewsLink(item.url),
    }))
  );

  return resolved;
}

async function fetchPublisherFeeds(): Promise<Trend[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    htmlEntities: false,
  });

  const results = await Promise.all(
    PUBLISHER_TREND_FEEDS.map(async feed => {
      try {
        const res = await fetch(feed.url, {
          headers: {
            'User-Agent': 'proofline-trend-fetcher/0.1 (+https://proofline.app)',
            Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
          },
        });
        if (!res.ok) return [] as Trend[];
        const xml = await res.text();
        const parsed = parser.parse(xml) as {
          rss?: { channel?: { item?: GenericRssItem[] | GenericRssItem } };
          feed?: { entry?: GenericAtomEntry[] | GenericAtomEntry };
        };

        const rssRaw = parsed?.rss?.channel?.item ?? [];
        const rssItems = Array.isArray(rssRaw) ? rssRaw : [rssRaw];
        const atomRaw = parsed?.feed?.entry ?? [];
        const atomItems = Array.isArray(atomRaw) ? atomRaw : [atomRaw];

        const mappedRss = rssItems
          .map(item => {
            const normalized = normalizeUrl(item.link ?? '');
            if (!normalized) return null;
            const title = normalizeWhitespace(item.title ?? 'Untitled');
            if (!isValidTrendCandidate(title, normalized)) return null;
            return {
              source: 'publisher_feed' as TrendSource,
              category: feed.category,
              title,
              url: normalized,
              score: 0,
              publishedAt: item.pubDate
                ? new Date(item.pubDate).toISOString()
                : undefined,
            } as Trend;
          })
          .filter((item): item is Trend => item !== null);

        const mappedAtom = atomItems
          .map(entry => {
            const normalized = normalizeUrl(extractAtomLink(entry));
            if (!normalized) return null;
            const title = extractAtomTitle(entry) || 'Untitled';
            if (!isValidTrendCandidate(title, normalized)) return null;
            return {
              source: 'publisher_feed' as TrendSource,
              category: feed.category,
              title,
              url: normalized,
              score: 0,
              publishedAt: entry.published ?? entry.updated ?? undefined,
            } as Trend;
          })
          .filter((item): item is Trend => item !== null);

        return [...mappedRss, ...mappedAtom].slice(0, FEED_TOP_PER_SOURCE);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Skipping publisher feed ${feed.url}: ${message}`);
        return [] as Trend[];
      }
    })
  );

  return results.flat();
}

async function fetchSourceIndexPages(): Promise<Trend[]> {
  const all = await Promise.all(
    SOURCE_INDEX_URLS.map(async source => {
      try {
        const res = await fetch(source.url, {
          headers: {
            'User-Agent': 'proofline-trend-fetcher/0.1 (+https://proofline.app)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
        if (!res.ok) return [] as Trend[];
        const html = await res.text();
        const links = extractHttpLinks(source.url, html)
          .filter(item => isValidTrendCandidate(item.title, item.url))
          .filter(item => isLikelyArticleUrl(item.url))
          .filter(item => getDomain(item.url) === getDomain(source.url))
          .slice(0, INDEX_TOP_PER_SOURCE);

        return links.map((item, index) => ({
          source: 'source_index' as TrendSource,
          category: source.category,
          title: item.title,
          url: item.url,
          score: Math.max(0, INDEX_TOP_PER_SOURCE - index),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Skipping source index page ${source.url}: ${message}`);
        return [] as Trend[];
      }
    })
  );

  return all.flat();
}

async function main() {
  const trends: Trend[] = [];

  // Reddit per category
  if (ENABLE_REDDIT_FETCH) {
    for (const { category, subreddit } of REDDIT_SUBREDDITS) {
      try {
        const posts = await fetchRedditTop(subreddit);
        const topPosts = posts
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, TOP_PER_CATEGORY);
        topPosts.forEach((post: RedditPost) =>
          trends.push({
            source: 'reddit',
            category,
            title: post.title,
            url: post.url,
            score: post.score,
            publishedAt: post.created_utc
              ? new Date(post.created_utc * 1000).toISOString()
              : undefined,
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `Skipping subreddit r/${subreddit} because fetch failed: ${message}`
        );
      }
    }
  }

  // Hacker News (tech trend)
  if (ENABLE_HN_FETCH) {
    const hnItems = await fetchHackerNewsTop();
    hnItems
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, TOP_PER_CATEGORY)
      .forEach((item) =>
        trends.push({
          source: 'hackernews',
          category: 'tech',
          title: item.title,
          url: item.url,
          score: item.score,
          publishedAt: item.publishedAt,
        })
      );
  }

  // Google News RSS (global)
  if (ENABLE_GOOGLE_NEWS_FETCH) {
    const googleItems = await fetchGoogleNewsRss();
    googleItems.slice(0, TOP_PER_CATEGORY).forEach((item) =>
      trends.push({
        source: 'google_news',
        category: 'global',
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
      })
    );
  }

  // Publisher feeds + public source index pages (especially tech)
  const [publisherFeedTrends, sourceIndexTrends] = await Promise.all([
    ENABLE_PUBLISHER_FEEDS_FETCH ? fetchPublisherFeeds() : Promise.resolve([]),
    ENABLE_SOURCE_INDEX_FETCH ? fetchSourceIndexPages() : Promise.resolve([]),
  ]);
  trends.push(...publisherFeedTrends, ...sourceIndexTrends);

  const balanced = selectBalancedTrends(trends);
  const inserted = await persistTrends(balanced);

  console.log(
    JSON.stringify(
      {
        inserted,
        totalFetched: trends.length,
        totalSelected: balanced.length,
        config: {
          ENABLE_REDDIT_FETCH,
          ENABLE_HN_FETCH,
          ENABLE_GOOGLE_NEWS_FETCH,
          ENABLE_PUBLISHER_FEEDS_FETCH,
          ENABLE_SOURCE_INDEX_FETCH,
          REFRESH_EXISTING_TRENDS,
        },
        trends: balanced,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Trend fetch failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
