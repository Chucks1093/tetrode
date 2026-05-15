import { z } from 'zod';
import { prisma } from '../utils/prisma.utils';
import {
   STORY_GENERATION_SYSTEM_PROMPT,
   buildStoryGenerationUserPrompt,
} from '../prompts/story-generation.prompt';

const GENERATE_LIMIT = Number(process.env.STORIES_GENERATE_LIMIT ?? '6');
const MIN_REQUIRED_SOURCES = Number(process.env.STORIES_MIN_SOURCES ?? '2');
const FORCE_REGENERATE = process.env.STORIES_FORCE_REGENERATE === 'true';
const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'cloudflare').toLowerCase();
const DEFAULT_CF_MODEL =
   process.env.CLOUDFLARE_AI_MODEL ?? '@cf/openai/gpt-oss-120b';
const FALLBACK_CF_MODELS = (
   process.env.CLOUDFLARE_AI_FALLBACK_MODELS ?? ''
)
   .split(',')
   .map(model => model.trim())
   .filter(Boolean);
const DEFAULT_OPENROUTER_MODEL =
   process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.6-plus-04-02:free';
const FALLBACK_OPENROUTER_MODELS = (
   process.env.OPENROUTER_FALLBACK_MODELS ?? ''
)
   .split(',')
   .map(model => model.trim())
   .filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(
   process.env.STORIES_REQUEST_TIMEOUT_MS ?? '45000'
);
const MIN_BODY_WORDS = Number(process.env.STORIES_MIN_WORDS ?? '180');
const IMAGE_CHECK_TIMEOUT_MS = Number(process.env.STORIES_IMAGE_CHECK_TIMEOUT_MS ?? '2000');
const IMAGE_CHECK_MAX_CANDIDATES = Number(process.env.STORIES_IMAGE_CHECK_MAX_CANDIDATES ?? '10');
const REQUIRE_STORY_COVER_IMAGE = process.env.STORIES_REQUIRE_COVER_IMAGE === 'true';

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

const NOISE_TITLES = new Set([
   'home',
   'blog',
   'english',
   'deutsch',
   'francais',
   'espanol',
   'view all',
   'all',
   'news',
   'updates',
   'docs',
   'documentation',
   'about',
   'pricing',
   'login',
   'sign in',
   'sign up',
   'register',
]);

type SourceInput = {
   rank: number;
   url: string;
   title: string;
   publisher: string;
   publishedAt: Date | null;
   snippet: string;
   imageUrl: string | null;
   sourceType: string;
   reliability: string;
};

type TrendStoryInput = {
   trend: {
      id: string;
      title: string;
      category: string;
      url: string;
      story: { id: string } | null;
   };
   query: string;
   sources: SourceInput[];
};

const StoryDraftSchema = z.object({
   headline: z.string().min(12),
   title: z.string().min(8),
   subtitle: z.string().min(8),
   verdict: z.enum(['TRUE', 'FALSE', 'MIXED', 'UNVERIFIED']),
   confidence: z.number().int().min(0).max(100),
   body_markdown: z.string().min(80),
});

type StoryDraft = z.infer<typeof StoryDraftSchema>;

type GeneratedStoryResult = {
   trend_id: string;
   trend_title: string;
   story_id: string;
   citations_count: number;
   verdict: string;
   confidence: number;
};

type CloudflareRunResponse = {
   result?: unknown;
   errors?: Array<{ message?: string }>;
};

function extractTokens(value: string): string[] {
   return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function buildTrendQuery(title: string): string {
   const tokens = extractTokens(title);
   const unique = Array.from(new Set(tokens)).slice(0, 8);
   return unique.length > 0 ? unique.join(' ') : title;
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

function buildTitleDedupeKey(title: string): string {
   const tokens = extractTokens(title).slice(0, 10);
   return tokens.join(' ');
}

function isLikelyNoiseTrendTitle(title: string): boolean {
   const normalized = title.trim().toLowerCase();
   if (!normalized) return true;
   if (NOISE_TITLES.has(normalized)) return true;
   if (normalized.length < 12) return true;

   const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
   if (tokenCount < 3) return true;

   return false;
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

function stripJsonFence(value: string): string {
   const trimmed = value.trim();
   if (!trimmed.startsWith('```')) return trimmed;
   return trimmed
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
}

function stripLeadingJsonLabel(value: string): string {
   return value.replace(/^\s*json\s*/i, '').trimStart();
}

function extractFirstBalancedJsonObject(value: string): string {
   const start = value.indexOf('{');
   if (start === -1) return value;

   let depth = 0;
   let inString = false;
   let escaped = false;

   for (let index = start; index < value.length; index += 1) {
      const char = value[index];

      if (inString) {
         if (escaped) {
            escaped = false;
            continue;
         }

         if (char === '\\') {
            escaped = true;
            continue;
         }

         if (char === '"') {
            inString = false;
         }
         continue;
      }

      if (char === '"') {
         inString = true;
         continue;
      }

      if (char === '{') {
         depth += 1;
         continue;
      }

      if (char === '}') {
         depth -= 1;
         if (depth === 0) {
            return value.slice(start, index + 1);
         }
      }
   }

   return value.slice(start);
}

function extractJsonObjectCandidate(value: string): string {
   const start = value.indexOf('{');
   const end = value.lastIndexOf('}');
   if (start === -1 || end === -1 || end <= start) return value;
   return value.slice(start, end + 1);
}

function escapeControlCharsInQuotedStrings(value: string): string {
   let inString = false;
   let escaped = false;
   let out = '';

   for (let index = 0; index < value.length; index += 1) {
      const char = value[index];

      if (!inString) {
         if (char === '"') {
            inString = true;
            out += char;
            continue;
         }
         const code = char.charCodeAt(0);
         if (code >= 0x20 || char === '\n' || char === '\r' || char === '\t') {
            out += char;
         }
         continue;
      }

      if (escaped) {
         out += char;
         escaped = false;
         continue;
      }

      if (char === '\\') {
         out += char;
         escaped = true;
         continue;
      }

      if (char === '"') {
         out += char;
         inString = false;
         continue;
      }

      if (char === '\n') {
         out += '\\n';
         continue;
      }
      if (char === '\r') {
         out += '\\r';
         continue;
      }
      if (char === '\t') {
         out += '\\t';
         continue;
      }

      if (char.charCodeAt(0) < 0x20) {
         out += ' ';
         continue;
      }

      out += char;
   }

   return out;
}

function parseStoryDraftFromModelResponse(raw: string): StoryDraft {
   const stripped = stripJsonFence(raw);
   const deLabeled = stripLeadingJsonLabel(stripped);
   const balanced = extractFirstBalancedJsonObject(deLabeled);
   const extracted = extractJsonObjectCandidate(deLabeled);
   const escapedBalanced = escapeControlCharsInQuotedStrings(balanced);
   const escapedExtracted = escapeControlCharsInQuotedStrings(extracted);
   const candidates = Array.from(
      new Set([
         raw.trim(),
         stripped,
         deLabeled,
         balanced,
         extracted,
         escapedBalanced,
         escapedExtracted,
      ])
   );

   let lastError: Error | null = null;
   for (const candidate of candidates) {
      try {
         const parsed = JSON.parse(candidate) as unknown;
         return StoryDraftSchema.parse(parsed);
      } catch (error) {
         if (error instanceof Error) {
            lastError = error;
         } else {
            lastError = new Error('Failed to parse story draft JSON');
         }
      }
   }

   throw lastError ?? new Error('Failed to parse story draft JSON');
}

function extractModelText(result: unknown): string | null {
   if (typeof result === 'string' && result.trim().length > 0) {
      return result;
   }

   if (!result || typeof result !== 'object') return null;

   // Cloudflare OpenAI-family models return chat.completion shape.
   const payload = result as Record<string, unknown>;
   const choices = payload.choices;
   if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0];
      if (first && typeof first === 'object') {
         const text = (first as Record<string, unknown>).text;
         if (typeof text === 'string' && text.trim().length > 0) {
            return text;
         }

         const message = (first as Record<string, unknown>).message;
         if (message && typeof message === 'object') {
            const content = (message as Record<string, unknown>).content;
            if (typeof content === 'string' && content.trim().length > 0) {
               return content;
            }
         }
      }
   }

   // Fallback for older Cloudflare run response shapes.
   const responseText = payload.response;
   if (typeof responseText === 'string' && responseText.trim().length > 0) {
      return responseText;
   }

   const output = payload.output;
   if (!Array.isArray(output)) return null;

   const text = output
      .map(item => {
         if (!item || typeof item !== 'object') return '';
         const row = item as Record<string, unknown>;
         return typeof row.text === 'string' ? row.text : '';
      })
      .join('\n')
      .trim();

   return text.length > 0 ? text : null;
}



function stripEmojis(value: string): string {
   return value
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
      .trim();
}

function stripEmojisFromMarkdown(value: string): string {
   return value.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
}

function normalizeWhitespace(value: string): string {
   return value.replace(/\s+/g, ' ').trim();
}

function normalizeCitationMarkerSpacing(value: string): string {
   // Convert [2][5] or [2]   [5] to [2] [5]
   return value.replace(/\]\s*\[/g, '] [');
}

function countWords(value: string): number {
   return value
      .replace(/[`*_>#\-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
}

function ensureMinimumWordCount(
   bodyMarkdown: string,
   sources: SourceInput[],
   minWords: number
): string {
   const base = bodyMarkdown.trim();
   if (countWords(base) >= minWords) return base;

   const sections: string[] = [base];
   const seenSnippets = new Set<string>();

   for (const source of sources) {
      const rawSnippet = normalizeWhitespace(source.snippet ?? '');
      if (!rawSnippet || rawSnippet.length < 40) continue;

      const dedupeKey = rawSnippet.toLowerCase();
      if (seenSnippets.has(dedupeKey)) continue;
      seenSnippets.add(dedupeKey);

      const snippet = /[.!?]$/.test(rawSnippet) ? rawSnippet : `${rawSnippet}.`;
      sections.push(`${snippet} [${source.rank}]`);

      const current = sections.join('\n\n');
      if (countWords(current) >= minWords) return current;
   }

   return sections.join('\n\n');
}

function assertHeadlineQuestion(headline: string): string {
   const normalized = headline.trim();
   if (normalized.endsWith('?')) return normalized;
   return `${normalized}?`;
}

async function runCloudflareModel(
   model: string,
   messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
   const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
   const apiToken = process.env.CLOUDFLARE_API_TOKEN;

   if (!accountId || !apiToken) {
      throw new Error(
         'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in server/.env'
      );
   }

   const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
   const request = async (body: Record<string, unknown>) =>
      withTimeout(
         fetch(endpoint, {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${apiToken}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
         }),
         REQUEST_TIMEOUT_MS
      );

   const prompt = messages
      .map(message => `${message.role.toUpperCase()}:\n${message.content}`)
      .join('\n\n');

   const isGemmaModel = model.includes('/gemma');

   let response = await request(
      isGemmaModel
         ? {
              prompt,
              temperature: 0.2,
              max_tokens: 1600,
           }
         : {
              messages,
              temperature: 0.2,
              max_tokens: 1600,
           }
   );
   let payload = (await response.json()) as CloudflareRunResponse;
   let text = response.ok ? extractModelText(payload.result) : null;

   const shouldGemmaFallback = isGemmaModel && (!response.ok || !text);

   if (shouldGemmaFallback) {
      response = await request({
         prompt,
         temperature: 0.2,
         max_tokens: 1600,
      });
      payload = (await response.json()) as CloudflareRunResponse;
      text = response.ok ? extractModelText(payload.result) : null;
   }

   if (!response.ok) {
      const message =
         payload.errors?.map(error => error.message).filter(Boolean).join('; ') ||
         `Cloudflare AI request failed with status ${response.status}`;
      throw new Error(message);
   }

   if (!text) {
      throw new Error('Cloudflare AI response did not contain generated text');
   }

   return text;
}

async function runOpenRouterModel(
   model: string,
   messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
   const apiKey = process.env.OPENROUTER_API_KEY;
   const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';

   if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY in server/.env');
   }

   const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
   const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
   };
   if (process.env.OPENROUTER_HTTP_REFERER) {
      headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
   }
   if (process.env.OPENROUTER_APP_NAME) {
      headers['X-Title'] = process.env.OPENROUTER_APP_NAME;
   }

   const response = await withTimeout(
      fetch(endpoint, {
         method: 'POST',
         headers,
         body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 1600,
         }),
      }),
      REQUEST_TIMEOUT_MS
   );

   const payload = (await response.json()) as Record<string, unknown>;

   if (!response.ok) {
      const errorMessage =
         ((payload.error as { message?: string } | undefined)?.message ??
            `OpenRouter request failed with status ${response.status}`) +
         '';
      throw new Error(errorMessage);
   }

   const text = extractModelText(payload);
   if (!text) {
      throw new Error('OpenRouter response did not contain generated text');
   }

   return text;
}

async function generateStoryDraft(
   input: TrendStoryInput,
   model: string
): Promise<StoryDraft> {
   const baseUserPrompt = buildStoryGenerationUserPrompt({
      trendTitle: input.trend.title,
      trendCategory: input.trend.category,
      trendUrl: input.trend.url,
      query: input.query,
      citations: input.sources.map(source => ({
         rank: source.rank,
         title: source.title,
         publisher: source.publisher,
         publishedAt: source.publishedAt
            ? source.publishedAt.toISOString()
            : null,
         url: source.url,
         snippet: source.snippet,
         reliability: source.reliability,
         sourceType: source.sourceType,
      })),
   });

   for (let attempt = 1; attempt <= 2; attempt += 1) {
      const strictReminder =
         attempt === 1
            ? ''
            : '\nReminder: Output must be valid JSON only. No prose outside JSON.';

      try {
         const raw =
            AI_PROVIDER === 'openrouter'
               ? await runOpenRouterModel(model, [
                    { role: 'system', content: STORY_GENERATION_SYSTEM_PROMPT },
                    { role: 'user', content: `${baseUserPrompt}${strictReminder}` },
                 ])
               : await runCloudflareModel(model, [
            { role: 'system', content: STORY_GENERATION_SYSTEM_PROMPT },
            { role: 'user', content: `${baseUserPrompt}${strictReminder}` },
         ]);
         const draft = parseStoryDraftFromModelResponse(raw);
         let bodyMarkdown = normalizeCitationMarkerSpacing(
            draft.body_markdown.trim()
         );

         bodyMarkdown = ensureMinimumWordCount(
            bodyMarkdown,
            input.sources,
            MIN_BODY_WORDS
         );

         if (countWords(bodyMarkdown) < MIN_BODY_WORDS) {
            throw new Error(
               `Generated story body must be at least ${MIN_BODY_WORDS} words`
            );
         }

         const headline = assertHeadlineQuestion(stripEmojis(draft.headline));
         const title = stripEmojis(draft.title);
         const subtitle = stripEmojis(draft.subtitle);

         return {
            ...draft,
            headline,
            title,
            subtitle,
            body_markdown: stripEmojisFromMarkdown(bodyMarkdown),
         };
      } catch (error) {
         if (attempt === 2) {
            const message =
               error instanceof Error
                  ? error.message
                  : 'Failed to parse story draft JSON';
            throw new Error(message);
         }
      }
   }

   throw new Error('Failed to generate story draft');
}

async function generateStoryDraftWithFallback(
   input: TrendStoryInput
): Promise<{ draft: StoryDraft; modelUsed: string }> {
   const models = (
      AI_PROVIDER === 'openrouter'
         ? [DEFAULT_OPENROUTER_MODEL, ...FALLBACK_OPENROUTER_MODELS]
         : [DEFAULT_CF_MODEL, ...FALLBACK_CF_MODELS]
   ).filter(
      (value, index, list) => list.indexOf(value) === index
   );
   let lastError: unknown = null;

   for (const model of models) {
      try {
         const draft = await generateStoryDraft(input, model);
         return { draft, modelUsed: model };
      } catch (error) {
         lastError = error;
      }
   }

   throw lastError instanceof Error
      ? lastError
      : new Error('Story generation failed for all configured models');
}

async function getTrendsForStoryGeneration(
   limit: number
): Promise<TrendStoryInput[]> {
   const existingStoryRows = await prisma.story.findMany({
      select: {
         trend: {
            select: {
               title: true,
               url: true,
            },
         },
      },
   });

   const seenUrls = new Set<string>();
   const seenTitleKeys = new Set<string>();

   existingStoryRows.forEach(row => {
      const normalized = normalizeUrl(row.trend.url);
      if (normalized) seenUrls.add(normalized);

      const key = buildTitleDedupeKey(row.trend.title);
      if (key.length > 0) seenTitleKeys.add(key);
   });

   const rows = await prisma.trend.findMany({
      orderBy: { capturedAt: 'desc' },
      take: Math.max(limit * 4, limit),
      include: {
         story: {
            select: { id: true },
         },
         sources: {
            orderBy: { rank: 'asc' },
            select: {
               rank: true,
               url: true,
               title: true,
               publisher: true,
               publishedAt: true,
               snippet: true,
               imageUrl: true,
               sourceType: true,
               reliability: true,
            },
         },
      },
   });

   const withEnoughSources = rows.filter(
      row => row.sources.length >= MIN_REQUIRED_SOURCES
   );

   const candidates = FORCE_REGENERATE
      ? withEnoughSources
      : withEnoughSources.filter(row => row.story === null);
   const selected: TrendStoryInput[] = [];

   for (const row of candidates) {
      if (selected.length >= limit) break;

      if (isLikelyNoiseTrendTitle(row.title)) {
         console.warn(
            `Skipping trend ${row.id} (${row.title}) because title appears to be navigation/noise content.`
         );
         continue;
      }

      const normalizedUrl = normalizeUrl(row.url);
      const titleKey = buildTitleDedupeKey(row.title);

      const hasUrlDuplicate = normalizedUrl ? seenUrls.has(normalizedUrl) : false;
      const hasTitleDuplicate = titleKey.length > 0 && seenTitleKeys.has(titleKey);
      if (hasUrlDuplicate || hasTitleDuplicate) {
         continue;
      }

      selected.push({
         trend: {
            id: row.id,
            title: row.title,
            category: row.category,
            url: row.url,
            story: row.story,
         },
         query: buildTrendQuery(row.title),
         sources: row.sources,
      });

      if (normalizedUrl) seenUrls.add(normalizedUrl);
      if (titleKey.length > 0) seenTitleKeys.add(titleKey);
   }

   return selected;
}


function isLikelyImageUrl(url: string): boolean {
   try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
   } catch {
      return false;
   }
}

async function isReachableImageUrl(url: string): Promise<boolean> {
   const run = async (method: 'HEAD' | 'GET'): Promise<boolean> => {
      const response = await withTimeout(
         fetch(url, {
            method,
            redirect: 'follow',
            headers: {
               'User-Agent': 'proofline-image-validator/0.1',
               ...(method === 'GET' ? { Range: 'bytes=0-1024' } : {}),
            },
         }),
         IMAGE_CHECK_TIMEOUT_MS
      );

      if (!response.ok) return false;
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      return contentType.startsWith('image/');
   };

   try {
      if (await run('HEAD')) return true;
   } catch {
      // fallback below
   }

   try {
      return await run('GET');
   } catch {
      return false;
   }
}

function toImageAltText(source: SourceInput): string {
   const title = source.title.trim();
   if (title.length > 0) return sanitizeImageAltText(title);
   return sanitizeImageAltText(`${source.publisher} source image`);
}

function sanitizeImageAltText(value: string): string {
   const cleaned = value
      .replace(/\s+/g, ' ')
      .replace(/[[\]]/g, '')
      .trim();
   if (cleaned.length === 0) return 'Story cover image';
   return cleaned.slice(0, 180);
}

async function pickStoryImage(sources: SourceInput[]): Promise<{
   coverImageUrl: string | null;
   coverImageAlt: string;
}> {
   const selected: Array<{ url: string; alt: string }> = [];
   const seen = new Set<string>();

   for (const source of sources) {
      if (!source.imageUrl || seen.has(source.imageUrl)) continue;
      seen.add(source.imageUrl);
      selected.push({
         url: source.imageUrl,
         alt: toImageAltText(source),
      });
      if (selected.length >= IMAGE_CHECK_MAX_CANDIDATES) break;
   }

   if (selected.length === 0) {
      return {
         coverImageUrl: null,
         coverImageAlt: 'News source image',
      };
   }

   const checks = await Promise.all(
      selected.map(async candidate => ({
         ...candidate,
         valid:
            isLikelyImageUrl(candidate.url) &&
            (await isReachableImageUrl(candidate.url)),
      }))
   );

   const valid = checks.filter(candidate => candidate.valid);

   return {
      coverImageUrl: valid[0]?.url ?? null,
      coverImageAlt: valid[0]?.alt ?? 'News source image',
   };
}

function injectStoryImages(
   bodyMarkdown: string,
   coverImageUrl: string | null,
   coverImageAlt: string
): string {
   let body = bodyMarkdown.trim();

   if (coverImageUrl && !containsMarkdownImageForUrl(body, coverImageUrl)) {
      body = `![${sanitizeImageAltText(coverImageAlt)}](${coverImageUrl})\n\n${body}`;
   }

   return body;
}

function containsMarkdownImageForUrl(markdown: string, url: string): boolean {
   const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   const pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`);
   return pattern.test(markdown);
}
async function persistStory(
   input: TrendStoryInput,
   draft: StoryDraft,
   coverImageUrl: string | null,
   coverImageAlt: string
): Promise<{ storyId: string; citationsCount: number }> {
   const story = await prisma.story.upsert({
      where: { trendId: input.trend.id },
      create: {
         trendId: input.trend.id,
         headline: draft.headline,
         title: draft.title,
         subtitle: draft.subtitle,
         bodyMarkdown: injectStoryImages(
            draft.body_markdown,
            coverImageUrl,
            coverImageAlt
         ),
         verdict: draft.verdict,
         confidence: draft.confidence,
         imageUrl: coverImageUrl,
      },
      update: {
         headline: draft.headline,
         title: draft.title,
         subtitle: draft.subtitle,
         bodyMarkdown: injectStoryImages(
            draft.body_markdown,
            coverImageUrl,
            coverImageAlt
         ),
         verdict: draft.verdict,
         confidence: draft.confidence,
         imageUrl: coverImageUrl,
      },
   });

   return {
      storyId: story.id,
      citationsCount: input.sources.length,
   };
}

async function main(): Promise<void> {
   const rows = await getTrendsForStoryGeneration(GENERATE_LIMIT);

   if (rows.length === 0) {
      console.log(
         JSON.stringify(
            {
               message:
                  'No trends with enough sources are ready. Run trends:research first.',
               processed: 0,
               results: [],
            },
            null,
            2
         )
      );
      return;
   }

   const results: GeneratedStoryResult[] = [];
   for (const row of rows) {
      try {
         const { draft } = await generateStoryDraftWithFallback(row);
         const { coverImageUrl, coverImageAlt } = await pickStoryImage(
            row.sources
         );

         if (REQUIRE_STORY_COVER_IMAGE && !coverImageUrl) {
            console.warn(
               `Skipping trend ${row.trend.id} (${row.trend.title}) because no valid cover image was found.`
            );
            continue;
         }

         const persisted = await persistStory(
            row,
            draft,
            coverImageUrl,
            coverImageAlt
         );
         results.push({
            trend_id: row.trend.id,
            trend_title: row.trend.title,
            story_id: persisted.storyId,
            citations_count: persisted.citationsCount,
            verdict: draft.verdict,
            confidence: draft.confidence,
         });
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         console.warn(
            `Skipping trend ${row.trend.id} (${row.trend.title}) due to generation error: ${message}`
         );
      }
   }

   console.log(
      JSON.stringify(
         {
            processed: results.length,
            provider: AI_PROVIDER,
            model:
               AI_PROVIDER === 'openrouter'
                  ? DEFAULT_OPENROUTER_MODEL
                  : DEFAULT_CF_MODEL,
            results,
         },
         null,
         2
      )
   );
}

main()
   .catch(error => {
      console.error('Story generation failed:', error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
