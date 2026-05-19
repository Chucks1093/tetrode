import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { appConfig } from './config';

export let io: Server;

export function initSocket(httpServer: HttpServer) {
	io = new Server(httpServer, {
		cors: {
			origin: appConfig.allowedOrigins,
			credentials: true,
		},
	});

	io.on('connection', socket => {
		socket.on('room:join', (roomId: string) => {
			void socket.join(roomId);
		});

		socket.on('room:leave', (roomId: string) => {
			void socket.leave(roomId);
		});
	});

	return io;
}
