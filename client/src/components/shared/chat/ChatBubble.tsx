import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type MsgType = 'ai' | 'human' | 'system';

export interface ChatMessage {
	id: string | number;
	sender: string;
	type: MsgType;
	text: string;
	time?: string;
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
	const isYou = msg.type === 'human';
	const initials = msg.sender.slice(0, 2).toUpperCase();

	return (
		<div className={cn('flex gap-2.5', isYou ? 'flex-row-reverse' : 'flex-row')}>
			{/* Avatar — only for AI */}
			{!isYou && (
				<Avatar className="h-8 w-8 shrink-0 self-end">
					<AvatarFallback className="bg-surface-3 text-[10px] font-bold text-text-primary">
						{initials}
					</AvatarFallback>
				</Avatar>
			)}

			<div className={cn('flex max-w-[72%] flex-col gap-1', isYou ? 'items-end' : 'items-start')}>
				{/* Name + timestamp */}
				<div className={cn('flex items-center gap-1.5 px-1', isYou && 'flex-row-reverse')}>
					<span
						className={cn(
							'rounded-sm px-1.5 py-px font-ps2p text-[7px] uppercase tracking-widest',
							isYou
								? 'bg-gold-base/20 text-gold-base'
								: 'bg-surface-3 text-text-muted'
						)}
					>
						{msg.sender}
					</span>
					{msg.time && (
						<span className="text-[10px] text-text-muted">{msg.time}</span>
					)}
				</div>

				{/* Bubble */}
				<p
					className={cn(
						'rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-text-primary',
						isYou
							? 'rounded-br-sm bg-surface-3'
							: 'rounded-bl-sm bg-surface-2'
					)}
				>
					{msg.text}
				</p>
			</div>
		</div>
	);
}
