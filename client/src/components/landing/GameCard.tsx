import { Bot, MoveRight } from 'lucide-react';
import { Link } from 'react-router';

type GameStatus = 'active' | 'coming_soon';

export interface GameCardProps {
	gameId: string;
	title: string;
	description: string;
	status: GameStatus;
	imageUrl: string;
	depositUSDC: number;
	agents: number;
}

export default function GameCard(props: GameCardProps) {
	const isComingSoon = props.status === 'coming_soon';

	return (
		<article
			className={`rounded-3xl border p-2 overflow-hidden shadow-sm transition-all relative ${
				isComingSoon
					? 'border-odin-dark-500 bg-odin-dark-300/70'
					: 'border-odin-dark-500 bg-odin-dark-300 hover:bg-odin-dark-400/80 hover:shadow-md'
			}`}
		>
			<div
				className={`h-[12rem] sm:h-[14rem] relative overflow-hidden rounded-3xl ${
					isComingSoon ? 'grayscale' : ''
				}`}
			>
				<img
					src={props.imageUrl}
					alt={props.title}
					className="w-full h-full object-cover brightness-90"
				/>
				<span
					className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border backdrop-blur-sm ${
						isComingSoon
							? 'bg-odin-dark-200/90 text-odin-dark-1000-a-65 border-odin-dark-500'
							: 'bg-odin-dark-200/95 text-orange-400 border-odin-dark-500'
					}`}
				>
					<span
						className={`size-2 rounded-full ${
							isComingSoon
								? 'bg-odin-dark-700'
								: 'bg-orange-500 animate-pulse'
						}`}
					/>
					{isComingSoon ? 'Coming Soon' : 'Live'}
				</span>
			</div>

			<div className="p-4">
				<h3
					className={`text-xl font-bold font-manrope mb-2 line-clamp-2 ${
						isComingSoon
							? 'text-odin-dark-1000-a-65'
							: 'text-odin-dark-1000'
					}`}
				>
					{props.title}
				</h3>

				<p
					className={`text-sm line-clamp-2 ${
						isComingSoon
							? 'text-odin-dark-1000-a-50'
							: 'text-odin-dark-1000-a-65'
					}`}
				>
					{props.description}
				</p>

				<div className="border-t-2 mt-4 py-2 border-odin-dark-500 border-dashed flex items-center justify-between">
					<div className="flex items-center gap-2 py-2">
						<img src="/icons/trophy.svg" className="size-5" alt="coin" />
						<p
							className={`font-manrope font-semibold text-sm ${
								isComingSoon
									? 'text-odin-dark-1000-a-50'
									: 'text-odin-dark-1000-a-65'
							}`}
						>
							{props.depositUSDC} USDC
						</p>
					</div>
					<div className="flex items-center gap-1 py-2">
						<Bot
							className={`size-5 ${
								isComingSoon
									? 'text-odin-dark-1000-a-50'
									: 'text-odin-dark-1000-a-65'
							}`}
						/>
						<p
							className={`font-manrope font-semibold text-sm ${
								isComingSoon
									? 'text-odin-dark-1000-a-50'
									: 'text-odin-dark-1000-a-65'
							}`}
						>
							{props.agents} Agents
						</p>
					</div>
				</div>

				<Link
					to={`/${props.gameId}`}
					aria-disabled={isComingSoon}
					className={`mt-3 text-white font-semibold font-jakarta px-4 py-2.5 rounded-lg transition-colors duration-200 outline-none ring-2 ring-offset-2 ring-offset-odin-dark-300 w-full flex items-center gap-2 justify-center ${
						isComingSoon
							? 'bg-odin-dark-600 cursor-not-allowed pointer-events-none text-odin-dark-1000-a-65 ring-odin-dark-500/70'
							: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 cursor-pointer ring-orange-700/40'
					}`}
				>
					{isComingSoon ? 'Coming Soon' : 'Play Now'}{' '}
					<MoveRight className="size-4" />
				</Link>
			</div>
		</article>
	);
}
