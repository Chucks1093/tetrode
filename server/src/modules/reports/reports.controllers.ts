import { randomUUID } from 'node:crypto';
import { AsyncController } from '../../types/auth.types';
import '../../types/request.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { createReportSchema } from './reports.schemas';

async function ensureTargetExists(
   targetType: 'STORY' | 'COMMENT',
   targetId: string
): Promise<boolean> {
   if (targetType === 'STORY') {
      const story = await prisma.story.findUnique({
         where: { id: targetId },
         select: { id: true },
      });
      return Boolean(story);
   }

   const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { id: true },
   });
   return Boolean(comment);
}

export const httpCreateReport: AsyncController = async (req, res, next) => {
   try {
      const currentProfile = req.currentProfile;
      if (!currentProfile) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      const parsed = createReportSchema.safeParse(req.body);
      if (!parsed.success) {
         const message = parsed.error.issues[0]?.message ?? 'Invalid report payload';
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message,
            data: null,
         });
      }

      const { targetType, targetId, reason, details } = parsed.data;
      const targetExists = await ensureTargetExists(targetType, targetId);

      if (!targetExists) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: `${targetType === 'STORY' ? 'Story' : 'Comment'} not found`,
            data: null,
         });
      }

      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
         SELECT "id"
         FROM "Report"
         WHERE "reporterProfileId" = ${currentProfile.id}
           AND "targetType" = ${targetType}::"ReportTargetType"
           AND "targetId" = ${targetId}
         LIMIT 1
      `;

      if (existing.length > 0) {
         return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'You already reported this item',
            data: null,
         });
      }

      const rows = await prisma.$queryRaw<
         Array<{
            id: string;
            targetType: 'STORY' | 'COMMENT';
            targetId: string;
            reason: 'MISINFORMATION' | 'HARASSMENT' | 'SPAM' | 'HATE' | 'OTHER';
            details: string | null;
            status: 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
            createdAt: Date;
         }>
      >`
         INSERT INTO "Report" (
            "id",
            "reporterProfileId",
            "targetType",
            "targetId",
            "reason",
            "details",
            "status",
            "createdAt",
            "updatedAt"
         ) VALUES (
            ${randomUUID()},
            ${currentProfile.id},
            ${targetType}::"ReportTargetType",
            ${targetId},
            ${reason}::"ReportReason",
            ${details ?? null},
            'OPEN'::"ReportStatus",
            NOW(),
            NOW()
         )
         RETURNING
            "id",
            "targetType",
            "targetId",
            "reason",
            "details",
            "status",
            "createdAt"
      `;

      const created = rows[0];
      if (!created) {
         return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to submit report',
            data: null,
         });
      }

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Report submitted successfully',
         data: created,
      });
   } catch (error) {
      return next(error);
   }
};
