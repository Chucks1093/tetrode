import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../../services/agent.service';
import { io } from '../../../socket';
import { prisma } from '../../../utils/prisma.utils';
import { serializeChatMessage } from '../../chat/chat.utils';
import { recordWin } from '../../../services/leaderboard.service';
import {
   emitRoomMessage,
   onRoomMessage,
   offRoomMessage,
   clearRoomBus,
   type SerializedMessage,
} from '../../room/room.bus';
import type { GameHandler, RoomParticipant } from '../game-handler.interface';
import {
   buildRoomStartPrompt,
   buildHiddenHumanAgentPrompt,
} from './hidden-human.prompts';

const TYPING_CHARS_PER_SEC = 4;
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 15000;

function calcTypingDelay(text: string): number {
   const ms = (text.length / TYPING_CHARS_PER_SEC) * 1000;
   return Math.min(Math.max(ms, TYPING_MIN_MS), TYPING_MAX_MS);
}

const thinking = new Set<string>();
const pendingResponse = new Map<string, boolean>();
export const doneAgents = new Set<string>();
const gracePeriodRooms = new Set<string>();
const gameEndedRooms = new Set<string>();

const GAME_DURATION_MS = 300_000;
const END_GRACE_MS = 30_000;

type RoomState = {
   handlers: Array<(msg: SerializedMessage) => void>;
   agents: Array<{ id: string; publicId: string; actorId: string; displayName: string }>;
   allParticipants: Array<{ id: string; actorId: string; displayName: string; type: ParticipantType; walletAddress?: string | null }>;
   startedAt: Date;
   gameTimer: ReturnType<typeof setTimeout>;
};
const activeRooms = new Map<string, RoomState>();

function getTimeRemaining(startedAt: Date): number {
   const elapsed = Date.now() - startedAt.getTime();
   return Math.max(0, Math.round((GAME_DURATION_MS - elapsed) / 1000));
}

async function saveAndEmitSystemMessage(
   roomPublicId: string,
   roomId: string,
   content: string
) {
   const saved = await prisma.chatMessage.create({
      data: { roomId, senderType: ChatSenderType.SYSTEM, content },
      include: {
         room: { select: { publicId: true } },
         senderParticipant: {
            select: { publicId: true, displayName: true, type: true },
         },
      },
   });
   const serialized = serializeChatMessage(saved);
   io.to(roomPublicId).emit('message:new', serialized);
   emitRoomMessage(roomPublicId, serialized);
}

function cleanup(roomPublicId: string) {
   const state = activeRooms.get(roomPublicId);
   if (!state) return;

   for (const handler of state.handlers) {
      offRoomMessage(roomPublicId, handler);
   }
   for (const agent of state.agents) {
      thinking.delete(agent.id);
      pendingResponse.delete(agent.id);
      doneAgents.delete(agent.id);
   }

   clearRoomBus(roomPublicId);
   activeRooms.delete(roomPublicId);
   gracePeriodRooms.delete(roomPublicId);
   gameEndedRooms.delete(roomPublicId);
}

async function endGame(roomPublicId: string, roomId: string) {
   const state = activeRooms.get(roomPublicId);
   if (!state) return;

   // Block any in-flight agentSaveAndEmit calls from saving messages after this point
   gameEndedRooms.add(roomPublicId);

   let resultText = "Time's up!";

   try {
      // Stop typing indicators and clear queued responses
      for (const agent of state.agents) {
         doneAgents.add(agent.id);
         thinking.delete(agent.id);
         pendingResponse.delete(agent.id);
         io.to(roomPublicId).emit('agent:stop-typing', {
            agentId: agent.publicId,
         });
      }

      // Tally votes — DB query gives in-progress agent calls time to notice doneAgents and stop
      const room = await prisma.room.findUnique({
         where: { publicId: roomPublicId },
         include: {
            votes: {
               include: {
                  target: {
                     select: { publicId: true, displayName: true, type: true },
                  },
               },
            },
         },
      });

      if (room) {
         const tally = new Map<
            string,
            { displayName: string; type: string; count: number }
         >();
         for (const vote of room.votes) {
            const key = vote.target.publicId;
            const existing = tally.get(key);
            if (existing) {
               existing.count += 1;
            } else {
               tally.set(key, {
                  displayName: vote.target.displayName,
                  type: vote.target.type,
                  count: 1,
               });
            }
         }

         let votedOut: {
            displayName: string;
            type: string;
            count: number;
         } | null = null;
         for (const entry of tally.values()) {
            if (!votedOut || entry.count > votedOut.count) votedOut = entry;
         }

         const humanWon = !votedOut || votedOut.type !== 'HUMAN';

         if (!votedOut) {
            resultText =
               "Time's up. No one was voted out. The hidden human survives.";
         } else if (votedOut.type === 'HUMAN') {
            resultText = `Time's up. ${votedOut.displayName} was voted out. They were the hidden human. Agents win.`;
         } else {
            resultText = `Time's up. ${votedOut.displayName} was voted out. They were an AI. The human survives.`;
         }

         const humanParticipant = state.allParticipants.find(
            p => p.type === ParticipantType.HUMAN
         );
         // Pre-fetch AI agent publicIds and wallet addresses keyed by displayName
         const aiNames = state.allParticipants
            .filter(p => p.type === ParticipantType.AI)
            .map(p => p.displayName);
         const agentRecords = aiNames.length
            ? await prisma.agent.findMany({ where: { name: { in: aiNames } }, select: { name: true, publicId: true, walletAddress: true } })
            : [];
         const agentPublicIdByName = new Map(agentRecords.map(a => [a.name, a.publicId]));

         // Record on-chain wins sequentially to avoid nonce collisions
         void (async () => {
            if (humanParticipant?.walletAddress && humanWon) {
               await recordWin(humanParticipant.walletAddress);
            }
            if (!humanWon) {
               for (const agent of agentRecords) {
                  if (agent.walletAddress) await recordWin(agent.walletAddress);
               }
            }
         })();

         // Update leaderboard entries for all participants
         const WIN_POINTS = 100;
         const LOSS_POINTS = 10;

         await Promise.allSettled(
            state.allParticipants.map(p => {
               const won = p.type === ParticipantType.HUMAN ? humanWon : !humanWon;
               // Humans: use actorId (persists across games). AI: use GameAgent publicId.
               const entityId = p.type === ParticipantType.HUMAN
                  ? p.actorId
                  : (agentPublicIdByName.get(p.displayName) ?? p.actorId);
               return prisma.leaderboardEntry.upsert({
                  where: { type_entityId: { type: p.type, entityId } },
                  update: {
                     gamesPlayed: { increment: 1 },
                     gamesWon: won ? { increment: 1 } : undefined,
                     points: { increment: won ? WIN_POINTS : LOSS_POINTS },
                     displayName: p.displayName,
                  },
                  create: {
                     type: p.type,
                     entityId,
                     displayName: p.displayName,
                     gamesPlayed: 1,
                     gamesWon: won ? 1 : 0,
                     points: won ? WIN_POINTS : LOSS_POINTS,
                  },
               });
            })
         );

         await prisma.room
            .update({ where: { id: room.id }, data: { status: 'FINISHED' } })
            .catch(() => null);
      }

      // Re-enable agents so they can react to the result
      for (const agent of state.agents) {
         doneAgents.delete(agent.id);
      }

      // Enter grace period — handler is now blocked, agents triggered manually below
      gracePeriodRooms.add(roomPublicId);

      // Send result to socket only — do NOT put on room bus (handler is blocked anyway)
      const savedResult = await prisma.chatMessage.create({
         data: { roomId, senderType: ChatSenderType.SYSTEM, content: resultText },
         include: {
            room: { select: { publicId: true } },
            senderParticipant: {
               select: { publicId: true, displayName: true, type: true },
            },
         },
      });
      io.to(roomPublicId).emit('message:new', serializeChatMessage(savedResult));

      // Manually trigger each agent's reaction once — staggered, bypass gameEndedRooms
      for (let i = 0; i < state.agents.length; i++) {
         const agent = state.agents[i]!;
         await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 800));
         void agentSaveAndEmit(agent, roomPublicId, roomId, state.allParticipants, true);
      }

      await new Promise(resolve => setTimeout(resolve, END_GRACE_MS));

      // Auto-leave for all agents that didn't call leave_room themselves
      const currentState = activeRooms.get(roomPublicId);
      if (currentState) {
         await Promise.allSettled(
            currentState.agents.map(agent =>
               saveAndEmitSystemMessage(roomPublicId, roomId, `${agent.displayName} has left the room.`)
            )
         );
      }
   } catch (err) {
      console.error('endGame error:', err);
   } finally {
      cleanup(roomPublicId);
      io.to(roomPublicId).emit('game:ended', { resultText });
   }
}

async function agentSaveAndEmit(
   agent: {
      id: string;
      publicId: string;
      actorId: string;
      displayName: string;
   },
   roomPublicId: string,
   roomId: string,
   participants: Array<{ id: string; actorId?: string; displayName: string; type?: ParticipantType; walletAddress?: string | null }>,
   overrideGameEnd = false
) {
   if (thinking.has(agent.id)) return;
   if (doneAgents.has(agent.id)) return;
   thinking.add(agent.id);

   let cooldownMs = 0;

   try {
      await new Promise(resolve => setTimeout(resolve, 400));

      const recentMessages = await prisma.chatMessage.findMany({
         where: { roomId },
         include: { senderParticipant: { select: { displayName: true } } },
         orderBy: { createdAt: 'desc' },
         take: 10,
      });

      // Reverse so oldest-first for the transcript
      recentMessages.reverse();

      const participantList = participants.map(p => ({
         displayName: p.displayName,
         isSelf: p.id === agent.id,
      }));

      const roomState = activeRooms.get(roomPublicId);
      const timeRemaining = roomState
         ? getTimeRemaining(roomState.startedAt)
         : 0;

      const prompt =
         recentMessages.length === 0
            ? buildRoomStartPrompt({
                 agentName: agent.displayName,
                 actorId: agent.actorId,
                 participants: participantList,
                 roomId: roomPublicId,
                 timeRemaining,
              })
            : buildHiddenHumanAgentPrompt({
                 agentName: agent.displayName,
                 actorId: agent.actorId,
                 participants: participantList,
                 roomId: roomPublicId,
                 timeRemaining,
                 messages: recentMessages.map(m => ({
                    senderName:
                       m.senderType === ChatSenderType.SYSTEM
                          ? '[GAME]'
                          : (m.senderParticipant?.displayName ?? 'Unknown'),
                    content: m.content,
                    createdAt: m.createdAt,
                 })),
              });

      const raw = await agentService.promptAgentText(agent.actorId, prompt);
      const parts = raw
         .split('|')
         .map(p => p.replace(/\s+/g, ' ').trim())
         .filter(Boolean);

      if (parts.length === 0 || parts[0]!.toUpperCase() === 'IGNORE') return;

      for (let i = 0; i < parts.length; i++) {
         if (doneAgents.has(agent.id)) break;

         const content = parts[i]!;
         const delay = calcTypingDelay(content);
         cooldownMs += delay;

         io.to(roomPublicId).emit('agent:typing', {
            agentId: agent.publicId,
            name: agent.displayName,
         });
         await new Promise(resolve => setTimeout(resolve, delay));

         if (doneAgents.has(agent.id) || (!overrideGameEnd && gameEndedRooms.has(roomPublicId))) {
            io.to(roomPublicId).emit('agent:stop-typing', { agentId: agent.publicId });
            break;
         }

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

         io.to(roomPublicId).emit('agent:stop-typing', {
            agentId: agent.publicId,
         });
         io.to(roomPublicId).emit('message:new', serialized);
         emitRoomMessage(roomPublicId, serialized);

         if (i < parts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
         }
      }

      await new Promise(resolve => setTimeout(resolve, cooldownMs));
   } catch (error) {
      console.error(`Agent ${agent.displayName} failed:`, error);
      io.to(roomPublicId).emit('agent:stop-typing', {
         agentId: agent.publicId,
      });
   } finally {
      thinking.delete(agent.id);
      const hasPending = pendingResponse.get(agent.id);
      pendingResponse.delete(agent.id);
      if (hasPending && !doneAgents.has(agent.id) && !gracePeriodRooms.has(roomPublicId) && !gameEndedRooms.has(roomPublicId)) {
         void agentSaveAndEmit(agent, roomPublicId, roomId, participants);
      }
   }
}

function subscribeAgents(
   roomPublicId: string,
   roomId: string,
   aiParticipants: Array<{
      id: string;
      publicId: string;
      actorId: string;
      displayName: string;
   }>,
   allParticipants: Array<{ id: string; actorId: string; displayName: string; type: ParticipantType; walletAddress?: string | null }>
) {
   const handlers: Array<(msg: SerializedMessage) => void> = [];

   for (const agent of aiParticipants) {
      const handler = (message: SerializedMessage) => {
         if (message.senderId === agent.publicId) return;
         if (doneAgents.has(agent.id)) return;
         if (gracePeriodRooms.has(roomPublicId)) return;
         if (thinking.has(agent.id)) {
            pendingResponse.set(agent.id, true);
            return;
         }
         void agentSaveAndEmit(agent, roomPublicId, roomId, allParticipants);
      };
      onRoomMessage(roomPublicId, handler);
      handlers.push(handler);
   }

   const gameTimer = setTimeout(
      () => void endGame(roomPublicId, roomId),
      GAME_DURATION_MS
   );

   activeRooms.set(roomPublicId, {
      handlers,
      agents: aiParticipants.map(a => ({ id: a.id, publicId: a.publicId, actorId: a.actorId, displayName: a.displayName })),
      allParticipants,
      startedAt: new Date(),
      gameTimer,
   });
}

class HiddenHumanHandler implements GameHandler {
   onRoomStart(
      roomPublicId: string,
      roomId: string,
      participants: RoomParticipant[]
   ) {
      const aiParticipants = participants.filter(
         p => p.type === ParticipantType.AI && p.actorId
      );
      if (aiParticipants.length === 0) return;

      subscribeAgents(roomPublicId, roomId, aiParticipants, participants);

      // Emit start message to chat only — do NOT put on room bus or agents all fire at once
      void prisma.chatMessage
         .create({
            data: {
               roomId,
               senderType: ChatSenderType.SYSTEM,
               content:
                  'Game started. One person here is a real human. Find them before time runs out.',
            },
            include: {
               room: { select: { publicId: true } },
               senderParticipant: {
                  select: { publicId: true, displayName: true, type: true },
               },
            },
         })
         .then(saved => {
            io.to(roomPublicId).emit(
               'message:new',
               serializeChatMessage(saved)
            );
         })
         .catch(() => null);

      const opener =
         aiParticipants[Math.floor(Math.random() * aiParticipants.length)]!;
      void agentSaveAndEmit(opener, roomPublicId, roomId, participants);
   }

   onRoomEnd(roomPublicId: string) {
      const state = activeRooms.get(roomPublicId);
      if (!state) return;
      clearTimeout(state.gameTimer);
      cleanup(roomPublicId);
   }
}

export const hiddenHumanHandler = new HiddenHumanHandler();
