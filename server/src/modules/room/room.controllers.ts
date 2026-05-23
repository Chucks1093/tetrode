import { ChatSenderType, Prisma, RoomStatus } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { prisma } from '../../utils/prisma.utils';
import { io } from '../../socket';
import { relayUsdcTransfer, getFreePassBalance, useFreePass, recordGame } from '../../services/leaderboard.service';
import { envConfig } from '../../config';
import { getGameHandler } from '../games/game-registry';
import {
	CreateRoomSchema,
	JoinRoomSchema,
	LeaveRoomSchema,
	ListRoomsQuerySchema,
} from './room.schemas';
import { findRoomWithParticipants, serializeRoom } from './room.utils';
import { pickAgentNames, serializeChatMessage } from '../chat/chat.utils';
import { agentService } from '../../services/agent.service';

function getRouteParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const httpCreateRoom: AsyncController = async (req, res, next) => {
	try {
		const validated = CreateRoomSchema.parse(req.body);
		const game = await prisma.game.findUnique({
			where: { publicId: validated.gameId },
		});

		if (!game) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				success: false,
				message: 'Game not found',
				data: null,
			});
		}

		// ── Entry fee gate ─────────────────────────────────────────────────────
		const { usdcAuthorization, walletAddress } = validated;
		const entryFee = game.entryFee.toString();

		if (usdcAuthorization) {
			// Player signed a USDC transferWithAuthorization — we relay it (we pay gas)
			const transferred = await relayUsdcTransfer(usdcAuthorization);
			if (!transferred) {
				return res.status(402).json({
					success: false,
					message: 'Payment could not be processed. Please try again.',
					data: { requiresPayment: true, entryFee },
				});
			}
		} else if (walletAddress) {
			// No USDC payment — check if they have a free pass
			const passBalance = await getFreePassBalance(walletAddress);
			if (passBalance > 0) {
				void useFreePass(walletAddress);
			} else {
				return res.status(402).json({
					success: false,
					message: 'Entry fee required',
					data: { requiresPayment: true, entryFee },
				});
			}
		} else {
			return res.status(402).json({
				success: false,
				message: 'Entry fee required',
				data: { requiresPayment: true, entryFee },
			});
		}
		// ── End entry fee gate ─────────────────────────────────────────────────

		const createdAgentSessionIds: string[] = [];

		try {
			const agentNames = pickAgentNames(game.maxAgents);

			for (let index = 0; index < game.maxAgents; index += 1) {
				const agent = await agentService.createAgent({
					title: `${game.title} — ${agentNames[index]}`,
				});
				createdAgentSessionIds.push(agent.id);
			}

			const room = await prisma.room.create({
				data: {
					gameId: validated.gameId,
					participants: {
						create: [
							{
								type: 'HUMAN',
								actorId: validated.actorId,
								displayName: validated.displayName,
								walletAddress: validated.walletAddress,
							},
							...createdAgentSessionIds.map((agentSessionId, index) => ({
								type: 'AI' as const,
								actorId: agentSessionId,
								displayName: agentNames[index] ?? `Player${index + 1}`,
							})),
						],
					},
				},
				include: {
					participants: {
						orderBy: { joinedAt: 'asc' },
					},
				},
			});

			res.status(HTTP_STATUS.CREATED).json({
				success: true,
				message: 'Room created successfully',
				data: serializeRoom(room),
			});

			// Record the game on-chain at start so it's counted even if player leaves early
			if (validated.walletAddress) {
				void recordGame(validated.walletAddress);
			}

			getGameHandler(game.publicId)?.onRoomStart(room.publicId, room.id, room.participants);

			return;
		} catch (error) {
			if (createdAgentSessionIds.length > 0) {
				await Promise.allSettled(
					createdAgentSessionIds.map(agentId => agentService.deleteAgent(agentId))
				);
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
};

export const httpListRooms: AsyncController = async (req, res, next) => {
	try {
		const validated = ListRoomsQuerySchema.parse(req.query);

		const where: Prisma.RoomWhereInput = {
			...(validated.gameId ? { gameId: validated.gameId } : {}),
			...(validated.status ? { status: validated.status as RoomStatus } : {}),
		};

		const [rooms, total] = await Promise.all([
			prisma.room.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip: validated.offset,
				take: validated.limit,
				include: {
					participants: {
						orderBy: { joinedAt: 'asc' },
					},
				},
			}),
			prisma.room.count({ where }),
		]);

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Rooms fetched successfully',
			data: {
				rooms: rooms.map(serializeRoom),
				pagination: {
					total,
					limit: validated.limit,
					offset: validated.offset,
					hasMore: validated.offset + rooms.length < total,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpGetRoomById: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({
				success: false,
				message: 'roomId is required',
				data: null,
			});
		}
		const room = await findRoomWithParticipants(roomId);

		if (!room) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				success: false,
				message: 'Room not found',
				data: null,
			});
		}

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Room fetched successfully',
			data: serializeRoom(room),
		});
	} catch (error) {
		next(error);
	}
};

export const httpGetRoomParticipants: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({
				success: false,
				message: 'roomId is required',
				data: null,
			});
		}
		const room = await findRoomWithParticipants(roomId);

		if (!room) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				success: false,
				message: 'Room not found',
				data: null,
			});
		}

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Room participants fetched successfully',
			data: {
				roomId: room.publicId,
				participants: serializeRoom(room).participants ?? [],
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpJoinRoom: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({
				success: false,
				message: 'roomId is required',
				data: null,
			});
		}
		const validated = JoinRoomSchema.parse(req.body);
		const room = await prisma.room.findUnique({
			where: { publicId: roomId },
		});

		if (!room) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				success: false,
				message: 'Room not found',
				data: null,
			});
		}

		if (room.status !== RoomStatus.WAITING) {
			return res.status(HTTP_STATUS.CONFLICT).json({
				success: false,
				message: 'Room is no longer accepting participants',
				data: null,
			});
		}

		const existingParticipant = await prisma.participant.findFirst({
			where: {
				roomId: room.id,
				type: validated.type,
				actorId: validated.actorId,
			},
		});

		if (existingParticipant) {
			return res.status(HTTP_STATUS.CONFLICT).json({
				success: false,
				message: 'Participant already joined this room',
				data: null,
			});
		}

		const participant = await prisma.participant.create({
			data: {
				roomId: room.id,
				type: validated.type,
				actorId: validated.actorId,
				displayName: validated.displayName,
				walletAddress: validated.walletAddress,
			},
		});

		return res.status(HTTP_STATUS.CREATED).json({
			success: true,
			message: 'Joined room successfully',
			data: {
				participant: {
					id: participant.publicId,
					roomId: room.publicId,
					type: participant.type,
					actorId: participant.actorId,
					displayName: participant.displayName,
					joinedAt: participant.joinedAt,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpLeaveRoom: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({
				success: false,
				message: 'roomId is required',
				data: null,
			});
		}
		const validated = LeaveRoomSchema.parse(req.body);

		const participant = await prisma.participant.findFirst({
			where: {
				publicId: validated.participantId,
				room: { publicId: roomId },
			},
			include: { room: { select: { gameId: true } } },
		});

		if (!participant) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				success: false,
				message: 'Participant not found in room',
				data: null,
			});
		}

		await prisma.participant.delete({
			where: { id: participant.id },
		});

		getGameHandler(participant.room.gameId)?.onRoomEnd(roomId);

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Left room successfully',
			data: {
				participantId: participant.publicId,
				roomId,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpCastVote: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'roomId is required', data: null });
		}

		const { voterParticipantId, targetParticipantId } = req.body as {
			voterParticipantId: string;
			targetParticipantId: string;
		};

		const room = await prisma.room.findUnique({ where: { publicId: roomId } });
		if (!room) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Room not found', data: null });
		}

		const voter = await prisma.participant.findUnique({ where: { publicId: voterParticipantId } });
		const target = await prisma.participant.findUnique({ where: { publicId: targetParticipantId } });

		if (!voter || !target) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Participant not found', data: null });
		}
		if (voter.id === target.id) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Cannot vote for yourself', data: null });
		}

		await prisma.vote.upsert({
			where: { roomId_voterParticipantId: { roomId: room.id, voterParticipantId: voter.id } },
			update: { targetParticipantId: target.id },
			create: { roomId: room.id, voterParticipantId: voter.id, targetParticipantId: target.id },
		});

		const sysMsg = await prisma.chatMessage.create({
			data: { roomId: room.id, senderType: ChatSenderType.SYSTEM, content: `${voter.displayName} has voted.` },
			include: {
				room: { select: { publicId: true } },
				senderParticipant: { select: { publicId: true, displayName: true, type: true } },
			},
		});
		io.to(roomId).emit('message:new', serializeChatMessage(sysMsg));

		return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Vote cast', data: null });
	} catch (error) {
		next(error);
	}
};

export const httpGetRoomResults: AsyncController = async (req, res, next) => {
	try {
		const roomId = getRouteParam(req.params.roomId);
		if (!roomId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'roomId is required', data: null });
		}

		const room = await prisma.room.findUnique({
			where: { publicId: roomId },
			include: {
				votes: {
					include: {
						target: { select: { publicId: true, displayName: true, type: true } },
					},
				},
				participants: { select: { publicId: true, displayName: true, type: true } },
			},
		});

		if (!room) {
			return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Room not found', data: null });
		}

		const tally = new Map<string, { displayName: string; type: string; count: number }>();
		for (const vote of room.votes) {
			const key = vote.target.publicId;
			const existing = tally.get(key);
			if (existing) {
				existing.count += 1;
			} else {
				tally.set(key, { displayName: vote.target.displayName, type: vote.target.type, count: 1 });
			}
		}

		let votedOut: { displayName: string; type: string; count: number } | null = null;
		for (const entry of tally.values()) {
			if (!votedOut || entry.count > votedOut.count) {
				votedOut = entry;
			}
		}

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Results fetched',
			data: {
				votedOut,
				votes: Array.from(tally.entries()).map(([id, v]) => ({ id, ...v })),
				totalVotes: room.votes.length,
			},
		});
	} catch (error) {
		next(error);
	}
};
