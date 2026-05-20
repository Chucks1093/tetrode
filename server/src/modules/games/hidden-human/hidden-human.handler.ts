import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../../services/agent.service';
import { io } from '../../../socket';
import { prisma } from '../../../utils/prisma.utils';
import { serializeChatMessage } from '../../chat/chat.utils';
import { emitRoomMessage, onRoomMessage, offRoomMessage, clearRoomBus, type SerializedMessage } from '../../room/room.bus';
import type { GameHandler, RoomParticipant } from '../game-handler.interface';
import { buildRoomStartPrompt, buildHiddenHumanAgentPrompt } from './hidden-human.prompts';

const TYPING_CHARS_PER_SEC = 3;
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 15000;

function calcTypingDelay(text: string): number {
	const ms = (text.length / TYPING_CHARS_PER_SEC) * 1000;
	return Math.min(Math.max(ms, TYPING_MIN_MS), TYPING_MAX_MS);
}

const thinking = new Set<string>();
const pendingResponse = new Map<string, boolean>();

const GAME_DURATION_MS = 300_000;

type RoomState = {
	handlers: Array<(msg: SerializedMessage) => void>;
	agentIds: string[];
	startedAt: Date;
};
const activeRooms = new Map<string, RoomState>();

function getTimeRemaining(startedAt: Date): number {
	const elapsed = Date.now() - startedAt.getTime();
	return Math.max(0, Math.round((GAME_DURATION_MS - elapsed) / 1000));
}

async function saveAndEmitSystemMessage(roomPublicId: string, roomId: string, content: string) {
	const saved = await prisma.chatMessage.create({
		data: { roomId, senderType: ChatSenderType.SYSTEM, content },
		include: {
			room: { select: { publicId: true } },
			senderParticipant: { select: { publicId: true, displayName: true, type: true } },
		},
	});
	const serialized = serializeChatMessage(saved);
	io.to(roomPublicId).emit('message:new', serialized);
	emitRoomMessage(roomPublicId, serialized);
}

async function agentSaveAndEmit(
	agent: { id: string; publicId: string; actorId: string; displayName: string },
	roomPublicId: string,
	roomId: string,
	participants: Array<{ id: string; displayName: string }>
) {
	if (thinking.has(agent.id)) return;
	thinking.add(agent.id);

	let cooldownMs = 0;

	try {
		await new Promise(resolve => setTimeout(resolve, 400));

		const recentMessages = await prisma.chatMessage.findMany({
			where: { roomId },
			include: { senderParticipant: { select: { displayName: true } } },
			orderBy: { createdAt: 'asc' },
			take: 25,
		});

		const participantList = participants.map(p => ({
			displayName: p.displayName,
			isSelf: p.id === agent.id,
		}));

		const roomState = activeRooms.get(roomPublicId);
		const timeRemaining = roomState ? getTimeRemaining(roomState.startedAt) : 300;

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
							senderName: m.senderType === ChatSenderType.SYSTEM
								? '[GAME]'
								: (m.senderParticipant?.displayName ?? 'Unknown'),
							content: m.content,
						})),
					});

		const raw = await agentService.promptAgentText(agent.actorId, prompt);
		const parts = raw
			.split('|')
			.map(p => p.replace(/\s+/g, ' ').trim())
			.filter(Boolean);

		if (parts.length === 0 || parts[0]!.toUpperCase() === 'IGNORE') return;

		for (let i = 0; i < parts.length; i++) {
			const content = parts[i]!;
			const delay = calcTypingDelay(content);
			cooldownMs += delay;

			io.to(roomPublicId).emit('agent:typing', {
				agentId: agent.publicId,
				name: agent.displayName,
			});
			await new Promise(resolve => setTimeout(resolve, delay));

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

			if (i < parts.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		}

		// Stay "busy" for the same duration we spent typing so new messages
		// can accumulate before we fetch fresh context and respond again.
		await new Promise(resolve => setTimeout(resolve, cooldownMs));

	} catch (error) {
		console.error(`Agent ${agent.displayName} failed:`, error);
		io.to(roomPublicId).emit('agent:stop-typing', { agentId: agent.publicId });
	} finally {
		thinking.delete(agent.id);
		const hasPending = pendingResponse.get(agent.id);
		pendingResponse.delete(agent.id);
		if (hasPending) {
			void agentSaveAndEmit(agent, roomPublicId, roomId, participants);
		}
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
			if (thinking.has(agent.id)) {
				pendingResponse.set(agent.id, true);
				return;
			}
			void agentSaveAndEmit(agent, roomPublicId, roomId, allParticipants);
		};
		onRoomMessage(roomPublicId, handler);
		handlers.push(handler);
	}

	activeRooms.set(roomPublicId, {
		handlers,
		agentIds: aiParticipants.map(a => a.id),
		startedAt: new Date(),
	});
}

class HiddenHumanHandler implements GameHandler {
	onRoomStart(roomPublicId: string, roomId: string, participants: RoomParticipant[]) {
		const aiParticipants = participants.filter(
			p => p.type === ParticipantType.AI && p.actorId
		);
		if (aiParticipants.length === 0) return;

		subscribeAgents(roomPublicId, roomId, aiParticipants, participants);

		void saveAndEmitSystemMessage(
			roomPublicId,
			roomId,
			'Game started. One person here is a real human. Find them before time runs out.'
		);

		const opener = aiParticipants[Math.floor(Math.random() * aiParticipants.length)]!;
		void agentSaveAndEmit(opener, roomPublicId, roomId, participants);
	}

	onRoomEnd(roomPublicId: string) {
		const state = activeRooms.get(roomPublicId);
		if (!state) return;

		for (const handler of state.handlers) {
			offRoomMessage(roomPublicId, handler);
		}
		for (const agentId of state.agentIds) {
			thinking.delete(agentId);
			pendingResponse.delete(agentId);
		}

		clearRoomBus(roomPublicId);
		activeRooms.delete(roomPublicId);
	}
}

export const hiddenHumanHandler = new HiddenHumanHandler();
