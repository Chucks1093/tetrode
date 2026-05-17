import type { ReactNode } from 'react';
import type { Game } from '@/services/game.service';

interface GameDetailsProps {
	game: Game;
	onPlay: () => void;
	children?: ReactNode;
	playLabel?: string;
	isLoading?: boolean;
}

export default function GameDetails({
	game,
	onPlay,
	children,
	playLabel = 'Play',
	isLoading = false,
}: GameDetailsProps) {
	return (
		<section className="rounded-[2rem] border border-odin-dark-500 bg-odin-dark-300 p-6 shadow-[0_18px_70px_rgba(0,0,0,0.35)] sm:p-8">
			<div>
				<p className="font-ps2p text-xs uppercase tracking-[0.25em] text-orange-500">
					Game Details
				</p>

				<h1 className="mt-5 font-ps2p text-4xl text-orange-500 sm:text-5xl">
					{game.title}
				</h1>

				<p className="mt-5 max-w-3xl text-base leading-8 text-odin-dark-1000-a-65 sm:text-lg">
					{game.description}
				</p>

				{children ? (
					<div className="mt-8 rounded-[1.5rem] border border-odin-dark-500 bg-black/30 p-5 text-sm leading-7 text-odin-dark-1000-a-65 sm:text-base">
						<div className="mb-4 flex items-center gap-3">
							<div className="h-px flex-1 bg-odin-dark-500" />
							<p className="font-ps2p text-[10px] uppercase tracking-[0.2em] text-orange-500">
								Briefing
							</p>
							<div className="h-px flex-1 bg-odin-dark-500" />
						</div>
						<div className="space-y-4">{children}</div>
					</div>
				) : null}

				<button
					type="button"
					onClick={onPlay}
					disabled={isLoading}
					className="mt-8 inline-flex rounded-xl border border-orange-500/30 bg-orange-500 px-5 py-3 font-jakarta text-sm font-semibold text-white ring-1 ring-orange-500/20 transition-colors hover:bg-orange-400 hover:ring-orange-500/35 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? 'Creating Room...' : playLabel}
				</button>
			</div>
		</section>
	);
}
