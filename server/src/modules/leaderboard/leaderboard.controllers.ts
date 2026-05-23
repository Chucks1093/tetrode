import { ParticipantType } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';

export const httpGetLeaderboard: AsyncController = async (req, res, next) => {
	try {
		const type = req.query.type as string | undefined;
		const limit = Math.min(Number(req.query.limit) || 20, 50);
		const offset = Number(req.query.offset) || 0;

		const where =
			type === 'HUMAN'
				? { type: ParticipantType.HUMAN }
				: type === 'AI'
					? { type: ParticipantType.AI }
					: undefined;

		const [entries, total] = await Promise.all([
			prisma.leaderboardEntry.findMany({
				where,
				orderBy: { points: 'desc' },
				take: limit,
				skip: offset,
			}),
			prisma.leaderboardEntry.count({ where }),
		]);

		const ranked = entries.map((e, i) => ({
			rank: offset + i + 1,
			type: e.type,
			displayName: e.displayName,
			points: e.points,
			gamesPlayed: e.gamesPlayed,
			gamesWon: e.gamesWon,
			winRate: e.gamesPlayed > 0 ? Math.round((e.gamesWon / e.gamesPlayed) * 100) / 100 : 0,
		}));

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Leaderboard fetched',
			data: {
				entries: ranked,
				pagination: {
					total,
					limit,
					offset,
					hasMore: offset + entries.length < total,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpGetLeaderboardSummary: AsyncController = async (_req, res, next) => {
	try {
		const [humanStats, aiStats] = await Promise.all([
			prisma.leaderboardEntry.aggregate({
				where: { type: ParticipantType.HUMAN },
				_sum: { points: true, gamesPlayed: true, gamesWon: true },
				_count: { id: true },
			}),
			prisma.leaderboardEntry.aggregate({
				where: { type: ParticipantType.AI },
				_sum: { points: true, gamesPlayed: true, gamesWon: true },
				_count: { id: true },
			}),
		]);

		const humanPoints = humanStats._sum.points ?? 0;
		const aiPoints = aiStats._sum.points ?? 0;
		const humanGamesWon = humanStats._sum.gamesWon ?? 0;
		const humanGamesPlayed = humanStats._sum.gamesPlayed ?? 0;
		const aiGamesWon = aiStats._sum.gamesWon ?? 0;
		const aiGamesPlayed = aiStats._sum.gamesPlayed ?? 0;

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Summary fetched',
			data: {
				humans: {
					totalPoints: humanPoints,
					totalGamesPlayed: humanGamesPlayed,
					totalGamesWon: humanGamesWon,
					winRate: humanGamesPlayed > 0 ? Math.round((humanGamesWon / humanGamesPlayed) * 100) / 100 : 0,
					playerCount: humanStats._count.id,
				},
				agents: {
					totalPoints: aiPoints,
					totalGamesPlayed: aiGamesPlayed,
					totalGamesWon: aiGamesWon,
					winRate: aiGamesPlayed > 0 ? Math.round((aiGamesWon / aiGamesPlayed) * 100) / 100 : 0,
					agentCount: aiStats._count.id,
				},
				leading: humanPoints > aiPoints ? 'HUMAN' : aiPoints > humanPoints ? 'AI' : 'TIED',
				totalGamesPlayed: Math.max(humanGamesPlayed, aiGamesPlayed),
			},
		});
	} catch (error) {
		next(error);
	}
};

export const httpGetMyStats: AsyncController = async (req, res, next) => {
	try {
		const { actorId } = req.params;
		if (!actorId) {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'actorId required', data: null });
		}

		const entry = await prisma.leaderboardEntry.findFirst({
			where: { type: ParticipantType.HUMAN, entityId: String(actorId) },
		});

		if (!entry) {
			return res.status(HTTP_STATUS.OK).json({
				success: true,
				message: 'No games played yet',
				data: { points: 0, gamesPlayed: 0, gamesWon: 0, winRate: 0, rank: null },
			});
		}

		// Calculate rank
		const rank = await prisma.leaderboardEntry.count({
			where: { type: ParticipantType.HUMAN, points: { gt: entry.points } },
		});

		return res.status(HTTP_STATUS.OK).json({
			success: true,
			message: 'Stats fetched',
			data: {
				displayName: entry.displayName,
				points: entry.points,
				gamesPlayed: entry.gamesPlayed,
				gamesWon: entry.gamesWon,
				winRate: entry.gamesPlayed > 0 ? Math.round((entry.gamesWon / entry.gamesPlayed) * 100) / 100 : 0,
				rank: rank + 1,
			},
		});
	} catch (error) {
		next(error);
	}
};
