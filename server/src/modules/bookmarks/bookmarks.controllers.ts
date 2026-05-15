import { randomUUID } from 'node:crypto';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';

function parseStoryId(value: string | string[] | undefined): string | null {
   if (!value) return null;
   return Array.isArray(value) ? value[0] ?? null : value;
}

async function ensureStoryExists(storyId: string): Promise<boolean> {
   const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true },
   });
   return Boolean(story);
}

export const httpGetStoryBookmarkStatus: AsyncController = async (
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

      const storyId = parseStoryId(req.params.storyId);
      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
         SELECT "id"
         FROM "Bookmark"
         WHERE "profileId" = ${currentProfile.id}
           AND "storyId" = ${storyId}
         LIMIT 1
      `;

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Bookmark status fetched successfully',
         data: {
            storyId,
            bookmarked: rows.length > 0,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpCreateStoryBookmark: AsyncController = async (
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

      const storyId = parseStoryId(req.params.storyId);
      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      if (!(await ensureStoryExists(storyId))) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Story not found',
            data: null,
         });
      }

      await prisma.$executeRaw`
         INSERT INTO "Bookmark" ("id", "profileId", "storyId", "createdAt")
         VALUES (${randomUUID()}, ${currentProfile.id}, ${storyId}, NOW())
         ON CONFLICT ("profileId", "storyId") DO NOTHING
      `;

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Story bookmarked successfully',
         data: {
            storyId,
            bookmarked: true,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpDeleteStoryBookmark: AsyncController = async (
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

      const storyId = parseStoryId(req.params.storyId);
      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      await prisma.$executeRaw`
         DELETE FROM "Bookmark"
         WHERE "profileId" = ${currentProfile.id}
           AND "storyId" = ${storyId}
      `;

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Story bookmark removed successfully',
         data: {
            storyId,
            bookmarked: false,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetMyBookmarks: AsyncController = async (req, res, next) => {
   try {
      const currentProfile = req.currentProfile;
      if (!currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const rows = await prisma.$queryRaw<
         Array<{
            bookmarkId: string;
            bookmarkedAt: Date;
            storyId: string;
            trendId: string;
            headline: string;
            title: string;
            subtitle: string;
            verdict: string;
            confidence: number;
            imageUrl: string | null;
            storyCreatedAt: Date;
         }>
      >`
         SELECT
            b."id" AS "bookmarkId",
            b."createdAt" AS "bookmarkedAt",
            s."id" AS "storyId",
            s."trendId" AS "trendId",
            s."headline" AS "headline",
            s."title" AS "title",
            s."subtitle" AS "subtitle",
            s."verdict" AS "verdict",
            s."confidence" AS "confidence",
            s."imageUrl" AS "imageUrl",
            s."createdAt" AS "storyCreatedAt"
         FROM "Bookmark" b
         INNER JOIN "Story" s ON s."id" = b."storyId"
         WHERE b."profileId" = ${currentProfile.id}
         ORDER BY b."createdAt" DESC
      `;

      const trendIds = Array.from(new Set(rows.map(row => row.trendId)));
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

      const enrichedRows = rows.map(row => ({
         ...row,
         trend: trendById.get(row.trendId) ?? null,
         citationsCount: citationCountByTrendId.get(row.trendId) ?? 0,
         sourcePreviews: sourcePreviewByTrendId.get(row.trendId) ?? [],
      }));

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Bookmarks fetched successfully',
         data: {
            bookmarks: enrichedRows,
         },
      });
   } catch (error) {
      next(error);
   }
};
