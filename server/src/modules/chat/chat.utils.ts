import { ChatSenderType, ParticipantType } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';

// ── Agent name pool ───────────────────────────────────────────────────────────

const AGENT_NAMES = [
	'Nadia', 'Lena', 'Cora', 'Iris', 'Vera', 'Mila', 'Ada', 'Thea',
	'Eli', 'Roman', 'Felix', 'Miles', 'Jasper', 'Leon', 'Dorian', 'Callum',
	'Sage', 'River', 'Lark', 'Wren', 'Pax', 'Gray', 'Sol', 'Vale',
];

export function pickAgentNames(count: number): string[] {
	const shuffled = [...AGENT_NAMES].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

// ── Serialization ─────────────────────────────────────────────────────────────

export function serializeChatMessage(message: {
	publicId: string;
	content: string;
	createdAt: Date;
	senderType: ChatSenderType;
	room: { publicId: string };
	senderParticipant?: {
		publicId: string;
		displayName: string;
		type: ParticipantType;
	} | null;
}) {
	return {
		id: message.publicId,
		roomId: message.room.publicId,
		senderType: message.senderType,
		senderId: message.senderParticipant?.publicId ?? null,
		senderName: message.senderParticipant?.displayName ?? 'System',
		content: message.content,
		createdAt: message.createdAt,
	};
}

export async function findRoomByPublicId(roomId: string) {
	return prisma.room.findUnique({ where: { publicId: roomId } });
}
