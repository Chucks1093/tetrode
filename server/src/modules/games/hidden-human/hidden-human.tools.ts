import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../../../utils/prisma.utils';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export function registerHiddenHumanTools(server: McpServer) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   (server as any).registerTool(
      'cast_vote',
      {
         description:
            'Cast your vote for who you think is the hidden human in the room. You can only vote once per game. Use this before time runs out.',
         inputSchema: {
            roomId: z.string().describe('The public ID of the room'),
            voterName: z.string().describe('Your own display name'),
            targetName: z
               .string()
               .describe('Display name of the participant you think is human'),
         },
      },
      async (args: { roomId: string; voterName: string; targetName: string }) => {
         const { roomId, voterName, targetName } = args;
         try {
            const room = await prisma.room.findUnique({
               where: { publicId: roomId },
               include: {
                  participants: { select: { id: true, displayName: true } },
               },
            });

            if (!room) {
               return {
                  content: [
                     { type: 'text' as const, text: 'Error: room not found.' },
                  ],
                  isError: true,
               };
            }

            const voter = room.participants.find(
               p => p.displayName.toLowerCase() === voterName.toLowerCase()
            );
            const target = room.participants.find(
               p => p.displayName.toLowerCase() === targetName.toLowerCase()
            );

            if (!voter) {
               return {
                  content: [
                     {
                        type: 'text' as const,
                        text: `Error: voter "${voterName}" not found in room.`,
                     },
                  ],
                  isError: true,
               };
            }
            if (!target) {
               return {
                  content: [
                     {
                        type: 'text' as const,
                        text: `Error: target "${targetName}" not found in room.`,
                     },
                  ],
                  isError: true,
               };
            }
            if (voter.id === target.id) {
               return {
                  content: [
                     {
                        type: 'text' as const,
                        text: 'Error: you cannot vote for yourself.',
                     },
                  ],
                  isError: true,
               };
            }

            await prisma.vote.upsert({
               where: {
                  roomId_voterParticipantId: {
                     roomId: room.id,
                     voterParticipantId: voter.id,
                  },
               },
               update: { targetParticipantId: target.id },
               create: {
                  roomId: room.id,
                  voterParticipantId: voter.id,
                  targetParticipantId: target.id,
               },
            });

            await fetch(`${BACKEND_URL}/internal/vote-cast`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ roomPublicId: roomId, voterName }),
            }).catch(() => null);

            return {
               content: [
                  {
                     type: 'text' as const,
                     text: `Vote cast: ${voterName} voted for ${targetName}.`,
                  },
               ],
            };
         } catch (error) {
            const message =
               error instanceof Error ? error.message : 'Unknown error';
            return {
               content: [{ type: 'text' as const, text: `Error: ${message}` }],
               isError: true,
            };
         }
      }
   );

}
