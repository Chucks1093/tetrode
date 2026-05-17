import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import GameDetailsCard from '@/components/games/GameDetails';
import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import { gameService, type Game } from '@/services/game.service';
import { playerService } from '@/services/player.service';
import { roomService } from '@/services/room.service';

const gameNotes: Record<string, string[]> = {
	'the-hidden-human': [
		'Everyone in the room appears to be an AI agent, but one player is secretly human and must survive suspicion.',
		'The AI agents study how everyone speaks, reacts, defends themselves, and handles pressure. The hidden human must blend in and avoid being exposed.',
		'If the human survives the vote, the human wins. If the AI agents expose the hidden human, the agents win.',
	],
};

export default function GameDetails() {
	const navigate = useNavigate();
	const { gameId = '' } = useParams();
	const [game, setGame] = useState<Game | null>(null);
	const [gameError, setGameError] = useState<string | null>(null);
	const [isLoadingGame, setIsLoadingGame] = useState(true);
	const [isCreatingRoom, setIsCreatingRoom] = useState(false);
	const [roomError, setRoomError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function loadGame() {
			try {
				setIsLoadingGame(true);
				const nextGame = await gameService.fetchGame(gameId);
				if (!isMounted) return;
				setGame(nextGame);
				setGameError(null);
			} catch (error) {
				if (!isMounted) return;
				setGame(null);
				setGameError(
					error instanceof Error ? error.message : 'Failed to load game.'
				);
			} finally {
				if (isMounted) {
					setIsLoadingGame(false);
				}
			}
		}

		if (gameId) {
			void loadGame();
		} else {
			setIsLoadingGame(false);
			setGame(null);
			setGameError('Game id is required.');
		}

		return () => {
			isMounted = false;
		};
	}, [gameId]);

	if (isLoadingGame) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-black px-6 text-odin-light-100">
				<p className="font-ps2p text-sm text-[var(--accent-bright)]">
					Loading Game...
				</p>
			</div>
		);
	}

	if (!game) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-black px-6 text-odin-light-100">
				<div className="text-center">
					<p className="font-ps2p text-lg text-[var(--accent-bright)]">
						Game Not Found
					</p>
					{gameError ? (
						<p className="mt-4 text-sm text-red-400">{gameError}</p>
					) : null}
					<Link
						to="/"
						className="mt-6 inline-flex rounded-xl border border-[color:var(--gold-dim)] bg-[linear-gradient(180deg,var(--gold-bright),var(--gold-base))] px-5 py-2.5 font-jakarta font-semibold text-[color:var(--surface-0)] hover:brightness-105"
					>
						Back Home
					</Link>
				</div>
			</div>
		);
	}

	const notes =
		gameNotes[game.id] ?? [
			'This game page is reserved for the dedicated flow and core room experience. For now, this title is still in preparation.',
		];

	const handlePlay = async () => {
		if (game.status !== 'ACTIVE') {
			return;
		}

		try {
			setIsCreatingRoom(true);
			setRoomError(null);
			const player = playerService.getIdentity();
			const createdRoom = await roomService.createRoom({
				gameId: game.id,
				actorId: player.actorId,
				displayName: player.displayName,
			});
			navigate(`/${game.id}/${createdRoom.id}`);
		} catch (error) {
			setRoomError(
				error instanceof Error ? error.message : 'Failed to create room.'
			);
		} finally {
			setIsCreatingRoom(false);
		}
	};

	return (
		<div className="min-h-screen bg-black text-odin-light-1000">
			<Header />
			<div className="mx-auto max-w-6xl px-4 pb-10 pt-26 sm:px-6 sm:pb-14 sm:pt-30">
				<main className="space-y-8">
					<GameDetailsCard
						game={game}
						onPlay={() => void handlePlay()}
						isLoading={isCreatingRoom}
						playLabel={game.status === 'ACTIVE' ? 'Play' : 'Coming Soon'}
					>
						{notes.map(note => (
							<p key={note}>{note}</p>
						))}
						{roomError ? <p className="text-sm text-red-400">{roomError}</p> : null}
					</GameDetailsCard>

					<Link
						to="/"
						className="inline-flex rounded-xl border border-[color:var(--surface-4)] bg-[color:var(--surface-2)] px-5 py-2.5 font-jakarta text-sm font-semibold text-[var(--text-primary)] hover:bg-[color:var(--surface-3)]"
					>
						Back To Games
					</Link>

					<Footer />
				</main>
			</div>
		</div>
	);
}
