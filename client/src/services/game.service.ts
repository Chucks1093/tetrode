import { BaseApiService, type APIResponse } from './api.service';

export type GameStatus = 'ACTIVE' | 'COMING_SOON';

export interface Game {
	id: string;
	title: string;
	description: string | null;
	status: GameStatus;
	imageUrl: string;
	maxPlayers: number;
	maxAgents: number;
	maxActiveRooms: number;
	entryFee: number;
	createdAt?: string;
	updatedAt?: string;
}

class GameService extends BaseApiService {
	async fetchGames(params?: {
		status?: GameStatus;
	}): Promise<Game[]> {
		try {
			const response = await this.api.get<APIResponse<Game[]>>('/games', {
				params,
			});
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async fetchGame(gameId: string): Promise<Game> {
		try {
			const response = await this.api.get<APIResponse<Game>>(`/games/${gameId}`);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}
}

export const gameService = new GameService();
