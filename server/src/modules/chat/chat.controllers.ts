import { ChatSenderType, ParticipantType } from '@prisma/client';
import { agentService } from '../../services/agent.service';
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

		// Save the human's message
		const humanMessage = await prisma.chatMessage.create({
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

		// Get all agent replies in parallel, return them in the same response
		const agentReplies: ReturnType<typeof serializeChatMessage>[] = [];

		if (room.gameId === 'the-hidden-human' && senderType === ChatSenderType.HUMAN) {
			const participants = await prisma.participant.findMany({
				where: { roomId: room.id },
				orderBy: { joinedAt: 'asc' },
			});

			const aiParticipants = participants.filter(
				p => p.type === ParticipantType.AI && p.actorId
			);

			const recentMessages = await prisma.chatMessage.findMany({
				where: { roomId: room.id },
				include: { senderParticipant: { select: { displayName: true } } },
				orderBy: { createdAt: 'asc' },
				take: 15,
			});

			// All agents respond at the same time
			const results = await Promise.allSettled(
				aiParticipants.map(async agent => {
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

					if (!content || content.toUpperCase() === 'IGNORE') return null;

					const saved = await prisma.chatMessage.create({
						data: {
							roomId: room.id,
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

					return serializeChatMessage(saved);
				})
			);

			for (const result of results) {
				if (result.status === 'fulfilled' && result.value !== null) {
					agentReplies.push(result.value);
				}
			}
		}

		return res.status(HTTP_STATUS.CREATED).json({
			success: true,
			message: 'Chat message created successfully',
			data: {
				message: serializeChatMessage(humanMessage),
				agentReplies,
			},
		});
	} catch (error) {
		next(error);
	}
};
