import { BaseApiService, type APIResponse } from './api.service';

export type RoomStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';
export type ParticipantType = 'HUMAN' | 'AI';

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
	}): Promise<Room> {
		try {
			const response = await this.api.post<APIResponse<Room>>('/rooms', input);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
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
}

export const roomService = new RoomService();
