import { BaseApiService, type APIResponse } from './api.service';

export type ChatSenderType = 'HUMAN' | 'AI' | 'SYSTEM';

export interface RoomChatMessage {
	id: string;
	roomId: string;
	senderType: ChatSenderType;
	senderId: string | null;
	senderName: string;
	content: string;
	createdAt: string;
}

export interface CreateMessageResponse {
	message: RoomChatMessage;
	agentReplies: RoomChatMessage[];
}

class ChatService extends BaseApiService {
	async getMessages(
		roomId: string,
		params?: { limit?: number }
	): Promise<{ roomId: string; messages: RoomChatMessage[] }> {
		try {
			const response = await this.api.get<
				APIResponse<{ roomId: string; messages: RoomChatMessage[] }>
			>(`/rooms/${roomId}/chat/messages`, { params });
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async createMessage(
		roomId: string,
		input: { senderId: string; content: string }
	): Promise<CreateMessageResponse> {
		try {
			const response = await this.api.post<APIResponse<CreateMessageResponse>>(
				`/rooms/${roomId}/chat/messages`,
				input
			);
			return response.data.data;
		} catch (error) {
			throw this.handleError(error);
		}
	}
}

export const chatService = new ChatService();
