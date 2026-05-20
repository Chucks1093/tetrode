import { ChatSenderType, Prisma, ParticipantType, RoomStatus } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { agentService } from '../../services/agent.service';
import { io } from '../../socket';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { emitRoomMessage, onRoomMessage, offRoomMessage, clearRoomBus, type SerializedMessage } from './room.bus';
import {
   CreateRoomSchema,
   JoinRoomSchema,
   LeaveRoomSchema,
   ListRoomsQuerySchema,
} from './room.schemas';
import { findRoomWithParticipants, serializeRoom } from './room.utils';
import { buildRoomStartPrompt, buildHiddenHumanAgentPrompt, pickAgentNames, serializeChatMessage } from '../chat/chat.utils';

// Characters per second a human typist produces — controls how long typing indicator shows
const TYPING_CHARS_PER_SEC = 3;
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 15000;

function calcTypingDelay(text: string): number {
   const ms = (text.length / TYPING_CHARS_PER_SEC) * 1000;
   return Math.min(Math.max(ms, TYPING_MIN_MS), TYPING_MAX_MS);
}

// Per-agent state — lives in server memory for the lifetime of each room
const thinking = new Set<string>();

type RoomState = {
   handlers: Array<(msg: SerializedMessage) => void>;
   agentIds: string[];
};
const activeRooms = new Map<string, RoomState>();

function getRouteParam(value: string | string[] | undefined) {
   return Array.isArray(value) ? value[0] : value;
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

async function agentSaveAndEmit(
   agent: { id: string; publicId: string; actorId: string; displayName: string },
   roomPublicId: string,
   roomId: string,
   participants: Array<{ id: string; displayName: string }>
) {
   if (thinking.has(agent.id)) return;

   thinking.add(agent.id);

   try {
      // Brief pause so any message sent just before this trigger lands in DB
      await new Promise(resolve => setTimeout(resolve, 400));

      const recentMessages = await prisma.chatMessage.findMany({
         where: { roomId },
         include: { senderParticipant: { select: { displayName: true } } },
         orderBy: { createdAt: 'asc' },
         take: 15,
      });

      const participantList = participants.map(p => ({
         displayName: p.displayName,
         isSelf: p.id === agent.id,
      }));

      const prompt = recentMessages.length === 0
         ? buildRoomStartPrompt({
              agentName: agent.displayName,
              actorId: agent.actorId,
              participants: participantList,
           })
         : buildHiddenHumanAgentPrompt({
              agentName: agent.displayName,
              actorId: agent.actorId,
              participants: participantList,
              messages: recentMessages.map(m => ({
                 senderName: m.senderParticipant?.displayName ?? 'Unknown',
                 content: m.content,
              })),
           });

      const raw = await agentService.promptAgentText(agent.actorId, prompt);
      const parts = raw
         .split('|')
         .map(p => p.replace(/\s+/g, ' ').trim())
         .filter(Boolean);

      if (parts.length === 0 || parts[0].toUpperCase() === 'IGNORE') return;

      for (let i = 0; i < parts.length; i++) {
         const content = parts[i]!;

         io.to(roomPublicId).emit('agent:typing', {
            agentId: agent.publicId,
            name: agent.displayName,
         });
         await new Promise(resolve => setTimeout(resolve, calcTypingDelay(content)));

         const saved = await prisma.chatMessage.create({
            data: {
               roomId,
               senderType: ChatSenderType.AI,
               senderParticipantId: agent.id,
               content,
            },
            include: {
               room: { select: { publicId: true } },
               senderParticipant: {
                  select: { publicId: true, displayName: true, type: true },
               },
            },
         });

         const serialized = serializeChatMessage(saved);

         io.to(roomPublicId).emit('agent:stop-typing', { agentId: agent.publicId });
         io.to(roomPublicId).emit('message:new', serialized);
         emitRoomMessage(roomPublicId, serialized);

         // Small pause between parts before typing the next one
         if (i < parts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
         }
      }
   } catch (error) {
      console.error(`Agent ${agent.displayName} failed:`, error);
      io.to(roomPublicId).emit('agent:stop-typing', { agentId: agent.publicId });
   } finally {
      thinking.delete(agent.id);
   }
}

function subscribeAgents(
   roomPublicId: string,
   roomId: string,
   aiParticipants: Array<{ id: string; publicId: string; actorId: string; displayName: string }>,
   allParticipants: Array<{ id: string; displayName: string }>
) {
   const handlers: Array<(msg: SerializedMessage) => void> = [];

   for (const agent of aiParticipants) {
      const handler = (message: SerializedMessage) => {
         if (message.senderId === agent.publicId) return;
         void agentSaveAndEmit(agent, roomPublicId, roomId, allParticipants);
      };

      onRoomMessage(roomPublicId, handler);
      handlers.push(handler);
   }

   activeRooms.set(roomPublicId, {
      handlers,
      agentIds: aiParticipants.map(a => a.id),
   });
}

function unsubscribeAgents(roomPublicId: string) {
   const state = activeRooms.get(roomPublicId);
   if (!state) return;

   for (const handler of state.handlers) {
      offRoomMessage(roomPublicId, handler);
   }
   for (const agentId of state.agentIds) {
      thinking.delete(agentId);
   }

   clearRoomBus(roomPublicId);
   activeRooms.delete(roomPublicId);
}

function startRoom(
   roomPublicId: string,
   roomId: string,
   participants: Array<{
      id: string;
      publicId: string;
      actorId: string;
      displayName: string;
      type: ParticipantType;
   }>
) {
   const aiParticipants = participants.filter(
      p => p.type === ParticipantType.AI && p.actorId
   );
   if (aiParticipants.length === 0) return;

   // Subscribe all agents to the bus first
   subscribeAgents(roomPublicId, roomId, aiParticipants, participants);

   // One random agent opens — when it posts the bus fires and others react naturally
   const opener = aiParticipants[Math.floor(Math.random() * aiParticipants.length)];
   void agentSaveAndEmit(opener, roomPublicId, roomId, participants);
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const httpCreateRoom: AsyncController = async (req, res, next) => {
   try {
      const validated = CreateRoomSchema.parse(req.body);
      const game = await prisma.game.findUnique({
         where: { publicId: validated.gameId },
      });

      if (!game) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Game not found',
            data: null,
         });
      }

      const createdAgentSessionIds: string[] = [];

      try {
         const agentNames = pickAgentNames(game.maxAgents);

         for (let index = 0; index < game.maxAgents; index += 1) {
            const agent = await agentService.createAgent({
               title: `${game.title} — ${agentNames[index]}`,
            });
            createdAgentSessionIds.push(agent.id);
         }

         const room = await prisma.room.create({
            data: {
               gameId: validated.gameId,
               participants: {
                  create: [
                     {
                        type: ParticipantType.HUMAN,
                        actorId: validated.actorId,
                        displayName: validated.displayName,
                     },
                     ...createdAgentSessionIds.map((agentSessionId, index) => ({
                        type: ParticipantType.AI,
                        actorId: agentSessionId,
                        displayName: agentNames[index] ?? `Player${index + 1}`,
                     })),
                  ],
               },
            },
            include: {
               participants: {
                  orderBy: { joinedAt: 'asc' },
               },
            },
         });

         res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Room created successfully',
            data: serializeRoom(room),
         });

         startRoom(room.publicId, room.id, room.participants);

         return;
      } catch (error) {
         if (createdAgentSessionIds.length > 0) {
            await Promise.allSettled(
               createdAgentSessionIds.map(agentId =>
                  agentService.deleteAgent(agentId)
               )
            );
         }
         throw error;
      }
   } catch (error) {
      next(error);
   }
};

export const httpListRooms: AsyncController = async (req, res, next) => {
   try {
      const validated = ListRoomsQuerySchema.parse(req.query);

      const where: Prisma.RoomWhereInput = {
         ...(validated.gameId ? { gameId: validated.gameId } : {}),
         ...(validated.status ? { status: validated.status as RoomStatus } : {}),
      };

      const [rooms, total] = await Promise.all([
         prisma.room.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: validated.offset,
            take: validated.limit,
            include: {
               participants: {
                  orderBy: { joinedAt: 'asc' },
               },
            },
         }),
         prisma.room.count({ where }),
      ]);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Rooms fetched successfully',
         data: {
            rooms: rooms.map(serializeRoom),
            pagination: {
               total,
               limit: validated.limit,
               offset: validated.offset,
               hasMore: validated.offset + rooms.length < total,
            },
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetRoomById: AsyncController = async (req, res, next) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }
      const room = await findRoomWithParticipants(roomId);

      if (!room) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Room not found',
            data: null,
         });
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Room fetched successfully',
         data: serializeRoom(room),
      });
   } catch (error) {
      next(error);
   }
};

export const httpGetRoomParticipants: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }
      const room = await findRoomWithParticipants(roomId);

      if (!room) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Room not found',
            data: null,
         });
      }

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Room participants fetched successfully',
         data: {
            roomId: room.publicId,
            participants: serializeRoom(room).participants ?? [],
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpJoinRoom: AsyncController = async (req, res, next) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }
      const validated = JoinRoomSchema.parse(req.body);
      const room = await prisma.room.findUnique({
         where: { publicId: roomId },
      });

      if (!room) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Room not found',
            data: null,
         });
      }

      if (room.status !== RoomStatus.WAITING) {
         return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Room is no longer accepting participants',
            data: null,
         });
      }
      const existingParticipant = await prisma.participant.findFirst({
         where: {
            roomId: room.id,
            type: validated.type as ParticipantType,
            actorId: validated.actorId,
         },
      });

      if (existingParticipant) {
         return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'Participant already joined this room',
            data: null,
         });
      }

      const participant = await prisma.participant.create({
         data: {
            roomId: room.id,
            type: validated.type as ParticipantType,
            actorId: validated.actorId,
            displayName: validated.displayName,
         },
      });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Joined room successfully',
         data: {
            participant: {
               id: participant.publicId,
               roomId: room.publicId,
               type: participant.type,
               actorId: participant.actorId,
               displayName: participant.displayName,
               joinedAt: participant.joinedAt,
            },
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpLeaveRoom: AsyncController = async (req, res, next) => {
   try {
      const roomId = getRouteParam(req.params.roomId);
      if (!roomId) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'roomId is required',
            data: null,
         });
      }
      const validated = LeaveRoomSchema.parse(req.body);

      const participant = await prisma.participant.findFirst({
         where: {
            publicId: validated.participantId,
            room: { publicId: roomId },
         },
      });

      if (!participant) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Participant not found in room',
            data: null,
         });
      }

      await prisma.participant.delete({
         where: { id: participant.id },
      });

      // Clean up agent subscriptions when room is vacated
      unsubscribeAgents(roomId);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Left room successfully',
         data: {
            participantId: participant.publicId,
            roomId,
         },
      });
   } catch (error) {
      next(error);
   }
};
