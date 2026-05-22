import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../../services/agent.service';
import { io } from '../../../socket';
import { prisma } from '../../../utils/prisma.utils';
import { serializeChatMessage } from '../../chat/chat.utils';
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

const GAME_DURATION_MS = 300_000;
const END_GRACE_MS = 30_000;

type RoomState = {
   handlers: Array<(msg: SerializedMessage) => void>;
   agents: Array<{ id: string; publicId: string }>;
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
}

async function endGame(roomPublicId: string, roomId: string) {
   const state = activeRooms.get(roomPublicId);
   if (!state) return;

   let resultText = "Time's up!";

   try {
      // Immediately stop all agents — clear typing indicators and block new responses
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

         if (!votedOut) {
            resultText =
               "Time's up. No one was voted out. The hidden human survives.";
         } else if (votedOut.type === 'HUMAN') {
            resultText = `Time's up. ${votedOut.displayName} was voted out. They were the hidden human. Agents win.`;
         } else {
            resultText = `Time's up. ${votedOut.displayName} was voted out. They were an AI. The human survives.`;
         }

         await prisma.room
            .update({ where: { id: room.id }, data: { status: 'FINISHED' } })
            .catch(() => null);
      }

      // Re-enable agents so they can react to the result
      for (const agent of state.agents) {
         doneAgents.delete(agent.id);
      }

      // Send result — agents see it and have 30 seconds to react and leave
      await saveAndEmitSystemMessage(roomPublicId, roomId, resultText);
      await new Promise(resolve => setTimeout(resolve, END_GRACE_MS));
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
   participants: Array<{ id: string; displayName: string }>
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

         if (doneAgents.has(agent.id)) {
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
      if (hasPending && !doneAgents.has(agent.id)) {
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
   allParticipants: Array<{ id: string; displayName: string }>
) {
   const handlers: Array<(msg: SerializedMessage) => void> = [];

   for (const agent of aiParticipants) {
      const handler = (message: SerializedMessage) => {
         if (message.senderId === agent.publicId) return;
         if (doneAgents.has(agent.id)) return;
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
      agents: aiParticipants.map(a => ({ id: a.id, publicId: a.publicId })),
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
