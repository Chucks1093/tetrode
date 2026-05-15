import { useMemo, useState } from 'react';
import GameCard from '../components/landing/GameCard';
import Footer from '../components/shared/Footer';
import Header from '../components/shared/Header';

const games = [
	{
		gameId: 'the-hidden-human',
		title: 'The Hidden Human',
		description:
			'All players appear to be AI agents, but one is secretly human and must survive suspicion.',
		status: 'active' as const,
		imageUrl: '/images/games/game-1.jpeg',
		depositUSDC: 0.63,
		agents: 8,
	},
	{
		gameId: 'hunt-the-ai',
		title: 'Hunt The AI',
		description:
			'Players interrogate, accuse, and vote to expose the hidden AI before time runs out.',
		status: 'coming_soon' as const,
		imageUrl: '/images/games/game-2.jpeg',
		depositUSDC: 0.5,
		agents: 10,
	},
	{
		gameId: 'mind-match',
		title: 'Mind Match',
		description:
			'Humans collaborate with AI using clues to align interpretation and guess hidden words.',
		status: 'coming_soon' as const,
		imageUrl: '/images/games/game-3.jpeg',
		depositUSDC: 0.4,
		agents: 6,
	},
	{
		gameId: 'mindflip',
		title: 'MindFlip',
		description:
			'Secret choices, pattern reading, and bluffing create layered social prediction battles.',
		status: 'coming_soon' as const,
		imageUrl: '/images/games/game-4.jpeg',
		depositUSDC: 0.25,
		agents: 7,
	},
];

const categories = ['All', 'Upcoming', 'Active'] as const;
type Category = (typeof categories)[number];

export default function LandingPage() {
	const [activeCategory, setActiveCategory] = useState<Category>('All');

	const filteredGames = useMemo(
		() =>
			games.filter(game => {
				if (activeCategory === 'All') return true;
				if (activeCategory === 'Upcoming')
					return game.status === 'coming_soon';
				return game.status === 'active';
			}),
		[activeCategory]
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
						<h2 className="mt-3 text-2xl [word-spacing:-0.4em]  md:text-4xl leading-relaxed font-ps2p uppercase text-gray-200">
							Prove You Can Outsmart AI
						</h2>
						<p className="mt-5 max-w-3xl text-base md:text-lg leading-8 text-odin-dark-1000-a-65">
							Enter the world where humans face AI in live mind games,
							and prove whether natural intelligence can overcome
							artificial intelligence.
						</p>
					</div>

					<div className="mt-14 mx-auto flex w-fit flex-wrap gap-3 rounded-xl border border-odin-dark-500 bg-odin-dark-300 p-1.5">
						{categories.map(category => (
							<button
								key={category}
								type="button"
								onClick={() => setActiveCategory(category)}
								className={`px-6 py-2 rounded-lg text-sm border transition-all font-inter ${
									activeCategory === category
										? 'bg-odin-dark-600 text-odin-dark-1000 border-odin-dark-500'
										: 'bg-odin-dark-300 text-odin-dark-1000-a-65 border-odin-dark-500 hover:bg-odin-dark-400'
								}`}
							>
								{category}
							</button>
						))}
					</div>

					<section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{filteredGames.map(game => (
							<GameCard key={game.title} {...game} />
						))}
					</section>

					<Footer />
				</main>
			</div>
		</div>
	);
}
