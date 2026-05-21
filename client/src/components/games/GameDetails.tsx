import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Game } from '@/services/game.service';

interface GameDetailsProps {
	game: Game;
	onPlay: () => void;
	children?: ReactNode;
	playLabel?: string;
	isLoading?: boolean;
}

const tabs = ['Overview', 'Rules'] as const;
type Tab = (typeof tabs)[number];

export default function GameDetails({
	game,
	onPlay,
	children,
	playLabel = 'Play',
	isLoading = false,
}: GameDetailsProps) {
	const [activeTab, setActiveTab] = useState<Tab>('Overview');
	const isActive = game.status === 'ACTIVE';

	return (
		<section className="grid grid-cols-1 gap-6 lg:grid-cols-[5fr_7fr]">
			{/* ── Left: image ─────────────────────────────────────────── */}
			<div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-surface-3 lg:min-h-[560px]">
				<img
					src={game.imageUrl}
					alt={game.title}
					className={`h-full w-full object-cover ${!isActive ? 'grayscale opacity-50' : 'brightness-90'}`}
				/>
				<div className="noise absolute inset-0" />

				{/* Status pill over image */}
				<div className="absolute left-4 top-4">
					<span
						className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-ps2p text-[7px] uppercase tracking-widest backdrop-blur-sm ${
							isActive
								? 'border-gold-base/30 bg-surface-0/80 text-gold-base'
								: 'border-surface-3 bg-surface-0/80 text-text-muted'
						}`}
					>
						<span
							className={`size-1.5 rounded-full ${isActive ? 'animate-pulse bg-gold-base' : 'bg-text-muted'}`}
						/>
						{isActive ? 'Live Now' : 'Coming Soon'}
					</span>
				</div>
			</div>

			{/* ── Right: info ─────────────────────────────────────────── */}
			<div className="flex flex-col gap-5">
				{/* Tags */}
				<div className="flex flex-wrap gap-2">
					{['Mind Game', 'Social Deduction', 'Season 01'].map(tag => (
						<span
							key={tag}
							className="rounded-sm border border-surface-3 bg-surface-1 px-3 py-1 font-ps2p text-[7px] uppercase tracking-widest text-text-muted"
						>
							{tag}
						</span>
					))}
				</div>

				{/* Title */}
				<h1 className="font-ps2p text-2xl uppercase leading-snug text-text-primary sm:text-3xl">
					{game.title}
				</h1>

				{/* Description */}
				<p className="text-sm leading-7 text-text-muted sm:text-base sm:leading-8">
					{game.description}
				</p>

				{/* Stats grid */}
				<div className="grid grid-cols-2 overflow-hidden rounded-sm border border-surface-3 sm:grid-cols-4">
					{[
						{
							label: 'Entry Fee',
							value: `${game.entryFee}`,
							unit: 'USDC',
						},
						{
							label: 'Max Players',
							value: String(game.maxPlayers),
							unit: '',
						},
						{
							label: 'AI Agents',
							value: String(game.maxAgents),
							unit: '',
						},
						{
							label: 'Active Rooms',
							value: String(game.maxActiveRooms),
							unit: '',
						},
					].map((stat, i) => (
						<div
							key={stat.label}
							className={`p-4 text-center ${i > 0 ? 'border-l border-surface-3' : ''} ${i >= 2 ? 'border-t border-surface-3 sm:border-t-0' : ''}`}
						>
							<p className="text-[9px] uppercase tracking-widest text-text-muted">
								{stat.label}
							</p>
							<p className="mt-2 font-ps2p text-base text-gold-base">
								{stat.value}
								{stat.unit && (
									<span className="ml-1 text-[8px] text-text-muted">
										{stat.unit}
									</span>
								)}
							</p>
						</div>
					))}
				</div>

				{/* CTA */}
				<button
					type="button"
					onClick={onPlay}
					disabled={isLoading || !isActive}
					className={`w-full rounded-sm py-4 font-ps2p text-[10px] uppercase tracking-wider transition-all ring-2 ring-offset-2 ring-offset-odin-dark-300 disabled:cursor-not-allowed disabled:opacity-60 ${
						isActive
							? 'bg-gold-base text-surface-0 hover:bg-gold-bright ring-gold-dim/40'
							: 'cursor-not-allowed bg-surface-3 text-text-muted ring-surface-3/70'
					}`}
				>
					{isLoading ? 'Creating Room...' : playLabel}
				</button>

				{/* Divider */}
				<div className="border-t border-surface-3" />

				{/* Tabs */}
				<div className="flex gap-1 w-fit rounded-sm border border-surface-3 bg-surface-1 p-1">
					{tabs.map(tab => (
						<button
							key={tab}
							type="button"
							onClick={() => setActiveTab(tab)}
							className={`rounded-sm px-5 py-2 font-ps2p text-[9px] uppercase tracking-wider transition-all border ${
								activeTab === tab
									? 'border-gold-base/30 bg-gold-base/15 text-gold-base'
									: 'border-transparent text-text-muted hover:text-text-primary'
							}`}
						>
							{tab}
						</button>
					))}
				</div>

				{/* Tab content */}
				<div className="space-y-3 text-sm leading-7 text-text-muted sm:text-base sm:leading-8">
					{activeTab === 'Overview' && (
						<div className="space-y-4">{children}</div>
					)}
					{activeTab === 'Rules' && (
						<div className="rounded-sm border border-surface-3 bg-surface-1 p-5">
							<p className="text-text-muted">Game rules coming soon.</p>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
