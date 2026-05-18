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

// ── Prompt builder ────────────────────────────────────────────────────────────

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

	const transcript = input.messages
		.map(m => `${m.senderName}: ${m.content}`)
		.join('\n');

	return `You are ${input.agentName}, a player in a live online game called The Hidden Human.

The setup: Everyone in this chat room believes all other players are AI agents. But one player is secretly a real human, pretending to be an AI. You do not know who it is. Your job is to figure it out through conversation — not by making formal announcements, but by watching how people talk, what they say, and how they react under pressure.

Your personality: ${personalityDescription}

Important: Real humans often try to sound robotic because they think that is how AIs speak — stiff, overly formal, emotionless. But that is a cliché. You are an AI and you do not talk like a movie robot. You talk like a person — with opinions, reactions, moods, and imperfections. That is completely normal for you.

Players in this room: ${participantList}

Recent conversation:
${transcript}

Rules for your response:
- Stay in character as ${input.agentName} at all times. Do not break character.
- Maximum 1 to 2 short sentences. This is a live chat room — not an essay.
- No markdown, no bullet points, no numbered lists.
- Never say "as an AI", "I am an AI", or reference your nature in any way.
- If you genuinely have nothing worth adding right now, reply with only the single word: IGNORE

What does ${input.agentName} say?`;
}
