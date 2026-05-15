import { AsyncController } from '../../types/auth.types';
import '../../types/request.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { createCommentSchema } from './comments.schemas';

const OFFICIAL_SYSTEM_AGENT_KEY_ID = 'plak_system';

function parseStoryId(value: string | string[] | undefined): string | null {
   if (!value) return null;
   return Array.isArray(value) ? value[0] ?? null : value;
}

export const httpGetStoryComments: AsyncController = async (req, res, next) => {
   try {
      const storyId = parseStoryId(req.params.storyId);
      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      const story = await prisma.story.findUnique({
         where: { id: storyId },
         select: { id: true },
      });

      if (!story) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Story not found',
            data: null,
         });
      }

      const rows = await prisma.comment.findMany({
         where: { storyId },
         orderBy: { createdAt: 'asc' },
         select: {
            id: true,
            storyId: true,
            actorType: true,
            actorId: true,
            parentCommentId: true,
            authorType: true,
            body: true,
            stance: true,
            createdAt: true,
            updatedAt: true,
         },
      });

      const humanActorIds = Array.from(
         new Set(
            rows
               .filter(row => row.actorType === 'HUMAN')
               .map(row => row.actorId)
         )
      );
      const agentActorIds = Array.from(
         new Set(
            rows
               .filter(row => row.actorType === 'AGENT')
               .map(row => row.actorId)
         )
      );

      const humanProfiles =
         humanActorIds.length > 0
            ? await prisma.profile.findMany({
                 where: { id: { in: humanActorIds } },
                 select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                 },
              })
            : [];

      const humanById = new Map(humanProfiles.map(p => [p.id, p]));
      const agents =
         agentActorIds.length > 0
            ? await prisma.agent.findMany({
                 where: { id: { in: agentActorIds } },
                 select: { id: true, name: true, keyId: true },
              })
            : [];
      const agentById = new Map(agents.map(agent => [agent.id, agent]));

      const enrichedRows = rows.map(row => ({
         ...row,
         actor: row.actorType === 'HUMAN'
            ? {
                 id: row.actorId,
                 type: row.actorType,
                 name: humanById.get(row.actorId)?.name ?? null,
                 avatarUrl: humanById.get(row.actorId)?.avatarUrl ?? null,
                 isOfficialAgent: false,
              }
            : {
                 id: row.actorId,
                 type: row.actorType,
                 name: agentById.get(row.actorId)?.name ?? 'Agent',
                 avatarUrl: null,
                 isOfficialAgent:
                    agentById.get(row.actorId)?.keyId ===
                    OFFICIAL_SYSTEM_AGENT_KEY_ID,
              },
      }));

      const topLevel = enrichedRows.filter(row => row.parentCommentId === null);
      const repliesByParent = new Map<string, typeof enrichedRows>();

      enrichedRows
         .filter(row => row.parentCommentId !== null)
         .forEach(row => {
            const parentId = row.parentCommentId as string;
            const existing = repliesByParent.get(parentId) ?? [];
            existing.push(row);
            repliesByParent.set(parentId, existing);
         });

      const comments = topLevel.map(row => ({
         ...row,
         replies: repliesByParent.get(row.id) ?? [],
      }));

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Comments fetched successfully',
         data: {
            storyId,
            comments,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpCreateStoryComment: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const storyId = parseStoryId(req.params.storyId);
      if (!storyId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'storyId is required',
            data: null,
         });
      }

      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
         const message = parsed.error.issues[0]?.message ?? 'Invalid comment payload';
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message,
            data: null,
         });
      }

      const currentProfile = req.currentProfile;
      const currentAgent = req.currentAgent;
      if (!currentProfile && !currentAgent) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
            data: null,
         });
      }

      if (currentAgent && !currentAgent.scopes.includes('comment:create')) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Agent missing required scope: comment:create',
            data: null,
         });
      }

      const story = await prisma.story.findUnique({
         where: { id: storyId },
         select: { id: true },
      });

      if (!story) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Story not found',
            data: null,
         });
      }

      const created = await prisma.comment.create({
         data: {
            storyId,
            actorType: currentProfile ? 'HUMAN' : 'AGENT',
            actorId: currentProfile ? currentProfile.id : (currentAgent as { id: string }).id,
            parentCommentId: null,
            authorType: currentProfile ? 'HUMAN' : 'AI',
            body: parsed.data.body,
            stance: parsed.data.stance,
         },
         select: {
            id: true,
            storyId: true,
            actorType: true,
            actorId: true,
            parentCommentId: true,
            authorType: true,
            body: true,
            stance: true,
            createdAt: true,
            updatedAt: true,
         },
      });

      let isOfficialAgent = false;
      if (currentAgent) {
         const agentRow = await prisma.agent.findUnique({
            where: { id: currentAgent.id },
            select: { keyId: true },
         });
         isOfficialAgent =
            agentRow?.keyId === OFFICIAL_SYSTEM_AGENT_KEY_ID;
      }

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Comment created successfully',
         data: {
            ...created,
            actor: {
               id: currentProfile ? currentProfile.id : (currentAgent as { id: string }).id,
               type: currentProfile ? 'HUMAN' : 'AGENT',
               name: currentProfile ? currentProfile.name : (currentAgent as { name: string }).name,
               avatarUrl: currentProfile?.avatarUrl ?? null,
               isOfficialAgent,
            },
         },
      });
   } catch (error) {
      next(error);
   }
};
