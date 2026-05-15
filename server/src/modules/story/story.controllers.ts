import { AsyncController } from '../../types/auth.types';
import { prisma } from '../../utils/prisma.utils';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { z } from 'zod';

type ParsedPagination = {
   limit: number;
   offset: number;
};

type ParsedSourcePublisherQuery = {
   limit: number;
};

const FollowPublisherSchema = z.object({
   publisher: z.string().trim().min(1).max(120),
});

function normalizePublisherKey(value: string): string {
   return value.trim().toLowerCase().replace(/^www\./, '');
}

function parsePagination(
   limitValue: string | undefined,
   offsetValue: string | undefined
): ParsedPagination {
   const parsedLimit = Number(limitValue ?? '20');
   const parsedOffset = Number(offsetValue ?? '0');

   const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 20;

   const offset = Number.isFinite(parsedOffset)
      ? Math.max(Math.trunc(parsedOffset), 0)
      : 0;

   return { limit, offset };
}

function parseAgentPagination(
   limitValue: string | undefined,
   offsetValue: string | undefined
): ParsedPagination {
   const parsedLimit = Number(limitValue ?? '5');
   const parsedOffset = Number(offsetValue ?? '0');

   const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 20)
      : 5;

   const offset = Number.isFinite(parsedOffset)
      ? Math.max(Math.trunc(parsedOffset), 0)
      : 0;

   return { limit, offset };
}

function parseSourcePublisherQuery(
   limitValue: string | undefined
): ParsedSourcePublisherQuery {
   const parsedLimit = Number(limitValue ?? '60');
   const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200)
      : 60;
   return { limit };
}

async function fetchStoryFeed(limit: number, offset: number) {
   const [stories, total] = await Promise.all([
      prisma.story.findMany({
         orderBy: { createdAt: 'desc' },
         take: limit,
         skip: offset,
         select: {
            id: true,
            trendId: true,
            headline: true,
            title: true,
            subtitle: true,
            verdict: true,
            confidence: true,
            imageUrl: true,
            createdAt: true,
         },
      }),
      prisma.story.count(),
   ]);

   const trendIds = Array.from(new Set(stories.map(story => story.trendId)));
   const [trends, sources] = await Promise.all([
      prisma.trend.findMany({
         where: { id: { in: trendIds } },
         select: {
            id: true,
            title: true,
            category: true,
            url: true,
         },
      }),
      prisma.source.findMany({
         where: { trendId: { in: trendIds } },
         orderBy: { rank: 'asc' },
         select: {
            trendId: true,
            rank: true,
            url: true,
            publisher: true,
            imageUrl: true,
            faviconUrl: true,
         },
      }),
   ]);

   const trendById = new Map(trends.map(trend => [trend.id, trend]));
   const citationCountByTrendId = new Map<string, number>();
   const sourcePreviewByTrendId = new Map<
      string,
      Array<{
         rank: number;
         url: string;
         publisher: string;
         imageUrl: string | null;
         faviconUrl: string | null;
      }>
   >();

   sources.forEach(source => {
      citationCountByTrendId.set(
         source.trendId,
         (citationCountByTrendId.get(source.trendId) ?? 0) + 1
      );

      const current = sourcePreviewByTrendId.get(source.trendId) ?? [];
      if (current.length < 3) {
         current.push({
            rank: source.rank,
            url: source.url,
            publisher: source.publisher,
            imageUrl: source.imageUrl,
            faviconUrl: source.faviconUrl,
         });
         sourcePreviewByTrendId.set(source.trendId, current);
      }
   });

   const data = stories.map(story => ({
      id: story.id,
      headline: story.headline,
      title: story.title,
      subtitle: story.subtitle,
      verdict: story.verdict,
      confidence: story.confidence,
      imageUrl: story.imageUrl,
      createdAt: story.createdAt,
      trend: trendById.get(story.trendId) ?? null,
      citationsCount: citationCountByTrendId.get(story.trendId) ?? 0,
      sourcePreviews: sourcePreviewByTrendId.get(story.trendId) ?? [],
   }));

   return {
      stories: data,
      pagination: {
         total,
         limit,
         offset,
         hasMore: offset + data.length < total,
      },
   };
}

export const httpGetStories: AsyncController = async (req, res, next) => {
   try {
      const { limit, offset } = parsePagination(
         req.query.limit as string | undefined,
         req.query.offset as string | undefined
      );

      const data = await fetchStoryFeed(limit, offset);

      res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Stories fetched successfully',
         data,
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetAgentStories: AsyncController = async (req, res, next) => {
   try {
      const { limit, offset } = parseAgentPagination(
         req.query.limit as string | undefined,
         req.query.offset as string | undefined
      );
      const data = await fetchStoryFeed(limit, offset);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Agent stories fetched successfully',
         data,
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetStoryById: AsyncController = async (req, res, next) => {
   try {
      const storyIdParam = req.params.storyId;
      const storyId = Array.isArray(storyIdParam)
         ? storyIdParam[0]
         : storyIdParam;

      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      const story = await prisma.story.findUnique({
         where: { id: storyId },
         select: {
            id: true,
            trendId: true,
            headline: true,
            title: true,
            subtitle: true,
            bodyMarkdown: true,
            verdict: true,
            confidence: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
         },
      });

      if (!story) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Story not found',
            data: null,
         });
      }

      const [trend, citations] = await Promise.all([
         prisma.trend.findUnique({
            where: { id: story.trendId },
            select: {
               id: true,
               title: true,
               category: true,
               url: true,
               publishedAt: true,
            },
         }),
         prisma.source.findMany({
            where: { trendId: story.trendId },
            orderBy: { rank: 'asc' },
            select: {
               rank: true,
               url: true,
               title: true,
               publisher: true,
               publishedAt: true,
               snippet: true,
               faviconUrl: true,
               sourceType: true,
               reliability: true,
            },
         }),
      ]);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Story fetched successfully',
         data: {
            id: story.id,
            headline: story.headline,
            title: story.title,
            subtitle: story.subtitle,
            bodyMarkdown: story.bodyMarkdown,
            verdict: story.verdict,
            confidence: story.confidence,
            imageUrl: story.imageUrl,
            createdAt: story.createdAt,
            updatedAt: story.updatedAt,
            trend,
            citations,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetSourcePublishers: AsyncController = async (req, res, next) => {
   try {
      const { limit } = parseSourcePublisherQuery(
         req.query.limit as string | undefined
      );

      const rows = await prisma.source.findMany({
         where: {
            publisher: {
               not: '',
            },
         },
         orderBy: [{ createdAt: 'desc' }],
         select: {
            publisher: true,
            faviconUrl: true,
         },
      });

      const byPublisher = new Map<
         string,
         { publisher: string; faviconUrl: string | null; storyCount: number }
      >();

      rows.forEach(row => {
         const normalizedPublisher = row.publisher.trim().toLowerCase();
         if (!normalizedPublisher) return;

         const existing = byPublisher.get(normalizedPublisher);
         if (!existing) {
            byPublisher.set(normalizedPublisher, {
               publisher: row.publisher.trim(),
               faviconUrl: row.faviconUrl,
               storyCount: 1,
            });
            return;
         }

         existing.storyCount += 1;
         if (!existing.faviconUrl && row.faviconUrl) {
            existing.faviconUrl = row.faviconUrl;
         }
      });

      const publishers = Array.from(byPublisher.values())
         .sort((a, b) => b.storyCount - a.storyCount)
         .slice(0, limit);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Source publishers fetched successfully',
         data: {
            publishers,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetFollowedSourcePublishers: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const currentProfile = req.currentProfile;
      if (!currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const rows = await prisma.followSource.findMany({
         where: { profileId: currentProfile.id },
         orderBy: { createdAt: 'desc' },
         select: {
            publisher: true,
            publisherKey: true,
         },
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Followed source publishers fetched successfully',
         data: {
            publishers: rows,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpFollowSourcePublisher: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const currentProfile = req.currentProfile;
      if (!currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const parsedBody = FollowPublisherSchema.safeParse(req.body);
      if (!parsedBody.success) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'publisher is required',
            data: null,
         });
      }

      const publisherInput = parsedBody.data.publisher;
      const publisherKey = normalizePublisherKey(publisherInput);

      const existingSource = await prisma.source.findFirst({
         where: {
            publisher: {
               equals: publisherInput,
               mode: 'insensitive',
            },
         },
         select: {
            publisher: true,
         },
      });

      if (!existingSource) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Publisher not found',
            data: null,
         });
      }

      const followed = await prisma.followSource.upsert({
         where: {
            profileId_publisherKey: {
               profileId: currentProfile.id,
               publisherKey,
            },
         },
         update: {
            publisher: existingSource.publisher,
         },
         create: {
            profileId: currentProfile.id,
            publisherKey,
            publisher: existingSource.publisher,
         },
         select: {
            publisher: true,
            publisherKey: true,
         },
      });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Source publisher followed successfully',
         data: followed,
      });
   } catch (error) {
      next(error);
   }
};

export const httpUnfollowSourcePublisher: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const currentProfile = req.currentProfile;
      if (!currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const parsedBody = FollowPublisherSchema.safeParse(req.body);
      if (!parsedBody.success) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'publisher is required',
            data: null,
         });
      }

      const publisherKey = normalizePublisherKey(parsedBody.data.publisher);

      await prisma.followSource.deleteMany({
         where: {
            profileId: currentProfile.id,
            publisherKey,
         },
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Source publisher unfollowed successfully',
         data: {
            publisherKey,
         },
      });
   } catch (error) {
      next(error);
   }
};
