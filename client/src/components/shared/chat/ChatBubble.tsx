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
		<div
			className={cn('flex gap-2.5', isYou ? 'flex-row-reverse' : 'flex-row')}
		>
			{/* Avatar — only shown for AI messages */}
			{!isYou && (
				<Avatar className="h-8 w-8 shrink-0 self-end">
					<AvatarFallback className="bg-odin-dark-600 text-[10px] font-bold text-white">
						{initials}
					</AvatarFallback>
				</Avatar>
			)}

			{/* Content */}
			<div
				className={cn(
					'flex max-w-[72%] flex-col gap-1',
					isYou ? 'items-end' : 'items-start'
				)}
			>
				{/* Sender row: name · badge · timestamp all inline */}
				<div
					className={cn(
						'flex items-center gap-1.5 px-1',
						isYou && 'flex-row-reverse'
					)}
				>
					<span
						className={cn(
							'rounded-sm px-1.5 py-px font-ps2p text-[7px] uppercase tracking-widest ',
							isYou
								? 'bg-orange-500/20 text-orange-400'
								: 'bg-odin-dark-600 text-odin-dark-1000-a-65'
						)}
					>
						{msg.sender}
					</span>

					{msg.time && (
						<span className="text-[10px] text-odin-dark-1000-a-65">
							{msg.time}
						</span>
					)}
				</div>

				{/* Bubble */}
				<p
					className={cn(
						'rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-odin-dark-400 text-odin-dark-1000',
						isYou ? 'rounded-br-sm' : 'rounded-bl-sm '
					)}
				>
					{msg.text}
				</p>
			</div>
		</div>
	);
}
