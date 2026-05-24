import { ArrowRight, Info } from 'lucide-react';
import { padNumber } from '@/utils/number.utils';
import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router';
import GameCard from '../components/landing/GameCard';
import GameCardSkeleton from '../components/landing/GameCardSkeleton';
import Footer from '../components/shared/Footer';
import Header from '../components/shared/Header';
import { gameService, type Game } from '../services/game.service';

const categories = ['All', 'Upcoming', 'Active'] as const;
type Category = (typeof categories)[number];

export default function LandingPage() {
	const [activeCategory, setActiveCategory] = useState<Category>('All');
	const [games, setGames] = useState<Game[]>([]);
	const [isLoadingGames, setIsLoadingGames] = useState(true);

	useEffect(() => {
		let isMounted = true;

		async function loadGames() {
			try {
				setIsLoadingGames(true);
				const nextGames = await gameService.fetchGames();
				if (!isMounted) return;
				setGames(nextGames);
			} catch {
				// fetchGames never throws — it returns fallback data
			} finally {
				if (isMounted) setIsLoadingGames(false);
			}
		}

		void loadGames();
		return () => {
			isMounted = false;
		};
	}, []);

	const filteredGames = useMemo(
		() =>
			games.filter(game => {
				if (activeCategory === 'All') return true;
				if (activeCategory === 'Upcoming')
					return game.status === 'COMING_SOON';
				return game.status === 'ACTIVE';
			}),
		[activeCategory, games]
	);

	return (
		<div className="relative min-h-screen overflow-hidden bg-black text-odin-light-1000">
			<Header />
			<Outlet />

			<div className="relative z-40 mx-auto min-h-screen max-w-6xl px-4 pb-8 pt-24 sm:px-6 sm:pt-30">
				<main>
					{/* ── Hero ─────────────────────────────────────────────────── */}
					<div className="relative mt-4 overflow-hidden rounded-2xl border border-gold-base/15">
						{/* CSS grid lines */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								backgroundImage: [
									'linear-gradient(rgba(212,160,23,0.06) 1px, transparent 1px)',
									'linear-gradient(90deg, rgba(212,160,23,0.06) 1px, transparent 1px)',
								].join(','),
								backgroundSize: '44px 44px',
							}}
						/>

						{/* Noise texture */}
						<div className=" noise z-30 check h-screenn absolute" />

						{/* Corner badges */}
						<div className="absolute left-0 top-0 border-b border-r border-gold-base/15 bg-gold-base/5 px-2.5 py-2 sm:px-4 sm:py-2.5">
							<p className="font-ps2p text-[7px] uppercase tracking-[0.22em] text-gold-base/50">
								Tetrode Arena
							</p>
						</div>
						<div className="absolute right-0 top-0 border-b border-l border-gold-base/15 bg-gold-base/5 px-2.5 py-2 sm:px-4 sm:py-2.5">
							<p className="font-ps2p text-[7px] uppercase tracking-[0.22em] text-gold-base/50">
								Season 01
							</p>
						</div>
						<div className="absolute bottom-0 left-0 border-r border-t border-gold-base/15 bg-gold-base/5 px-2.5 py-2 sm:px-4 sm:py-2.5">
							<p className="font-ps2p text-[7px] uppercase tracking-[0.22em] text-gold-base/50">
								Survive
							</p>
						</div>
						<div className="absolute bottom-0 right-0 border-l border-t border-gold-base/15 bg-gold-base/5 px-2.5 py-2 sm:px-4 sm:py-2.5">
							<p className="font-ps2p text-[7px] uppercase tracking-[0.22em] text-gold-base/50">
								Built on Celo
							</p>
						</div>

						{/* Main content */}
						<div className="relative z-10 flex flex-col items-center px-4 py-16 text-center sm:px-10 sm:py-18 lg:px-20 lg:py-20">
							{/* Season tag */}
							<p className="flex flex-wrap items-center justify-center gap-2 font-ps2p text-[7px] uppercase tracking-[0.2em] text-text-muted sm:text-[8px] sm:tracking-widest">
								<span className="inline-block size-1.5 animate-pulse rounded-full bg-gold-base" />
								Season 01 · Now Live
							</p>

							{/* Title */}
							<h1 className="mt-8 uppercase leading-[0.9] sm:mt-10">
								<span
									className="font-game-paused text-[clamp(2.75rem,8vw,6rem)] text-text-secondary"
									style={{
										display: 'inline-block',
										transform: 'skewX(-6deg)',
										textShadow:
											'2px 2px 0 #b8890f, 4px 4px 0 #b8890f, 6px 6px 0 #8b6914, 8px 8px 0 rgba(107,81,15,0.3)',
									}}
								>
									Prove You Can
								</span>
								<span className=" block">
									<span
										className="font-game-paused text-[clamp(2.75rem,8vw,6rem)] text-text-secondary"
										style={{
											display: 'inline-block',
											transform: 'skewX(-6deg)',
											textShadow:
												'2px 2px 0 #b8890f, 4px 4px 0 #b8890f, 6px 6px 0 #8b6914, 8px 8px 0 rgba(107,81,15,0.3)',
										}}
									>
										Outsmart AI
									</span>
								</span>
							</h1>

							{/* CTA buttons */}
							<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
								<Link
									to="/leaderboard"
									className="group flex w-full items-center justify-center gap-2.5 rounded-sm border border-gold-base bg-gold-base px-5 py-3 font-ps2p text-[8px] uppercase tracking-[0.18em] text-surface-0 transition-all hover:border-gold-bright hover:bg-gold-bright sm:w-auto sm:px-7 sm:py-3.5 sm:text-[9px] sm:tracking-wider"
								>
									Enter the Arena
									<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
								</Link>
								<Link
									to="/about"
									className="flex w-full items-center justify-center gap-2.5 rounded-sm border border-surface-3 bg-surface-1 px-5 py-3 font-ps2p text-[8px] uppercase tracking-[0.18em] text-text-muted transition-all hover:border-surface-4 hover:bg-surface-2 hover:text-text-primary sm:w-auto sm:px-7 sm:py-3.5 sm:text-[9px] sm:tracking-wider"
								>
									<Info className="size-3.5" />
									How It Works
								</Link>
							</div>

							{/* Stats */}
							<div className="mt-12 w-full max-w-3xl overflow-hidden rounded-sm border border-surface-3">
								<div className="grid grid-cols-1 sm:grid-cols-3">
									{[
										{ label: 'Games Live', value: padNumber(4) },
										{ label: 'AI Agents', value: padNumber(24) },
										{ label: 'Proof of Play', value: 'Live' },
									].map((stat, i) => (
										<div
											key={stat.label}
											className={`px-6 py-4 text-center ${i > 0 ? 'border-t border-surface-3 sm:border-l sm:border-t-0' : ''}`}
										>
											<p className="font-ps2p text-base text-gold-base">
												{stat.value}
											</p>
											<p className="mt-1.5 text-[10px] uppercase tracking-widest text-text-muted">
												{stat.label}
											</p>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* ── Filter tabs ───────────────────────────────────────────── */}
					<div className="mx-auto mt-12 flex w-full max-w-md flex-wrap justify-center gap-1 rounded-sm border border-surface-3 bg-surface-1 p-1 sm:mt-14 sm:w-fit sm:max-w-none">
						{categories.map(category => (
							<button
								key={category}
								type="button"
								onClick={() => setActiveCategory(category)}
								className={`min-w-[96px] flex-1 rounded-sm border px-4 py-2.5 font-ps2p text-[8px] uppercase tracking-[0.18em] transition-all sm:min-w-0 sm:flex-none sm:px-6 sm:text-[9px] sm:tracking-wider ${
									activeCategory === category
										? 'border-gold-base/30 bg-gold-base/15 text-gold-base'
										: 'border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-text-primary'
								}`}
							>
								{category}
							</button>
						))}
					</div>

					{/* ── Game cards ────────────────────────────────────────────── */}
					<section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{isLoadingGames
							? Array.from({ length: 4 }).map((_, index) => (
									<GameCardSkeleton key={index} />
								))
							: filteredGames.map(game => (
									<GameCard key={game.id} {...game} />
								))}
					</section>

					<Footer />
				</main>
			</div>
		</div>
	);
}
