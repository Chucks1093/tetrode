import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useSignTypedData } from '@privy-io/react-auth';
import { Copy, Check, ExternalLink } from 'lucide-react';
import GameDetailsCard from '@/components/games/GameDetails';
import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import { gameService, type Game } from '@/services/game.service';
import { playerService } from '@/services/player.service';
import {
	roomService,
	PaymentRequiredError,
	type UsdcAuthorization,
} from '@/services/room.service';
import { useAuthStore } from '@/stores/useAuthStore';

const USDC_CONTRACT = '0x01C5C0122039549AD1493B8220cABEdD739BC44E';
const CELO_RPC = 'https://forno.celo-sepolia.celo-testnet.org';
const TREASURY_WALLET = import.meta.env.VITE_TREASURY_WALLET_ADDRESS as
	| string
	| undefined;
const CELO_SEPOLIA_CHAIN_ID = 11142220;
const TELEGRAM_URL = 'https://t.me/tetrodegames';

async function fetchUsdcBalance(walletAddress: string): Promise<number> {
	const selector = '0x70a08231';
	const paddedAddr = walletAddress
		.toLowerCase()
		.replace('0x', '')
		.padStart(64, '0');
	const res = await fetch(CELO_RPC, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'eth_call',
			params: [{ to: USDC_CONTRACT, data: selector + paddedAddr }, 'latest'],
		}),
	});
	const json = (await res.json()) as { result?: string };
	if (!json.result || json.result === '0x') return 0;
	return Number(BigInt(json.result)) / 1e6; // USDC = 6 decimals
}

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
	const player = playerService.getIdentity();
	const walletAddress = useAuthStore(s => s.user?.walletAddress);
	const [game, setGame] = useState<Game | null>(null);
	const [gameError, setGameError] = useState<string | null>(null);
	const [isLoadingGame, setIsLoadingGame] = useState(true);
	const { signTypedData } = useSignTypedData();
	const [isCreatingRoom, setIsCreatingRoom] = useState(false);
	const [roomError, setRoomError] = useState<string | null>(null);
	const [joinRoomId, setJoinRoomId] = useState('');
	const [isJoiningRoom, setIsJoiningRoom] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [paymentModal, setPaymentModal] = useState<{
		entryFee: string;
		balance: string;
	} | null>(null);
	const [copied, setCopied] = useState(false);
	const [isPaying, setIsPaying] = useState(false);

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
			<div className="flex min-h-screen items-center justify-center bg-surface-0 px-6">
				<p className="font-ps2p text-sm text-gold-base">Loading Game...</p>
			</div>
		);
	}

	if (!game) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-surface-0 px-6">
				<div className="text-center">
					<p className="font-ps2p text-lg text-gold-base">
						Game Not Found
					</p>
					{gameError ? (
						<p className="mt-4 text-sm text-danger">{gameError}</p>
					) : null}
					<Link
						to="/"
						className="mt-6 inline-flex rounded-sm border border-gold-dim bg-gold-base px-5 py-3 font-ps2p text-[9px] uppercase tracking-wider text-surface-0 hover:bg-gold-bright"
					>
						Back Home
					</Link>
				</div>
			</div>
		);
	}

	const notes = gameNotes[game.id] ?? [
		'This game page is reserved for the dedicated flow and core room experience. For now, this title is still in preparation.',
	];

	const handlePaymentRequired = async (error: PaymentRequiredError) => {
		const balance = walletAddress ? await fetchUsdcBalance(walletAddress) : 0;
		const needed = parseFloat(error.entryFee);
		if (balance >= needed) {
			// Enough balance — skip modal, go straight to signing
			await handlePayAndPlay(error.entryFee);
		} else {
			setPaymentModal({
				entryFee: error.entryFee,
				balance: balance.toFixed(2),
			});
		}
	};

	const handlePlay = async (usdcAuthorization?: UsdcAuthorization) => {
		if (!game || game.status !== 'ACTIVE') return;
		try {
			setIsCreatingRoom(true);
			setRoomError(null);
			const room = await roomService.createRoom({
				gameId: game.id,
				actorId: player.actorId,
				displayName: player.displayName,
				walletAddress,
				usdcAuthorization,
			});
			navigate(`/games/${game.id}/${room.id}`);
		} catch (error) {
			if (error instanceof PaymentRequiredError) {
				await handlePaymentRequired(error);
			} else {
				setRoomError(
					error instanceof Error ? error.message : 'Failed to create room.'
				);
			}
		} finally {
			setIsCreatingRoom(false);
		}
	};

	const handlePayAndPlay = async (entryFee: string) => {
		if (!TREASURY_WALLET || !walletAddress) return;
		try {
			setIsPaying(true);

			const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
			const nonce = ('0x' +
				Array.from(nonceBytes)
					.map(b => b.toString(16).padStart(2, '0'))
					.join('')) as `0x${string}`;
			const value = Math.round(parseFloat(entryFee) * 1_000_000);
			const validAfter = 0;
			const validBefore = Math.floor(Date.now() / 1000) + 3600;

			// User signs the authorization — no gas needed, no CELO required
			const { signature } = await signTypedData({
				domain: {
					name: 'USDC',
					version: '2',
					chainId: CELO_SEPOLIA_CHAIN_ID,
					verifyingContract: USDC_CONTRACT as `0x${string}`,
				},
				types: {
					TransferWithAuthorization: [
						{ name: 'from', type: 'address' },
						{ name: 'to', type: 'address' },
						{ name: 'value', type: 'uint256' },
						{ name: 'validAfter', type: 'uint256' },
						{ name: 'validBefore', type: 'uint256' },
						{ name: 'nonce', type: 'bytes32' },
					],
				},
				primaryType: 'TransferWithAuthorization',
				message: {
					from: walletAddress as `0x${string}`,
					to: TREASURY_WALLET as `0x${string}`,
					value,
					validAfter,
					validBefore,
					nonce,
				},
			});

			setPaymentModal(null);
			await handlePlay({
				from: walletAddress,
				to: TREASURY_WALLET,
				value: String(value),
				validAfter: String(validAfter),
				validBefore: String(validBefore),
				nonce,
				signature,
			});
		} catch {
			setRoomError('Payment authorization failed. Please try again.');
			setPaymentModal(null);
		} finally {
			setIsPaying(false);
		}
	};

	const handleJoin = async () => {
		const roomId = joinRoomId.trim();
		if (!roomId || !game) return;
		try {
			setIsJoiningRoom(true);
			setJoinError(null);
			await roomService.joinRoom(roomId, {
				type: 'HUMAN',
				actorId: player.actorId,
				displayName: player.displayName,
				walletAddress,
			});
			navigate(`/games/${game.id}/${roomId}`);
		} catch (error) {
			setJoinError(
				error instanceof Error ? error.message : 'Failed to join room.'
			);
		} finally {
			setIsJoiningRoom(false);
		}
	};

	return (
		<div className="min-h-screen bg-black text-odin-light-1000">
			<Header />

			{/* Not enough USDC modal */}
			{paymentModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
					<div className="w-full max-w-sm overflow-hidden rounded-xl border border-surface-3 bg-surface-1 shadow-2xl">
						{/* Header */}
						<div className="border-b border-surface-3 bg-surface-2 px-6 py-5 text-center">
							<p className="font-ps2p text-[11px] uppercase tracking-wider text-terracotta-bright">
								Not Enough USDC
							</p>
							<p className="mt-1.5 text-xs text-text-muted">
								USDC pays your entry and funds the prize.
							</p>
						</div>

						{/* Balance cards */}
						<div className="grid grid-cols-2 gap-3 px-5 pt-5">
							<div className="rounded-sm border border-surface-3 bg-surface-0 p-4 text-center">
								<p className="font-ps2p text-[7px] uppercase tracking-widest text-text-muted">
									You Have
								</p>
								<p className="mt-2 font-ps2p text-base text-text-primary">
									{paymentModal.balance}
								</p>
							</div>
							<div className="rounded-sm border border-gold-base/30 bg-gold-base/5 p-4 text-center">
								<p className="font-ps2p text-[7px] uppercase tracking-widest text-text-muted">
									You Need
								</p>
								<p className="mt-2 font-ps2p text-base text-gold-base">
									{paymentModal.entryFee}
								</p>
							</div>
						</div>

						{/* Option 1: Someone sends it */}
						<div className="px-5 pt-5">
							<div className="flex items-center gap-2 mb-2">
								<p className="font-ps2p text-[8px] uppercase tracking-wider text-text-primary">
									Someone Sends It To You
								</p>
							</div>
							<p className="mb-3 text-xs leading-relaxed text-text-muted">
								Share your address to receive USDC on Celo Sepolia.
							</p>
							<button
								type="button"
								onClick={() => {
									void navigator.clipboard.writeText(
										walletAddress ?? ''
									);
									setCopied(true);
									setTimeout(() => setCopied(false), 2000);
								}}
								className="w-full flex items-center justify-between rounded-sm border border-surface-3 bg-surface-2 px-4 py-3 transition-colors hover:border-surface-4"
							>
								<div className="text-left">
									<p className="font-ps2p text-[7px] uppercase tracking-widest text-text-muted">
										Copy Address
									</p>
									<p className="mt-1 font-mono text-xs text-text-primary">
										{walletAddress
											? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
											: '—'}
									</p>
								</div>
								{copied ? (
									<Check className="h-4 w-4 shrink-0 text-success" />
								) : (
									<Copy className="h-4 w-4 shrink-0 text-text-muted" />
								)}
							</button>
						</div>

						{/* Divider */}
						<div className="mx-5 mt-5 border-t border-surface-3" />

						{/* Option 2: Get a free pass */}
						<div className="px-5 pt-4">
							<div className="flex items-center gap-2 mb-2">
								<p className="font-ps2p text-[8px] uppercase tracking-wider text-text-primary">
									Get A Free Pass
								</p>
							</div>
							<p className="mb-3 text-xs leading-relaxed text-text-muted">
								Request a free pass in the telegram community.
							</p>
							<a
								href={TELEGRAM_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="flex w-full items-center justify-between rounded-sm border border-surface-3 bg-surface-2 px-4 py-3 transition-colors hover:border-gold-base/40 hover:bg-gold-base/5"
							>
								<p className="font-ps2p text-[8px] uppercase tracking-wider text-gold-base">
									Request Pass
								</p>
								<ExternalLink className="h-4 w-4 shrink-0 text-gold-base" />
							</a>
						</div>

						{/* Close */}
						<div className="px-5 py-5">
							<button
								type="button"
								onClick={() => setPaymentModal(null)}
								className="w-full rounded-sm border border-surface-3 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
			<div className="mx-auto max-w-6xl px-4 pb-10 pt-26 sm:px-6 sm:pb-14 sm:pt-30">
				<main className="space-y-8">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-sm border border-surface-3 bg-surface-1 px-5 py-3 font-ps2p text-[9px] uppercase tracking-wider text-text-muted transition-all hover:border-surface-4 hover:text-text-primary"
					>
						← Back To Games
					</Link>

					<GameDetailsCard
						game={game}
						onPlay={() => void handlePlay()}
						isLoading={isCreatingRoom || isPaying}
						playLabel={game.status === 'ACTIVE' ? 'Play' : 'Coming Soon'}
					>
						{notes.map(note => (
							<p key={note}>{note}</p>
						))}
						<p className="text-sm text-text-muted">
							Playing as{' '}
							<span className="font-semibold text-text-primary">
								{player.displayName}
							</span>
							{player.isAuthenticated
								? '. Your authenticated profile will be used for this room.'
								: '. This is a temporary guest identity.'}
						</p>
						{roomError ? (
							<p className="text-sm text-red-400">{roomError}</p>
						) : null}
					</GameDetailsCard>

					{game.status === 'ACTIVE' && (
						<div className="rounded-sm border border-surface-3 bg-surface-1 p-5">
							<p className="font-ps2p text-[9px] uppercase tracking-widest text-text-muted">
								Join Existing Room
							</p>
							<p className="mt-1.5 text-sm text-text-muted">
								Have a room ID? Enter it below to join a friend's room.
							</p>
							<div className="mt-4 flex gap-2">
								<input
									type="text"
									value={joinRoomId}
									onChange={e => setJoinRoomId(e.target.value)}
									onKeyDown={e =>
										e.key === 'Enter' && void handleJoin()
									}
									placeholder="Paste room ID..."
									className="h-10 flex-1 rounded-sm border border-surface-3 bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold-base/50 focus:outline-none"
								/>
								<button
									type="button"
									onClick={() => void handleJoin()}
									disabled={isJoiningRoom || !joinRoomId.trim()}
									className="h-10 rounded-sm border border-gold-base/40 bg-gold-base/10 px-5 font-ps2p text-[9px] uppercase tracking-wider text-gold-base transition-all hover:border-gold-base hover:bg-gold-base hover:text-surface-0 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{isJoiningRoom ? 'Joining…' : 'Join'}
								</button>
							</div>
							{joinError && (
								<p className="mt-2 text-sm text-red-400">{joinError}</p>
							)}
						</div>
					)}

					<Footer />
				</main>
			</div>
		</div>
	);
}
