import { useState } from 'react';
import { Flag, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface ChatPlayer {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
}

interface ChatInputProps {
	currentUser?: { name: string; initials: string; avatarUrl?: string };
	players?: ChatPlayer[];
	onSend?: (message: string) => void;
	onRaiseSuspicion?: (player: ChatPlayer) => void;
	placeholder?: string;
	disabled?: boolean;
}

export function ChatInput({
	currentUser = { name: 'You', initials: 'YO' },
	players = [],
	onSend,
	onRaiseSuspicion,
	placeholder = 'Say something… blend in.',
	disabled = false,
}: ChatInputProps) {
	const [value, setValue] = useState('');
	const [suspicionOpen, setSuspicionOpen] = useState(false);

	const canSend = value.trim().length > 0 && !disabled;

	const handleSelectPlayer = (player: ChatPlayer) => {
		onRaiseSuspicion?.(player);
		setSuspicionOpen(false);
	};

	const handleSend = () => {
		if (!canSend) return;
		onSend?.(value.trim());
		setValue('');
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex w-full flex-col items-center gap-2">
			{/* Input bar */}
			<div
				className={cn(
					'flex w-full items-center gap-1.5 rounded-4xl border border-surface-3 bg-surface-1 px-2 py-1.5',
					'transition-all duration-150',
					'focus-within:border-gold-base/50 focus-within:shadow-[0_0_0_1px_rgba(212,160,23,0.15)]',
					disabled && 'cursor-not-allowed opacity-50'
				)}
			>
				{/* Current-user avatar */}
				<Avatar className="h-8 w-8 shrink-0">
					{currentUser.avatarUrl && (
						<AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
					)}
					<AvatarFallback className="bg-gold-base text-[10px] font-bold text-surface-0">
						{currentUser.initials}
					</AvatarFallback>
				</Avatar>

				{/* Text field */}
				<Input
					value={value}
					onChange={e => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						'h-9 flex-1 border-none bg-transparent dark:bg-transparent px-2 text-[14px]',
						'text-text-primary placeholder:text-text-muted',
						'focus-visible:ring-0 focus-visible:ring-offset-0'
					)}
				/>

				{/* Raise Suspicion */}
				<Popover open={suspicionOpen} onOpenChange={setSuspicionOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Raise suspicion on a player"
							disabled={disabled}
							className={cn(
								'h-8 w-8 shrink-0 rounded-xl transition-colors',
								suspicionOpen
									? 'bg-terracotta/20 text-terracotta-bright'
									: 'text-text-muted hover:bg-terracotta/10 hover:text-terracotta-bright'
							)}
						>
							<Flag className="h-4 w-4" />
						</Button>
					</PopoverTrigger>

					<PopoverContent
						side="top"
						align="end"
						className="w-52 rounded-xl border-surface-3 bg-surface-1 p-1 shadow-xl"
					>
						<div className="flex items-center gap-2 px-3 py-2">
							<Flag className="h-3 w-3 shrink-0 text-terracotta-bright" strokeWidth={2.5} />
							<p className="font-ps2p text-[9px] uppercase tracking-widest text-terracotta-bright">
								Raise Suspicion
							</p>
						</div>
						<div className="mx-2 mb-1 h-px bg-surface-3" />

						<Command className="bg-transparent">
							<CommandList>
								<CommandEmpty className="py-4 text-center text-sm text-text-muted">
									No players available
								</CommandEmpty>
								<CommandGroup>
									{players.map(player => (
										<CommandItem
											key={player.id}
											value={player.name}
											onSelect={() => handleSelectPlayer(player)}
											className="cursor-pointer gap-2.5 rounded-lg py-2 text-text-primary aria-selected:bg-surface-3"
										>
											<Avatar className="h-6 w-6 shrink-0">
												{player.avatarUrl && (
													<AvatarImage src={player.avatarUrl} alt={player.name} />
												)}
												<AvatarFallback className="bg-surface-3 text-[9px] font-bold text-text-primary">
													{player.initials}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm">{player.name}</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Send */}
				<Button
					size="icon"
					aria-label="Send message"
					disabled={!canSend}
					onClick={handleSend}
					className={cn(
						'h-8 w-8 shrink-0 rounded-full bg-gold-base',
						'hover:bg-gold-bright',
						'disabled:cursor-not-allowed disabled:opacity-30'
					)}
				>
					<Send className="h-3 w-3 text-surface-0" />
				</Button>
			</div>

			{/* Hint */}
			<p className="text-center text-[12px] text-text-muted">
				Tetrode is a psychological game. Agents will lie, study, and vote against you.
			</p>
		</div>
	);
}
