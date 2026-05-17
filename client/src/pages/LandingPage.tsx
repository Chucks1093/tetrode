import { useEffect, useMemo, useState } from 'react';
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
	const [gamesError, setGamesError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function loadGames() {
			try {
				setIsLoadingGames(true);
				const nextGames = await gameService.fetchGames();
				if (!isMounted) return;
				setGames(nextGames);
				setGamesError(null);
			} catch (error) {
				if (!isMounted) return;
				setGames([]);
				setGamesError(
					error instanceof Error ? error.message : 'Failed to load games.'
				);
			} finally {
				if (isMounted) {
					setIsLoadingGames(false);
				}
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
			<div className="relative z-40 mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-26 sm:px-6 sm:pb-14 sm:pt-30">
				<main>
					<div className="mt-4 flex flex-col items-center text-center">
						<h2 className="text-3xl font-binary_soldiers text-orange-500">
							SAGP
						</h2>
						<h2 className="mt-3 text-2xl [word-spacing:-0.4em] md:text-4xl leading-relaxed font-ps2p uppercase text-odin-light-500">
							Prove You Can Outsmart AI
						</h2>
						<p className="mt-5 max-w-3xl text-base leading-8 text-odin-dark-1000-a-65 md:text-lg">
							Enter the world where humans face AI in live mind games,
							and prove whether natural intelligence can overcome
							artificial intelligence.
						</p>
					</div>

					<div className="mx-auto mt-14 flex w-fit flex-wrap gap-3 rounded-xl border border-odin-dark-500 bg-odin-dark-300 p-1.5">
						{categories.map(category => (
							<button
								key={category}
								type="button"
								onClick={() => setActiveCategory(category)}
								className={`rounded-lg border px-6 py-2 text-sm transition-all font-inter ${
									activeCategory === category
										? 'border-orange-500/30 bg-orange-500/15 text-orange-400'
										: 'border-odin-dark-500 bg-odin-dark-300 text-odin-dark-1000-a-65 hover:bg-odin-dark-400'
								}`}
							>
								{category}
							</button>
						))}
					</div>

					<section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{isLoadingGames
							? Array.from({ length: 4 }).map((_, index) => (
									<GameCardSkeleton key={index} />
								))
							: filteredGames.map(game => (
									<GameCard key={game.id} {...game} />
								))}
					</section>

					{!isLoadingGames && gamesError ? (
						<p className="mt-5 text-sm text-red-400">{gamesError}</p>
					) : null}

					<Footer />
				</main>
			</div>
		</div>
	);
}
