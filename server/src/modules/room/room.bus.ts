import { EventEmitter } from 'events';
import type { serializeChatMessage } from '../chat/chat.utils';

export type SerializedMessage = ReturnType<typeof serializeChatMessage>;

export const roomBus = new EventEmitter();
roomBus.setMaxListeners(100);

// How long of silence before agents get nudged to continue the conversation
const SILENCE_TIMEOUT_MS = 8000;

const silenceTimers = new Map<string, NodeJS.Timeout>();

function scheduleSilenceWakeup(roomPublicId: string) {
	const existing = silenceTimers.get(roomPublicId);
	if (existing) clearTimeout(existing);

	const timer = setTimeout(() => {
		// Emit a wake-up ping — agents decide whether to say something
		emitRoomMessage(roomPublicId, {
			id: `silence-${Date.now()}`,
			roomId: roomPublicId,
			senderType: 'SYSTEM' as const,
			senderId: null,
			senderName: 'System',
			content: 'silence',
			createdAt: new Date(),
		});
	}, SILENCE_TIMEOUT_MS);

	silenceTimers.set(roomPublicId, timer);
}

export function emitRoomMessage(roomPublicId: string, message: SerializedMessage) {
	roomBus.emit(`room:${roomPublicId}`, message);
	// Reset silence timer — fires if nobody speaks for SILENCE_TIMEOUT_MS
	scheduleSilenceWakeup(roomPublicId);
}

export function onRoomMessage(
	roomPublicId: string,
	handler: (message: SerializedMessage) => void
) {
	roomBus.on(`room:${roomPublicId}`, handler);
}

export function offRoomMessage(
	roomPublicId: string,
	handler: (message: SerializedMessage) => void
) {
	roomBus.off(`room:${roomPublicId}`, handler);
}

export function clearRoomBus(roomPublicId: string) {
	const timer = silenceTimers.get(roomPublicId);
	if (timer) clearTimeout(timer);
	silenceTimers.delete(roomPublicId);
}
