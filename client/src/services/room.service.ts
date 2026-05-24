import { BaseApiService, type APIResponse } from './api.service';

export class PaymentRequiredError extends Error {
	readonly entryFee: string;
	constructor(entryFee: string) {
		super('Entry fee required');
		this.entryFee = entryFee;
	}
}

export class ActiveRoomExistsError extends Error {
	readonly roomId: string;
	constructor(roomId: string) {
		super('Active room exists');
		this.roomId = roomId;
	}
}

export interface UsdcAuthorization {
	from: string;
	to: string;
	value: string;
	validAfter: string;
	validBefore: string;
	nonce: string;
	signature: string;
}


export type RoomStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';
export type ParticipantType = 'HUMAN' | 'AI';

export interface RoomResults {
	votedOut: { displayName: string; type: ParticipantType; count: number } | null;
	votes: Array<{ id: string; displayName: string; type: ParticipantType; count: number }>;
	totalVotes: number;
}

export interface RoomParticipant {
	id: string;
	roomId: string;
	type: ParticipantType;
	actorId: string;
	displayName: string;
	joinedAt: string;
}

export interface Room {
	id: string;
	gameId: string;
	status: RoomStatus;
	createdAt: string;
	updatedAt: string;
	participants?: RoomParticipant[];
}

export interface ListRoomsResponse {
	rooms: Room[];
	pagination: {
		total: number;
		limit: number;
		offset: number;
		hasMore: boolean;
	};
}

class RoomService extends BaseApiService {
	async createRoom(input: {
		gameId: string;
		actorId: string;
		displayName: string;
		walletAddress?: string;
		usdcAuthorization?: UsdcAuthorization;
	}): Promise<Room> {
		try {
			const response = await this.api.post<APIResponse<Room>>('/rooms', input);
			return response.data.data;
		} catch (error: unknown) {
			const axiosError = error as { response?: { status: number; data?: { data?: { entryFee?: string; roomId?: string } } } };
			if (axiosError?.response?.status === 402) {
				const entryFee = axiosError.response.data?.data?.entryFee ?? '0';
				throw new PaymentRequiredError(entryFee);
			}
			if (axiosError?.response?.status === 409) {
				const roomId = axiosError.response.data?.data?.roomId ?? '';
				throw new ActiveRoomExistsError(roomId);
			}

			throw this.handleError(error);
		}
	}

	async getMyActiveRoom(gameId: string, actorId: string): Promise<Room | null> {
		try {
			const response = await this.api.get<APIResponse<Room>>('/rooms/my-active', {
				params: { gameId, actorId },
			});
			return response.data.data;
		} catch {
			return null;
		}
	}

	async getRoom(roomId: string): Promise<Room> {
		try {
			const response = await this.api.get<APIResponse<Room>>(`/rooms/${roomId}`);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async listRooms(params?: {
		gameId?: string;
		status?: RoomStatus;
		limit?: number;
		offset?: number;
	}): Promise<ListRoomsResponse> {
		try {
			const response = await this.api.get<APIResponse<ListRoomsResponse>>(
				'/rooms',
				{ params }
			);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async getRoomParticipants(
		roomId: string
	): Promise<{ roomId: string; participants: RoomParticipant[] }> {
		try {
			const response = await this.api.get<
				APIResponse<{ roomId: string; participants: RoomParticipant[] }>
			>(`/rooms/${roomId}/participants`);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async joinRoom(
		roomId: string,
		input: {
			type: ParticipantType;
			actorId: string;
			displayName: string;
			walletAddress?: string;
		}
	): Promise<RoomParticipant> {
		try {
			const response = await this.api.post<
				APIResponse<{ participant: RoomParticipant }>
			>(`/rooms/${roomId}/join`, input);
			return response.data.data.participant;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async leaveRoom(
		roomId: string,
		participantId: string
	): Promise<{ participantId: string; roomId: string }> {
		try {
			const response = await this.api.post<
				APIResponse<{ participantId: string; roomId: string }>
			>(`/rooms/${roomId}/leave`, {
				participantId,
			});
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async castVote(
		roomId: string,
		voterParticipantId: string,
		targetParticipantId: string
	): Promise<void> {
		try {
			await this.api.post(`/rooms/${roomId}/votes`, {
				voterParticipantId,
				targetParticipantId,
			});
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async getRoomResults(roomId: string): Promise<RoomResults> {
		try {
			const response = await this.api.get<APIResponse<RoomResults>>(
				`/rooms/${roomId}/results`
			);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

}

export const roomService = new RoomService();
