import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../services/agent.service';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import {
   CreateChatMessageSchema,
   ListChatMessagesQuerySchema,
} from './chat.schemas';
import {
   buildHiddenHumanAgentPrompt,
   findRoomByPublicId,
   serializeChatMessage,
} from './chat.utils';

function getRouteParam(value: string | string[] | undefined) {
   return Array.isArray(value) ? value[0] : value;
}

export const httpListChatMessages: AsyncController = async (req, res, next) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }

      const validated = ListChatMessagesQuerySchema.parse(req.query);
      const room = await findRoomByPublicId(roomId);

      if (!room) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Room not found',
            data: null,
         });
      }

      const messages = await prisma.chatMessage.findMany({
         where: { roomId: room.id },
         include: {
            room: {
               select: { publicId: true },
            },
            senderParticipant: {
               select: {
                  publicId: true,
                  displayName: true,
                  type: true,
               },
            },
         },
         orderBy: { createdAt: 'asc' },
         take: validated.limit,
      });

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Chat messages fetched successfully',
         data: {
            roomId: room.publicId,
            messages: messages.map(serializeChatMessage),
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpCreateChatMessage: AsyncController = async (req, res, next) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }

      const validated = CreateChatMessageSchema.parse(req.body);
      const room = await findRoomByPublicId(roomId);

      if (!room) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Room not found',
            data: null,
         });
      }

      const participant = await prisma.participant.findFirst({
         where: {
            publicId: validated.senderId,
            roomId: room.id,
         },
      });

      if (!participant) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Participant not found in room',
            data: null,
         });
      }

      const senderType =
         participant.type === ParticipantType.AI
            ? ChatSenderType.AI
            : ChatSenderType.HUMAN;

      const message = await prisma.chatMessage.create({
         data: {
            roomId: room.id,
            senderType,
            senderParticipantId: participant.id,
            content: validated.content,
         },
         include: {
            room: {
               select: { publicId: true },
            },
            senderParticipant: {
               select: {
                  publicId: true,
                  displayName: true,
                  type: true,
               },
            },
         },
      });

      if (room.gameId === 'the-hidden-human' && senderType === ChatSenderType.HUMAN) {
         try {
            const [participants, recentMessages] = await Promise.all([
               prisma.participant.findMany({
                  where: { roomId: room.id },
                  orderBy: { joinedAt: 'asc' },
               }),
               prisma.chatMessage.findMany({
                  where: { roomId: room.id },
                  include: {
                     senderParticipant: {
                        select: {
                           id: true,
                           publicId: true,
                           displayName: true,
                           type: true,
                           actorId: true,
                        },
                     },
                  },
                  orderBy: { createdAt: 'asc' },
                  take: 12,
               }),
            ]);

            const aiParticipant = participants.find(
               participant =>
                  participant.type === ParticipantType.AI && participant.actorId
            );

            if (aiParticipant?.actorId) {
               const prompt = buildHiddenHumanAgentPrompt({
                  agentName: aiParticipant.displayName,
                  roomId: room.publicId,
                  participants: participants.map(participant => ({
                     displayName: participant.displayName,
                     type: participant.type,
                     isSelf: participant.id === aiParticipant.id,
                  })),
                  messages: recentMessages.map(item => ({
                     senderName: item.senderParticipant?.displayName ?? 'System',
                     senderType: item.senderType,
                     content: item.content,
                  })),
               });

               const agentReply = await agentService.promptAgentText(
                  aiParticipant.actorId,
                  prompt
               );

               if (agentReply.trim()) {
                  await prisma.chatMessage.create({
                     data: {
                        roomId: room.id,
                        senderType: ChatSenderType.AI,
                        senderParticipantId: aiParticipant.id,
                        content: agentReply.trim(),
                     },
                  });
               }
            }
         } catch (agentError) {
            console.error('Hidden Human agent reply failed:', agentError);
         }
      }

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Chat message created successfully',
         data: serializeChatMessage(message),
      });
   } catch (error) {
      next(error);
   }
};
