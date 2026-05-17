import { Bot, MoveRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Game } from '../../services/game.service';

export type GameCardProps = Game;

export default function GameCard(props: GameCardProps) {
	const isComingSoon = props.status === 'COMING_SOON';

	return (
		<article
			className={`relative overflow-hidden rounded-2xl border p-2 transition-all ${
				isComingSoon
					? 'cursor-not-allowed select-none border-odin-dark-500 bg-odin-dark-300/80'
					: 'border-odin-dark-500 bg-odin-dark-300 hover:border-odin-dark-600'
			}`}
		>
			{/* Image */}
			<div
				className={`relative h-[12rem] overflow-hidden rounded-xl sm:h-[14rem] ${
					isComingSoon ? 'grayscale opacity-60' : ''
				}`}
			>
				<img
					src={props.imageUrl}
					alt={props.title}
					className="h-full w-full object-cover brightness-90 pointer-events-none"
				/>

				{/* Status badge */}
				<span
					className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${
						isComingSoon
							? 'border-surface-3 bg-surface-0/80 text-text-muted'
							: 'border-gold-base/30 bg-surface-0/85 text-gold-base'
					}`}
				>
					<span
						className={`size-1.5 rounded-full ${
							isComingSoon
								? 'bg-text-muted'
								: 'animate-pulse bg-gold-base'
						}`}
					/>
					{isComingSoon ? 'Coming Soon' : 'Live'}
				</span>
			</div>

			{/* Body */}
			<div className="relative p-4">
				<h3
					className={`mb-3 line-clamp-2 text-xl font-manrope font-semibold ${
						isComingSoon ? 'text-text-muted' : 'text-text-primary'
					}`}
				>
					{props.title}
				</h3>

				<p
					className={`line-clamp-2 text-sm text-text-muted ${
						isComingSoon ? 'opacity-60' : ''
					}`}
				>
					{props.description}
				</p>

				{/* Meta row */}
				<div className="mt-4 flex items-center justify-between border-t border-dashed border-odin-dark-1000-a-20 py-2">
					<div className="flex items-center gap-2 py-2">
						<img
							src="/icons/trophy.svg"
							className="size-5"
							alt="trophy"
						/>
						<p
							className={`font-manrope text-sm font-bold ${
								isComingSoon
									? 'text-text-muted/50'
									: 'text-text-secondary'
							}`}
						>
							{props.entryFee} USDC
						</p>
					</div>
					<div className="flex items-center gap-1 py-2">
						<Bot
							className={`size-5 ${
								isComingSoon
									? 'text-text-muted/50'
									: 'text-text-secondary'
							}`}
						/>
						<p
							className={`font-manrope text-sm font-bold ${
								isComingSoon
									? 'text-text-muted/50'
									: 'text-text-secondary'
							}`}
						>
							{props.maxAgents} Agents
						</p>
					</div>
				</div>

				{/* CTA */}
				<Link
					to={`/${props.id}`}
					aria-disabled={isComingSoon}
					className={`mt-3 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 font-ps2p text-[9px] uppercase tracking-wider transition-all ring-2 ring-offset-2 ring-offset-odin-dark-300 ${
						isComingSoon
							? 'cursor-not-allowed pointer-events-none bg-odin-dark-600 text-text-muted ring-odin-dark-500/70'
							: 'bg-gold-base text-surface-0 hover:bg-gold-bright ring-gold-dim/40'
					}`}
				>
					{isComingSoon ? 'Coming Soon' : 'Play Now'}
					{!isComingSoon && <MoveRight className="size-4" />}
				</Link>
			</div>
		</article>
	);
}
