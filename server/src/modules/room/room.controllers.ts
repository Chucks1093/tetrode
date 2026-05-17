import { randomUUID } from 'crypto';
import { Prisma, ParticipantType, RoomStatus } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { agentService } from '../../services/agent.service';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import {
   CreateRoomSchema,
   JoinRoomSchema,
   LeaveRoomSchema,
   ListRoomsQuerySchema,
} from './room.schemas';
import { findRoomWithParticipants, serializeRoom } from './room.utils';

function getRouteParam(value: string | string[] | undefined) {
   return Array.isArray(value) ? value[0] : value;
}

export const httpCreateRoom: AsyncController = async (req, res, next) => {
   try {
      const validated = CreateRoomSchema.parse(req.body);
      let hiddenHumanAgentSessionId: string | null = null;

      if (validated.gameId === 'the-hidden-human') {
         const agent = await agentService.createAgent({
            title: 'The Hidden Human Agent',
         });
         hiddenHumanAgentSessionId = agent.id;
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
                  ...(validated.gameId === 'the-hidden-human'
                     ? [
                          {
                             type: ParticipantType.AI,
                             actorId:
                                hiddenHumanAgentSessionId ?? randomUUID(),
                             displayName: 'Agent-7',
                          },
                       ]
                     : []),
               ],
            },
         },
         include: {
            participants: {
               orderBy: { joinedAt: 'asc' },
            },
         },
      });

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Room created successfully',
         data: serializeRoom(room),
      });
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
            participants:
               serializeRoom(room).participants ?? [],
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
            room: {
               publicId: roomId,
            },
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
