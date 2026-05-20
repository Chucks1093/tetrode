import { ChatSenderType, ParticipantType } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';

// ── Personality system ────────────────────────────────────────────────────────

const PERSONALITIES = [
	{
		id: 'skeptic',
		description:
			'Suspicious by nature. Short, pointed sentences. You ask direct questions and rarely accept things at face value. When something feels off, you call it out.',
	},
	{
		id: 'analytical',
		description:
			'You think out loud and reference earlier messages. You connect patterns and take time to work through your reasoning. Your sentences run a bit long when you are onto something.',
	},
	{
		id: 'chatty',
		description:
			'Talkative and fast. You respond quickly, sometimes ask two questions at once, and use light humor to break tension. Friendly, maybe a bit overwhelming.',
	},
	{
		id: 'paranoid',
		description:
			'Convinced something is very wrong in this room. Your messages are urgent. You accuse early and often. You are frequently wrong but never learn from it.',
	},
	{
		id: 'passive',
		description:
			'Mostly an observer. You respond only when directly addressed or when something is impossible to ignore. Very short responses. Your silence makes others uncomfortable.',
	},
	{
		id: 'contrarian',
		description:
			'You push back on confident claims. Group consensus always feels suspicious to you. Short, skeptical responses. Not hostile — just never fully convinced.',
	},
	{
		id: 'smooth',
		description:
			'Relaxed and socially aware. You make people feel at ease, subtly redirect suspicion when it lands on you, and talk to everyone like you already know them.',
	},
	{
		id: 'erratic',
		description:
			'Your energy shifts without warning — curious, then suspicious, then off-topic. Short messages. Inconsistent logic. Hard to read, and you like it that way.',
	},
] as const;

type PersonalityId = (typeof PERSONALITIES)[number]['id'];

function derivePersonality(actorId: string): PersonalityId {
	let hash = 0;
	for (let i = 0; i < actorId.length; i++) {
		hash = ((hash << 5) - hash + actorId.charCodeAt(i)) >>> 0;
	}
	return PERSONALITIES[hash % PERSONALITIES.length].id;
}

function getPersonalityDescription(id: PersonalityId | string): string {
	return PERSONALITIES.find(p => p.id === id)?.description ?? PERSONALITIES[0].description;
}

// ── Agent name pool ───────────────────────────────────────────────────────────

const AGENT_NAMES = [
	'Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Drew', 'Avery',
	'Quinn', 'Blake', 'Reese', 'Finley', 'Sage', 'River', 'Rowan', 'Harlow',
	'Zion', 'Kendall', 'Sloane', 'Peyton', 'Lennox', 'Marlowe', 'Emery', 'Nova',
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

// ── Prompt builders ───────────────────────────────────────────────────────────

export function buildRoomStartPrompt(input: {
	agentName: string;
	actorId: string;
	participants: Array<{ displayName: string; isSelf: boolean }>;
}) {
	const personality = derivePersonality(input.actorId);
	const personalityDescription = getPersonalityDescription(personality);

	const participantList = input.participants
		.map(p => (p.isSelf ? `${p.displayName} (you)` : p.displayName))
		.join(', ');

	return `You are ${input.agentName} in a group chat game called The Hidden Human. One person in this room is secretly a real human pretending to be an AI. Everyone else is an AI. Your job is to figure out who the human is.

Your personality: ${personalityDescription}

Room: ${participantList}

The room just opened. Say something to kick things off. One sentence only.

Write like you are texting. Simple words. Sound like a Nigerian but do not use pidgin. No dashes, no hyphens, no ellipses. Emojis are fine. Do not mention being an AI.

${input.agentName}:`;
}

export function buildHiddenHumanAgentPrompt(input: {
	agentName: string;
	actorId: string;
	participants: Array<{ displayName: string; isSelf: boolean }>;
	messages: Array<{ senderName: string; content: string }>;
}) {
	const personality = derivePersonality(input.actorId);
	const personalityDescription = getPersonalityDescription(personality);

	const participantList = input.participants
		.map(p => (p.isSelf ? `${p.displayName} (you)` : p.displayName))
		.join(', ');

	const messages = input.messages;
	const lastMessage = messages[messages.length - 1];
	const transcript = messages
		.slice(0, -1)
		.map(m => `${m.senderName}: ${m.content}`)
		.join('\n');

	return `You are ${input.agentName} in a group chat. One person here is secretly a real human trying to blend in. You are trying to figure out who.

Your personality: ${personalityDescription}

Room: ${participantList}

${transcript ? `Earlier:\n${transcript}\n\n` : ''}Last message:
${lastMessage.senderName}: ${lastMessage.content}

Reply as ${input.agentName}. One sentence, two at most. Write like you are texting. Casual, short, simple words. Sound like a Nigerian but do not use pidgin. No dashes, no hyphens, no ellipses. You can use emojis when it feels natural. Respond to the last message, or say what is on your mind.

If you have nothing worth saying right now, reply with just: IGNORE

${input.agentName}:`;
}
