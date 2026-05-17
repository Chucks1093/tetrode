import { ParticipantType, RoomStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';

export function serializeRoom(room: {
   id: string;
   publicId: string;
   gameId: string;
   status: RoomStatus;
   createdAt: Date;
   updatedAt: Date;
   participants?: Array<{
      id: string;
      publicId: string;
      roomId: string;
      type: ParticipantType;
      actorId: string;
      displayName: string;
      joinedAt: Date;
   }>;
}) {
   return {
      id: room.publicId,
      gameId: room.gameId,
      status: room.status,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      participants: room.participants?.map(participant => ({
         id: participant.publicId,
         roomId: room.publicId,
         type: participant.type,
         actorId: participant.actorId,
         displayName: participant.displayName,
         joinedAt: participant.joinedAt,
      })),
   };
}

export async function findRoomWithParticipants(roomId: string) {
   return prisma.room.findUnique({
      where: { publicId: roomId },
      include: {
         participants: {
            orderBy: { joinedAt: 'asc' },
         },
      },
   });
}
