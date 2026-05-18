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
				<div className="h-px flex-1 bg-surface-3" />
				<span className="rounded-full border border-gold-base/25 bg-gold-base/10 px-4 py-1.5 font-ps2p text-[9px] uppercase tracking-[0.2em] text-gold-base">
					{text}
				</span>
				<div className="h-px flex-1 bg-surface-3" />
			</div>
		);
	}

	if (eventType === 'accusation') {
		return (
			<div className="flex justify-center py-0.5">
				<span
					className={cn(
						'flex items-center gap-1.5 rounded-full px-4 py-1',
						'border border-terracotta/25 bg-terracotta/10 text-[11px] text-terracotta-bright'
					)}
				>
					<span className="text-terracotta-bright">!</span>
					{text}
				</span>
			</div>
		);
	}

	/* vote + default */
	return (
		<div className="flex justify-center py-0.5">
			<span className="rounded-full border border-surface-3 bg-surface-1 px-4 py-1 text-[11px] text-text-muted">
				{text}
			</span>
		</div>
	);
}
