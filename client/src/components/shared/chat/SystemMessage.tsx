import { cn } from '@/lib/utils';

export type SystemEventType = 'default' | 'phase' | 'accusation' | 'vote';

interface SystemMessageProps {
	text: string;
	eventType?: SystemEventType;
}

export function SystemMessage({ text, eventType = 'default' }: SystemMessageProps) {
	if (eventType === 'phase') {
		return (
			<div className="flex w-full items-center gap-3 py-1">
				<div className="h-px flex-1 bg-odin-dark-500" />
				<span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-1.5 font-ps2p text-[9px] uppercase tracking-[0.2em] text-orange-400">
					{text}
				</span>
				<div className="h-px flex-1 bg-odin-dark-500" />
			</div>
		);
	}

	if (eventType === 'accusation') {
		return (
			<div className="flex justify-center py-0.5">
				<span
					className={cn(
						'flex items-center gap-1.5 rounded-full px-4 py-1',
						'border border-red-500/25 bg-red-500/10 text-[11px] text-red-400'
					)}
				>
					<span className="text-red-500">!</span>
					{text}
				</span>
			</div>
		);
	}

	if (eventType === 'vote') {
		return (
			<div className="flex justify-center py-0.5">
				<span className="rounded-full border border-odin-dark-500 bg-odin-dark-300 px-4 py-1 text-[11px] text-odin-dark-1000-a-65">
					{text}
				</span>
			</div>
		);
	}

	/* default — subtle centered pill */
	return (
		<div className="flex justify-center py-0.5">
			<span className="rounded-full border border-odin-dark-500 bg-odin-dark-300 px-4 py-1 text-[11px] text-odin-dark-1000-a-65">
				{text}
			</span>
		</div>
	);
}
