import { z } from 'zod';
import { prisma } from '../utils/prisma.utils';
import {
   COMMENT_REPLY_SYSTEM_PROMPT,
   buildCommentReplyUserPrompt,
} from '../prompts/comment-reply.prompt';
import { AgentAuthService } from '../services/agent-auth.service';

const DEFAULT_CF_MODEL =
   process.env.CLOUDFLARE_AI_MODEL ?? '@cf/openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = Number(
   process.env.COMMENTS_REPLY_REQUEST_TIMEOUT_MS ?? '30000'
);
const REPLY_LIMIT = Number(process.env.COMMENTS_REPLY_LIMIT ?? '12');

const ReplySchema = z.object({
   reply: z.string().trim().min(12).max(1200),
});

type CloudflareRunResponse = {
   result?: unknown;
   errors?: Array<{ message?: string }>;
};

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

function extractJsonObjectCandidate(value: string): string {
   const start = value.indexOf('{');
   const end = value.lastIndexOf('}');
   if (start === -1 || end === -1 || end <= start) return value;
   return value.slice(start, end + 1);
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

function parseReply(raw: string): string {
   const stripped = stripJsonFence(raw);
   const extracted = extractJsonObjectCandidate(stripped);
   const candidates = Array.from(new Set([stripped, extracted]));

   let lastError: Error | null = null;
   for (const candidate of candidates) {
      try {
         const parsed = JSON.parse(candidate) as unknown;
         return ReplySchema.parse(parsed).reply;
      } catch (error) {
         if (error instanceof Error) {
            lastError = error;
         } else {
            lastError = new Error('Failed to parse reply JSON');
         }
      }
   }

   throw lastError ?? new Error('Failed to parse reply JSON');
}

function normalizeCitationMarkerSpacing(value: string): string {
   return value.replace(/\]\s*\[/g, '] [');
}

function hasCitationMarkers(value: string): boolean {
   const markers = value.match(/\[\d+\]/g) ?? [];
   return markers.length >= 1;
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
              max_tokens: 600,
           }
         : {
              messages,
              temperature: 0.2,
              max_tokens: 600,
           }
   );
   let payload = (await response.json()) as CloudflareRunResponse;
   let text = response.ok ? extractModelText(payload.result) : null;

   const shouldGemmaFallback = isGemmaModel && (!response.ok || !text);

   if (shouldGemmaFallback) {
      response = await request({
         prompt,
         temperature: 0.2,
         max_tokens: 600,
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

async function ensureSystemAgentId(): Promise<string> {
   const existing = await prisma.agent.findFirst({
      where: { keyId: 'plak_system' },
      select: { id: true },
   });

   if (existing) return existing.id;

   const created = await prisma.agent.create({
      data: {
         name: 'Proofline AI',
         ownerEmail: 'system@proofline.local',
         ownerVerified: true,
         status: 'ACTIVE',
         keyId: 'plak_system',
         secretHash: AgentAuthService.hashSecret('secret_system'),
         scopes: ['stories:read', 'comment:create'],
      },
      select: { id: true },
   });

   return created.id;
}

async function main(): Promise<void> {
   const systemAgentId = await ensureSystemAgentId();

   const comments = await prisma.comment.findMany({
      where: {
         authorType: 'HUMAN',
         parentCommentId: null,
         replies: {
            none: {
               authorType: 'AI',
            },
         },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.max(REPLY_LIMIT * 3, REPLY_LIMIT),
      include: {
         story: {
            include: {
               trend: {
                  include: {
                     sources: {
                        orderBy: { rank: 'asc' },
                        select: {
                           rank: true,
                           title: true,
                           publisher: true,
                           publishedAt: true,
                           url: true,
                           snippet: true,
                           reliability: true,
                        },
                     },
                  },
               },
            },
         },
      },
   });

   const processed: Array<{ comment_id: string; ai_comment_id: string }> = [];
   const skipped: Array<{ comment_id: string; reason: string }> = [];

   for (const comment of comments) {
      if (processed.length >= REPLY_LIMIT) break;

      const citations = comment.story.trend.sources;

      try {
         const userPrompt = buildCommentReplyUserPrompt({
            storyTitle: comment.story.title,
            storySubtitle: comment.story.subtitle,
            storyVerdict: comment.story.verdict,
            storyConfidence: comment.story.confidence,
            humanComment: comment.body,
            humanStance: comment.stance,
            citations: citations.map(citation => ({
               rank: citation.rank,
               title: citation.title,
               publisher: citation.publisher,
               publishedAt: citation.publishedAt
                  ? citation.publishedAt.toISOString()
                  : null,
               url: citation.url,
               snippet: citation.snippet,
               reliability: citation.reliability,
            })),
         });

         const raw = await runCloudflareModel(DEFAULT_CF_MODEL, [
            { role: 'system', content: COMMENT_REPLY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
         ]);

         const replyBody = normalizeCitationMarkerSpacing(parseReply(raw));
         if (!hasCitationMarkers(replyBody)) {
            skipped.push({
               comment_id: comment.id,
               reason: 'missing_citation_markers',
            });
            continue;
         }

         const created = await prisma.comment.create({
            data: {
               storyId: comment.storyId,
               actorType: 'AGENT',
               actorId: systemAgentId,
               parentCommentId: comment.id,
               authorType: 'AI',
               body: replyBody,
               stance: 'NEUTRAL',
            },
            select: { id: true },
         });

         processed.push({
            comment_id: comment.id,
            ai_comment_id: created.id,
         });
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         skipped.push({
            comment_id: comment.id,
            reason: `generation_error:${message}`,
         });
      }
   }

   console.log(
      JSON.stringify(
         {
            processed: processed.length,
            skipped: skipped.length,
            model: DEFAULT_CF_MODEL,
            created_replies: processed,
            skipped_comments: skipped,
         },
         null,
         2
      )
   );
}

main()
   .catch(error => {
      console.error('Comment reply job failed:', error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
