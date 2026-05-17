import { useEffect, useState, type ComponentType } from 'react';
import { Link, useParams } from 'react-router';
import HiddenHumanCore from '@/components/hidden-human/HiddenHumanCore';
import { gameService, type Game } from '@/services/game.service';
import { roomService, type Room } from '@/services/room.service';

type GameCoreProps = {
	room: Room | null;
	roomError: string | null;
};

const gameCores: Record<string, ComponentType<GameCoreProps>> = {
	'the-hidden-human': HiddenHumanCore,
};

export default function GameCore() {
	const { gameId = '', roomId = '' } = useParams();
	const [game, setGame] = useState<Game | null>(null);
	const [gameError, setGameError] = useState<string | null>(null);
	const [isLoadingGame, setIsLoadingGame] = useState(true);
	const [room, setRoom] = useState<Room | null>(null);
	const [roomError, setRoomError] = useState<string | null>(null);
	const SelectedGameCore = game ? gameCores[game.id] : null;

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

	useEffect(() => {
		let isMounted = true;

		async function loadRoom() {
			try {
				const nextRoom = await roomService.getRoom(roomId);
				if (!isMounted) return;
				setRoom(nextRoom);
				setRoomError(null);
			} catch (error) {
				if (!isMounted) return;
				setRoom(null);
				setRoomError(
					error instanceof Error ? error.message : 'Failed to load room.'
				);
			}
		}

		if (roomId) {
			void loadRoom();
		}

		return () => {
			isMounted = false;
		};
	}, [roomId]);

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

	if (SelectedGameCore) {
		return <SelectedGameCore room={room} roomError={roomError} />;
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-black px-6 text-odin-light-100">
			<div className="text-center">
				<p className="font-ps2p text-lg text-orange-500">{game.title}</p>
				<p className="mt-4 text-sm text-odin-dark-1000-a-65">
					Game core is not ready yet.
				</p>
				{roomError ? (
					<p className="mt-3 text-sm text-red-400">{roomError}</p>
				) : null}
				<Link
					to={`/${game.id}`}
					className="mt-6 inline-flex rounded-xl border border-[color:var(--surface-4)] bg-[color:var(--surface-2)] px-5 py-2.5 font-jakarta text-sm font-semibold text-[var(--text-primary)] hover:bg-[color:var(--surface-3)]"
				>
					Back To Details
				</Link>
			</div>
		</div>
	);
}
