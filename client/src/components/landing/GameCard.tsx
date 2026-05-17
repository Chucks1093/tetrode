import { Bot, MoveRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Game } from '../../services/game.service';

export type GameCardProps = Game;

export default function GameCard(props: GameCardProps) {
	const isComingSoon = props.status === 'COMING_SOON';

	return (
		<article
			className={`relative overflow-hidden rounded-3xl border p-2 shadow-sm transition-all ${
				isComingSoon
					? 'border-odin-dark-500 bg-odin-dark-300/80 cursor-not-allowed select-none'
					: 'border-odin-dark-500 bg-odin-dark-300 hover:shadow-md'
			}`}
		>
			<div
				className={`relative h-[12rem] overflow-hidden rounded-3xl sm:h-[14rem] ${
					isComingSoon ? 'grayscale' : ''
				}`}
			>
				<img
					src={props.imageUrl}
					alt={props.title}
					className="w-full h-full object-cover brightness-90"
				/>
				<span
					className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${
						isComingSoon
							? 'border-odin-dark-500 bg-black/80 text-odin-dark-1000-a-65'
							: 'border-orange-500/30 bg-black/85 text-orange-400'
					}`}
				>
					<span
						className={`size-2 rounded-full ${
							isComingSoon
								? 'bg-odin-dark-1000-a-65'
								: 'animate-pulse bg-orange-400'
						}`}
					/>
					{isComingSoon ? 'Coming Soon' : 'Live'}
				</span>
			</div>

			<div className="relative p-4">
				<h3
					className={`mb-3 overflow-hidden line-clamp-2 text-xl font-manrope font-semibold ${
						isComingSoon
							? 'text-odin-dark-1000-a-65'
							: 'text-odin-dark-1000'
					}`}
				>
					{props.title}
				</h3>

				<p
					className={`line-clamp-2 text-sm text-odin-dark-1000-a-65 ${
						isComingSoon ? 'opacity-75' : ''
					}`}
				>
					{props.description}
				</p>

				<div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-odin-dark-500 py-2">
					<div className="flex items-center gap-2 py-2">
						<img src="/icons/trophy.svg" className="size-5" alt="coin" />
						<p
							className={`font-manrope text-sm font-bold ${
								isComingSoon
									? 'text-odin-dark-1000-a-50'
									: 'text-odin-dark-1000-a-65'
							}`}
						>
							{props.entryFee} USDC
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
							className={`font-manrope text-sm font-bold ${
								isComingSoon
									? 'text-odin-dark-1000-a-50'
									: 'text-odin-dark-1000-a-65'
							}`}
						>
							{props.maxAgents} Agents
						</p>
					</div>
				</div>

				<Link
					to={`/${props.id}`}
					aria-disabled={isComingSoon}
					className={`mt-3 text-white font-semibold font-jakarta px-4 py-2.5 rounded-lg transition-colors duration-200 outline-none ring-2 ring-offset-2 ring-offset-odin-dark-300 w-full flex items-center gap-2 justify-center ${
						isComingSoon
							? 'bg-odin-dark-600 cursor-not-allowed pointer-events-none text-odin-dark-1000-a-65 ring-odin-dark-500/70'
							: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 cursor-pointer ring-orange-700/40'
					}`}
				>
					{isComingSoon ? 'Coming Soon' : 'Play Now'}{' '}
					{isComingSoon ? null : <MoveRight className="size-5" />}
				</Link>
			</div>
		</article>
	);
}
