import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../services/agent.service';
import { io } from '../../socket';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { CreateChatMessageSchema, ListChatMessagesQuerySchema } from './chat.schemas';
import {
	buildHiddenHumanAgentPrompt,
	findRoomByPublicId,
	serializeChatMessage,
} from './chat.utils';

function getRouteParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

async function runAgentsInBackground(
	roomPublicId: string,
	roomId: string,
	participants: Array<{
		id: string;
		actorId: string;
		displayName: string;
		type: ParticipantType;
	}>
) {
	const aiParticipants = participants.filter(
		p => p.type === ParticipantType.AI && p.actorId
	);
	if (aiParticipants.length === 0) return;

	const recentMessages = await prisma.chatMessage.findMany({
		where: { roomId },
		include: { senderParticipant: { select: { displayName: true } } },
		orderBy: { createdAt: 'asc' },
		take: 15,
	});

	await Promise.allSettled(
		aiParticipants.map(async agent => {
			try {
				const prompt = buildHiddenHumanAgentPrompt({
					agentName: agent.displayName,
					actorId: agent.actorId,
					participants: participants.map(p => ({
						displayName: p.displayName,
						isSelf: p.id === agent.id,
					})),
					messages: recentMessages.map(m => ({
						senderName: m.senderParticipant?.displayName ?? 'Unknown',
						content: m.content,
					})),
				});

				const raw = await agentService.promptAgentText(agent.actorId, prompt);
				const content = raw.replace(/\s+/g, ' ').trim();

				if (!content || content.toUpperCase() === 'IGNORE') return;

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

				// Push directly to the room the moment this agent is done
				io.to(roomPublicId).emit('message:new', serializeChatMessage(saved));
			} catch (error) {
				console.error(`Agent ${agent.displayName} failed:`, error);
			}
		})
	);
}

// ── Controllers ───────────────────────────────────────────────────────────────

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
				room: { select: { publicId: true } },
				senderParticipant: {
					select: { publicId: true, displayName: true, type: true },
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
			where: { publicId: validated.senderId, roomId: room.id },
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
				room: { select: { publicId: true } },
				senderParticipant: {
					select: { publicId: true, displayName: true, type: true },
				},
			},
		});

		const serialized = serializeChatMessage(message);

		// Respond immediately — sender gets their own message via HTTP, not socket
		res.status(HTTP_STATUS.CREATED).json({
			success: true,
			message: 'Chat message created successfully',
			data: { message: serialized },
		});

		// Agents run in background, each emits when ready
		if (room.gameId === 'the-hidden-human' && senderType === ChatSenderType.HUMAN) {
			const participants = await prisma.participant.findMany({
				where: { roomId: room.id },
				orderBy: { joinedAt: 'asc' },
			});
			void runAgentsInBackground(room.publicId, room.id, participants);
		}
	} catch (error) {
		next(error);
	}
};
