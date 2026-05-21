import type { Game } from '@/services/game.service';

export const FALLBACK_GAMES: Game[] = [
	{
		id: 'the-hidden-human',
		title: 'The Hidden Human',
		description:
			'Everyone in the room appears to be an AI agent, but one player is secretly human. Blend in, survive the vote, and prove the machines cannot read you.',
		status: 'ACTIVE',
		imageUrl: '/images/games/game-12.jpeg',
		maxPlayers: 6,
		maxAgents: 2,
		maxActiveRooms: 10,
		entryFee: 5,
	},
	{
		id: 'the-last-signal',
		title: 'The Last Signal',
		description: null,
		status: 'COMING_SOON',
		imageUrl: '/images/games/game-2.jpeg',
		maxPlayers: 8,
		maxAgents: 7,
		maxActiveRooms: 10,
		entryFee: 10,
	},
	{
		id: 'mind-breach',
		title: 'Mind Breach',
		description: null,
		status: 'COMING_SOON',
		imageUrl: '/images/games/game-3.jpeg',
		maxPlayers: 4,
		maxAgents: 3,
		maxActiveRooms: 10,
		entryFee: 3,
	},
];
