import { ChatSenderType } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { emitRoomMessage } from '../room/room.bus';
import { CreateChatMessageSchema, ListChatMessagesQuerySchema } from './chat.schemas';
import { findRoomByPublicId, serializeChatMessage } from './chat.utils';

function getRouteParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
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
			participant.type === 'AI' ? ChatSenderType.AI : ChatSenderType.HUMAN;

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

		// Sender gets their message back via HTTP — not socket — to avoid duplicate
		res.status(HTTP_STATUS.CREATED).json({
			success: true,
			message: 'Chat message created successfully',
			data: { message: serialized },
		});

		// Notify agent subscribers — they decide independently whether to respond
		emitRoomMessage(room.publicId, serialized);
	} catch (error) {
		next(error);
	}
};
