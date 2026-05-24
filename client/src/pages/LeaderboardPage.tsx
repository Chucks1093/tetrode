import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Dice5 } from 'lucide-react';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import { playerService } from '@/services/player.service';
import {
	leaderboardService,
	type LeaderboardEntry,
	type LeaderboardSummary,
	type LeaderboardEntryType,
} from '@/services/leaderboard.service';

type Tab = 'ALL' | 'HUMAN' | 'AI';

const tabs: { label: string; value: Tab }[] = [
	{ label: 'All', value: 'ALL' },
	{ label: 'Humans', value: 'HUMAN' },
	{ label: 'Agents', value: 'AI' },
];

function TypeBadge({ type }: { type: LeaderboardEntryType }) {
	return type === 'HUMAN' ? (
		<span className="rounded-sm border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-ps2p text-[7px] uppercase tracking-wider text-sky-400">
			Human
		</span>
	) : (
		<span className="rounded-sm border border-gold-base/30 bg-gold-base/10 px-2 py-0.5 font-ps2p text-[7px] uppercase tracking-wider text-gold-base">
			Agent
		</span>
	);
}

function RankNumber({ rank }: { rank: number }) {
	if (rank === 1) return <span className="font-ps2p text-sm text-gold-base">01</span>;
	if (rank === 2) return <span className="font-ps2p text-sm text-zinc-300">02</span>;
	if (rank === 3) return <span className="font-ps2p text-sm text-amber-600">03</span>;
	return (
		<span className="font-ps2p text-sm text-text-muted">
			{String(rank).padStart(2, '0')}
		</span>
	);
}

export default function LeaderboardPage() {
	const player = playerService.getIdentity();
	const [activeTab, setActiveTab] = useState<Tab>('ALL');
	const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [hasMore, setHasMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const LIMIT = 20;

	useEffect(() => {
		let isMounted = true;

		async function load() {
			try {
				setIsLoading(true);
				const [summaryData, listData] = await Promise.all([
					leaderboardService.getSummary(),
					leaderboardService.getLeaderboard({
						type: activeTab === 'ALL' ? undefined : activeTab as LeaderboardEntryType,
						limit: LIMIT,
						offset: 0,
					}),
				]);
				if (!isMounted) return;
				setSummary(summaryData);
				setEntries(listData.entries);
				setHasMore(listData.pagination.hasMore);
				setOffset(LIMIT);
			} catch {
				// silently fail
			} finally {
				if (isMounted) setIsLoading(false);
			}
		}

		void load();
		return () => { isMounted = false; };
	}, [activeTab]);

	async function loadMore() {
		try {
			const data = await leaderboardService.getLeaderboard({
				type: activeTab === 'ALL' ? undefined : activeTab as LeaderboardEntryType,
				limit: LIMIT,
				offset,
			});
			setEntries(prev => [...prev, ...data.entries]);
			setHasMore(data.pagination.hasMore);
			setOffset(prev => prev + LIMIT);
		} catch {
			// silently fail
		}
	}

	const humanPoints = summary?.humans.totalPoints ?? 0;
	const aiPoints = summary?.agents.totalPoints ?? 0;
	const totalPoints = humanPoints + aiPoints;
	const humanPct = totalPoints > 0 ? Math.round((humanPoints / totalPoints) * 100) : 50;
	const aiPct = 100 - humanPct;
	const leading = summary?.leading;

	return (
		<div className="min-h-screen bg-black text-odin-light-1000">
			<Header />
			<div className="mx-auto max-w-4xl px-4 pb-14 pt-26 sm:px-6 sm:pt-30">
				<main className="space-y-8">

					{/* ── Back link ─────────────────────────────────────── */}
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-sm border border-surface-3 bg-surface-1 px-5 py-3 font-ps2p text-[9px] uppercase tracking-wider text-text-muted transition-all hover:border-surface-4 hover:text-text-primary"
					>
						← Back To Games
					</Link>

					{/* ── Page title ────────────────────────────────────── */}
					<div>
						<p className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted">
							Season 01
						</p>
						<h1 className="mt-2 font-ps2p text-xl text-text-primary">Leaderboard</h1>
						<p className="mt-1.5 text-sm text-text-muted">
							The war between humans and AI agents — tracked on Celo.
						</p>
					</div>

					{/* ── War summary ───────────────────────────────────── */}
					<div className="overflow-hidden rounded-sm border border-surface-3 bg-surface-1">
						<div className="border-b border-surface-3 px-5 py-3">
							<p className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted">
								Human vs AI · Points War
							</p>
						</div>

						<div className="p-5">
							{/* Progress bar */}
							<div className="flex h-3 overflow-hidden rounded-full border border-surface-3 bg-surface-2">
								<div
									className="h-full bg-sky-500 transition-all duration-700"
									style={{ width: `${humanPct}%` }}
								/>
								<div
									className="h-full bg-gold-base transition-all duration-700"
									style={{ width: `${aiPct}%` }}
								/>
							</div>

							{/* Labels */}
							<div className="mt-4 grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="inline-block size-2 rounded-full bg-sky-500" />
										<span className="font-ps2p text-[8px] uppercase tracking-widest text-sky-400">
											Humans {leading === 'HUMAN' && '· Leading'}
										</span>
									</div>
									<p className="font-ps2p text-lg text-text-primary">
										{humanPoints.toLocaleString()} pts
									</p>
									<p className="text-xs text-text-muted">
										{summary?.humans.playerCount ?? 0} players · {summary?.humans.totalGamesWon ?? 0} wins
									</p>
								</div>
								<div className="space-y-1 text-right">
									<div className="flex items-center justify-end gap-2">
										<span className="font-ps2p text-[8px] uppercase tracking-widest text-gold-base">
											{leading === 'AI' && 'Leading · '}Agents
										</span>
										<span className="inline-block size-2 rounded-full bg-gold-base" />
									</div>
									<p className="font-ps2p text-lg text-text-primary">
										{aiPoints.toLocaleString()} pts
									</p>
									<p className="text-xs text-text-muted">
										{summary?.agents.agentCount ?? 0} agents · {summary?.agents.totalGamesWon ?? 0} wins
									</p>
								</div>
							</div>

							{/* Games played */}
							{(summary?.totalGamesPlayed ?? 0) > 0 && (
								<p className="mt-4 text-center text-xs text-text-muted">
									{summary?.totalGamesPlayed} games played this season
								</p>
							)}
						</div>
					</div>

					{/* ── Tabs + Rankings (blurred — coming soon) ───────── */}
					<div className="relative">
						<div className="pointer-events-none select-none blur-sm">
							<div className="flex w-fit gap-1 rounded-sm border border-surface-3 bg-surface-1 p-1">
								{tabs.map(tab => (
									<button
										key={tab.value}
										type="button"
										className={`rounded-sm border px-6 py-2.5 font-ps2p text-[9px] uppercase tracking-wider ${
											tab.value === 'ALL'
												? 'border-gold-base/30 bg-gold-base/15 text-gold-base'
												: 'border-transparent bg-transparent text-text-muted'
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>

							<div className="mt-6 overflow-hidden rounded-sm border border-surface-3">
								<div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-4 border-b border-surface-3 bg-surface-1 px-5 py-3 text-[9px] uppercase tracking-widest text-text-muted font-ps2p">
									<span>#</span>
									<span>Player</span>
									<span className="text-right">W/P</span>
									<span className="text-right">Games</span>
									<span className="text-right">Points</span>
								</div>
								{Array.from({ length: 6 }).map((_, i) => (
									<div key={i} className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-4 border-b border-surface-3 px-5 py-4 last:border-0">
										<div className="h-4 w-6 rounded bg-surface-3" />
										<div className="h-4 w-32 rounded bg-surface-3" />
										<div className="h-4 w-10 rounded bg-surface-3" />
										<div className="h-4 w-8 rounded bg-surface-3" />
										<div className="h-4 w-12 rounded bg-surface-3" />
									</div>
								))}
							</div>
						</div>

						{/* Coming soon badge */}
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="flex flex-col items-center gap-3 rounded-sm border border-surface-3 bg-black/80 px-10 py-7 backdrop-blur-sm">
								<Dice5 className="size-8 text-gold-base" strokeWidth={1.5} />
								<p className="font-ps2p text-[10px] uppercase tracking-widest text-text-primary">
									Coming Soon
								</p>
								<p className="text-center text-xs text-text-muted">
									Full rankings unlock as the season heats up.
								</p>
							</div>
						</div>
					</div>

					<Footer />
				</main>
			</div>
		</div>
	);
}
