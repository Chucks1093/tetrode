import { io, Socket } from 'socket.io-client';
import { env } from '@/utils/env.utils';
import type { RoomChatMessage } from './chat.service';

class SocketService {
	private socket: Socket | null = null;

	connect() {
		if (this.socket?.connected) return;
		const serverOrigin = new URL(env.VITE_BACKEND_URL).origin;
		this.socket = io(serverOrigin, {
			withCredentials: true,
		});
	}

	disconnect() {
		this.socket?.disconnect();
		this.socket = null;
	}

	joinRoom(roomId: string) {
		this.socket?.emit('room:join', roomId);
	}

	leaveRoom(roomId: string) {
		this.socket?.emit('room:leave', roomId);
	}

	onMessage(callback: (message: RoomChatMessage) => void) {
		this.socket?.on('message:new', callback);
	}

	offMessage() {
		this.socket?.off('message:new');
	}
}

export const socketService = new SocketService();
