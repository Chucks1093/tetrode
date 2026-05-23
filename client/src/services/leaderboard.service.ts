import { BaseApiService, type APIResponse } from './api.service';

export type LeaderboardEntryType = 'HUMAN' | 'AI';

export interface LeaderboardEntry {
	rank: number;
	type: LeaderboardEntryType;
	displayName: string;
	points: number;
	gamesPlayed: number;
	gamesWon: number;
	winRate: number;
}

export interface LeaderboardResponse {
	entries: LeaderboardEntry[];
	pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface LeaderboardSide {
	totalPoints: number;
	totalGamesPlayed: number;
	totalGamesWon: number;
	winRate: number;
}

export interface LeaderboardSummary {
	humans: LeaderboardSide & { playerCount: number };
	agents: LeaderboardSide & { agentCount: number };
	leading: 'HUMAN' | 'AI' | 'TIED';
	totalGamesPlayed: number;
}

export interface MyStats {
	displayName: string;
	points: number;
	gamesPlayed: number;
	gamesWon: number;
	winRate: number;
	rank: number | null;
}

class LeaderboardService extends BaseApiService {
	async getLeaderboard(params?: {
		type?: LeaderboardEntryType | 'all';
		limit?: number;
		offset?: number;
	}): Promise<LeaderboardResponse> {
		const response = await this.api.get<APIResponse<LeaderboardResponse>>('/leaderboard', { params });
		return response.data.data;
	}

	async getSummary(): Promise<LeaderboardSummary> {
		const response = await this.api.get<APIResponse<LeaderboardSummary>>('/leaderboard/summary');
		return response.data.data;
	}

	async getMyStats(actorId: string): Promise<MyStats> {
		const response = await this.api.get<APIResponse<MyStats>>(`/leaderboard/me/${actorId}`);
		return response.data.data;
	}
}

export const leaderboardService = new LeaderboardService();
