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

const PASS_CONTRACT = '0x17D4b03eAB51F899BaEe1167141C251787590Bd6';
const CELO_RPC = 'https://rpc.ankr.com/celo';

export async function getFreePassBalance(walletAddress: string): Promise<number> {
	try {
		const selector = '0x70a08231';
		const padded = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
		const res = await fetch(CELO_RPC, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0', id: 1, method: 'eth_call',
				params: [{ to: PASS_CONTRACT, data: selector + padded }, 'latest'],
			}),
		});
		const json = await res.json() as { result?: string };
		if (!json.result || json.result === '0x') return 0;
		return parseInt(json.result, 16);
	} catch {
		return 0;
	}
}
