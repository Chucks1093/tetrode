import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const MAX_SHOWN = 3;

function initials(name: string) {
	return name.slice(0, 2).toUpperCase();
}

export function TypingRow({ agents }: { agents: string[] }) {
	if (agents.length === 0) return null;

	const shown = agents.slice(0, MAX_SHOWN);
	const overflow = agents.length - MAX_SHOWN;

	return (
		<>
			<style>{`
				@keyframes tetrWave {
					0%, 60%, 100% { transform: translateY(0px); }
					30% { transform: translateY(-4px); }
				}
				.tetr-dot {
					animation: tetrWave 0.8s infinite ease-in-out;
					border-radius: 50%;
					display: inline-block;
				}
				.tetr-dot:nth-child(1) { animation-delay: 0s; }
				.tetr-dot:nth-child(2) { animation-delay: 0.1s; }
				.tetr-dot:nth-child(3) { animation-delay: 0.2s; }
			`}</style>

			<div className="flex items-center gap-2.5 px-1 pb-2">
				{/* Stacked overlapping avatars */}
				<div className="flex items-center">
					{shown.map((name, i) => (
						<Avatar
							key={name}
							className={cn(
								'h-8 w-8 shrink-0 ring-2 ring-surface-1',
								i > 0 && '-ml-2.5'
							)}
						>
							<AvatarFallback className="bg-surface-3 text-[10px] font-bold text-text-primary">
								{initials(name)}
							</AvatarFallback>
						</Avatar>
					))}
					{overflow > 0 && (
						<Avatar className="-ml-2.5 h-8 w-8 shrink-0 ring-2 ring-surface-1">
							<AvatarFallback className="bg-surface-2 text-[9px] font-bold text-text-muted">
								+{overflow}
							</AvatarFallback>
						</Avatar>
					)}
				</div>

				{/* Single shared dots bubble */}
				<div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-3">
					<span className="tetr-dot h-1.5 w-1.5 bg-text-muted" />
					<span className="tetr-dot h-1.5 w-1.5 bg-text-muted" />
					<span className="tetr-dot h-1.5 w-1.5 bg-text-muted" />
				</div>
			</div>
		</>
	);
}
