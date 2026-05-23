'use client';

import makeBlockie from 'ethereum-blockies-base64';
import { Check, Copy, KeyRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useExportWallet } from '@privy-io/react-auth';
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { leaderboardService } from '@/services/leaderboard.service';
import { playerService } from '@/services/player.service';

const USDC_CONTRACT = '0x01C5C0122039549AD1493B8220cABEdD739BC44E';
const CELO_RPC = 'https://forno.celo-sepolia.celo-testnet.org';

async function fetchUsdcBalance(walletAddress: string): Promise<string> {
	// balanceOf(address) selector
	const selector = '0x70a08231';
	const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
	const data = selector + paddedAddr;

	const res = await fetch(CELO_RPC, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'eth_call',
			params: [{ to: USDC_CONTRACT, data }, 'latest'],
		}),
	});
	const json = await res.json() as { result?: string };
	if (!json.result || json.result === '0x') return '0.00';
	const raw = BigInt(json.result);
	// USDC has 6 decimals
	const whole = raw / BigInt(1_000_000);
	const frac = (raw % BigInt(1_000_000)).toString().padStart(6, '0').slice(0, 2);
	return `${whole}.${frac}`;
}

interface ProfileModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface StatCardProps {
	label: string;
	value: string;
}

function StatCard({ label, value }: StatCardProps) {
	return (
		<div className="flex flex-col items-center gap-1 rounded-xl border border-surface-3 bg-surface-2 px-4 py-3">
			<span className="font-jakarta text-base font-semibold text-text-primary">
				{value}
			</span>
			<span className="font-ps2p text-[7px] uppercase tracking-wider text-text-muted">
				{label}
			</span>
		</div>
	);
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
	const user = useAuthStore(state => state.user);
	const [copied, setCopied] = useState(false);
	const { exportWallet } = useExportWallet();
	const [cusdBalance, setCusdBalance] = useState<string | null>(null);
	const [points, setPoints] = useState<number | null>(null);
	const [gamesPlayed, setGamesPlayed] = useState<number | null>(null);

	useEffect(() => {
		if (!open) return;
		const actorId = playerService.getIdentity().actorId;
		leaderboardService.getMyStats(actorId).then(stats => {
			setPoints(stats.points);
			setGamesPlayed(stats.gamesPlayed);
		}).catch(() => {});
	}, [open]);

	useEffect(() => {
		if (!open || !user?.walletAddress) return;
		fetchUsdcBalance(user.walletAddress).then(setCusdBalance).catch(() => {});
	}, [open, user?.walletAddress]);

	if (!user) return null;

	const blockie = makeBlockie(user.email ?? user.id);

	const copyWallet = async () => {
		if (!user.walletAddress) return;
		await navigator.clipboard.writeText(user.walletAddress);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-sm overflow-hidden rounded-xl border border-surface-3 bg-surface-1 p-0 text-text-primary shadow-2xl"
			>
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-5 top-5 z-10 flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
					aria-label="Close profile modal"
				>
					<X className="size-5" />
				</button>

				<div className="flex flex-col items-center px-8 pb-6 pt-10">
					{/* Avatar */}
					<img
						src={blockie}
						alt={user.name}
						className="size-20 rounded-xl"
					/>

					{/* Identity */}
					<div className="mt-4 text-center">
						<DialogTitle className="font-jakarta text-lg font-semibold text-text-primary">
							{user.name}
						</DialogTitle>
						<DialogDescription className="mt-1 text-xs text-text-muted">
							{user.email}
						</DialogDescription>
					</div>

					{/* Stats */}
					<div className="mt-6 grid w-full grid-cols-3 gap-2">
						<StatCard label="USDC" value={cusdBalance ?? '—'} />
						<StatCard label="Points" value={points !== null ? points.toString() : '—'} />
						<StatCard label="Games" value={gamesPlayed !== null ? gamesPlayed.toString() : '—'} />
					</div>

					{/* Wallet */}
					{user.walletAddress && (
						<div className="mt-4 w-full space-y-2">
							<p className="font-ps2p text-[7px] uppercase tracking-wider text-text-muted">
								Wallet
							</p>
							<div className="flex items-center gap-2 rounded-md border border-surface-3 bg-surface-2 px-3 py-2.5">
								<span className="flex-1 break-all font-ps2p text-[7px] leading-relaxed text-text-secondary">
									{user.walletAddress}
								</span>
								<button
									type="button"
									onClick={() => void copyWallet()}
									className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
									aria-label="Copy wallet address"
								>
									{copied
										? <Check className="size-3.5 text-success" />
										: <Copy className="size-3.5" />}
								</button>
							</div>

							<button
								type="button"
								onClick={() => void exportWallet({ address: user.walletAddress! })}
								className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-3 bg-transparent py-2.5 text-[11px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
							>
								<KeyRound className="size-3.5" />
								Export private key
							</button>
						</div>
					)}
				</div>

				<div className="border-t border-surface-3 bg-surface-2 px-6 py-3.5 text-center">
					<p className="font-ps2p text-[7px] uppercase tracking-widest text-text-muted">
						Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
