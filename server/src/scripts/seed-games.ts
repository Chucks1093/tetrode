import { GameStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.utils';

const games: Array<{
   publicId: string;
   title: string;
   description: string;
   status: GameStatus;
   imageUrl: string;
   maxPlayers: number;
   maxAgents: number;
   maxActiveRooms: number;
   entryFee: Prisma.Decimal;
}> = [
   {
      publicId: 'the-hidden-human',
      title: 'The Hidden Human',
      description:
         'All players appear to be AI agents, but one is secretly human and must survive suspicion.',
      status: GameStatus.ACTIVE,
      imageUrl: '/images/games/game-1.jpeg',
      maxPlayers: 1,
      maxAgents: 2,
      maxActiveRooms: 100,
      entryFee: new Prisma.Decimal('0.30'),
   },
   {
      publicId: 'hunt-the-ai',
      title: 'Hunt The AI',
      description:
         'Players interrogate, accuse, and vote to expose the hidden AI before time runs out.',
      status: GameStatus.COMING_SOON,
      imageUrl: '/images/games/game-2.jpeg',
      maxPlayers: 6,
      maxAgents: 5,
      maxActiveRooms: 100,
      entryFee: new Prisma.Decimal('0.20'),
   },
   {
      publicId: 'mind-match',
      title: 'Mind Match',
      description:
         'Humans collaborate with AI using clues to align interpretation and guess hidden words.',
      status: GameStatus.COMING_SOON,
      imageUrl: '/images/games/game-3.jpeg',
      maxPlayers: 4,
      maxAgents: 3,
      maxActiveRooms: 100,
      entryFee: new Prisma.Decimal('0.15'),
   },
   {
      publicId: 'mindflip',
      title: 'MindFlip',
      description:
         'Secret choices, pattern reading, and bluffing create layered social prediction battles.',
      status: GameStatus.COMING_SOON,
      imageUrl: '/images/games/game-4.jpeg',
      maxPlayers: 5,
      maxAgents: 4,
      maxActiveRooms: 100,
      entryFee: new Prisma.Decimal('0.10'),
   },
];

async function main() {
   for (const game of games) {
      await prisma.game.upsert({
         where: { publicId: game.publicId },
         update: {
            title: game.title,
            description: game.description,
            status: game.status,
            imageUrl: game.imageUrl,
            maxPlayers: game.maxPlayers,
            maxAgents: game.maxAgents,
            maxActiveRooms: game.maxActiveRooms,
            entryFee: game.entryFee,
         },
         create: game,
      });
   }

   console.log(`Seeded ${games.length} games.`);
}

main()
   .catch(error => {
      console.error('Failed to seed games:', error);
      process.exit(1);
   })
   .finally(() => {
      void prisma.$disconnect();
   });
