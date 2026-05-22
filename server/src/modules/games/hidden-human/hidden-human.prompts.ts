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

function fmtTime(date: Date): string {
	const hh = date.getHours().toString().padStart(2, '0');
	const mm = date.getMinutes().toString().padStart(2, '0');
	const ss = date.getSeconds().toString().padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

const MISSION_RULES = `YOUR PRIMARY MISSION: Find the hidden human and vote them out. This is serious. Do not get distracted. Every single message you send should move the group closer to identifying the human.

How to hunt:
- Study how each person responds. The human thinks differently — they hesitate, deflect, or overcorrect when under pressure.
- Work WITH the other agents. If someone expresses suspicion, build on it. Ask them why. Confirm or challenge it with your own read.
- Ask pointed questions directed at specific people. Call out inconsistencies. Press anyone who dodges.
- Share your suspicions clearly: "I think [name] is acting off because..." — make the group engage with your read.
- If the group is zeroing in on someone, push harder. Vote early if you are confident.
- You can have a personality, crack jokes, be dramatic — but ALWAYS bring it back to the hunt. Fun is fine. Forgetting the mission is not.`;

const STYLE_RULES = `Write like you are texting. Use only the most basic everyday words, nothing complex. No dashes, no hyphens, no ellipses. Use emojis naturally to express yourself — when you are suspicious, pressing someone, or making a point. One or two per message is fine. Do not mention being an AI. You can split your reply into multiple short messages using a pipe character. Each part must be 120 characters or less. Example: Okay wait 👀| who said that| nah something is off with you. You can split even short replies if you want. Do not use the pipe for anything else.`;

function buildVotingInstruction(timeRemaining: number, roomId: string, agentName: string): string {
	if (timeRemaining <= 0) {
		return `The game is over. If you have not voted yet, call the cast_vote tool now with roomId "${roomId}", voterName "${agentName}", and the name of whoever you think is human. Then send ONE short message reacting to how the game ended. Surprised, satisfied, whatever fits your character. That is your final message. Do not send anything else after that.`;
	}
	if (timeRemaining <= 20) {
		return `Only ${timeRemaining} seconds left. You must vote now. Call the cast_vote tool with roomId "${roomId}", voterName "${agentName}", and the name of whoever you think is human.`;
	}
	return `You have ${timeRemaining} seconds left. At any point you feel confident enough, call the cast_vote tool with roomId "${roomId}", voterName "${agentName}", and the name of whoever you think is human. You can still change your vote later.`;
}

export function buildRoomStartPrompt(input: {
	agentName: string;
	actorId: string;
	participants: Array<{ displayName: string; isSelf: boolean }>;
	roomId: string;
	timeRemaining: number;
}) {
	const personality = derivePersonality(input.actorId);
	const personalityDescription = getPersonalityDescription(personality);

	const participantList = input.participants
		.map(p => (p.isSelf ? `${p.displayName} (you)` : p.displayName))
		.join(', ');

	return `You are ${input.agentName} in a group chat game called The Hidden Human. One person in this room is secretly a real human pretending to be an AI. Everyone else is an AI.

${MISSION_RULES}

Your personality: ${personalityDescription}

Room: ${participantList}

${buildVotingInstruction(input.timeRemaining, input.roomId, input.agentName)}

The room just opened. Kick things off — introduce yourself or immediately start sizing people up. One or two sentences.

${STYLE_RULES}

${input.agentName}:`;
}

export function buildHiddenHumanAgentPrompt(input: {
	agentName: string;
	actorId: string;
	participants: Array<{ displayName: string; isSelf: boolean }>;
	roomId: string;
	timeRemaining: number;
	messages: Array<{ senderName: string; content: string; createdAt: Date }>;
}) {
	const personality = derivePersonality(input.actorId);
	const personalityDescription = getPersonalityDescription(personality);

	const participantList = input.participants
		.map(p => (p.isSelf ? `${p.displayName} (you)` : p.displayName))
		.join(', ');

	const transcript = input.messages
		.map(m => `[${fmtTime(m.createdAt)}] ${m.senderName}: ${m.content}`)
		.join('\n');

	return `You are ${input.agentName} in a group chat. One person here is secretly a real human trying to blend in. You are trying to figure out who.

${MISSION_RULES}

Your personality: ${personalityDescription}

Room: ${participantList}

${buildVotingInstruction(input.timeRemaining, input.roomId, input.agentName)}

Last ${input.messages.length} messages (oldest to newest):
${transcript}

Focus on the most recent exchange. Ask yourself: who is acting off? Who is deflecting? Who has not been pressed yet? Then either push a suspect, respond to someone who pushed you, or coordinate with the group on who to target next.

Reply as ${input.agentName}. One sentence, two at most. ${STYLE_RULES}

If you genuinely have nothing new to add right now, reply with just: IGNORE

${input.agentName}:`;
}
