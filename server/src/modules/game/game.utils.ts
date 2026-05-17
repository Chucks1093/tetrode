import { GameStatus, Prisma } from '@prisma/client';

export function serializeGame(game: {
   publicId: string;
   title: string;
   description: string;
   status: GameStatus;
   imageUrl: string | null;
   maxPlayers: number;
   maxAgents: number;
   maxActiveRooms: number;
   entryFee: Prisma.Decimal;
   createdAt: Date;
   updatedAt: Date;
}) {
   return {
      id: game.publicId,
      title: game.title,
      description: game.description,
      status: game.status,
      imageUrl: game.imageUrl,
      maxPlayers: game.maxPlayers,
      maxAgents: game.maxAgents,
      maxActiveRooms: game.maxActiveRooms,
      entryFee: Number(game.entryFee),
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
   };
}
