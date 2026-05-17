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

/* ------------------------------------------------------------------ */
/* Types (exported for consumers)                                       */
/* ------------------------------------------------------------------ */

export interface ChatPlayer {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
}

interface ChatInputProps {
	currentUser?: { name: string; initials: string; avatarUrl?: string };
	/** Players eligible to be flagged or mentioned */
	players?: ChatPlayer[];
	onSend?: (message: string) => void;
	/** Called when the user selects a player from the suspicion popover */
	onRaiseSuspicion?: (player: ChatPlayer) => void;
	placeholder?: string;
	disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

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

	/* Select a player to flag — does NOT insert text, fires callback */
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
			{/* ── Input bar ─────────────────────────────────────────── */}
			<div
				className={cn(
					'flex w-full items-center gap-1.5 rounded-4xl border border-odin-dark-500 bg-odin-dark-300 px-2 py-1.5',
					'transition-all duration-150',
					'focus-within:border-orange-700/60 focus-within:shadow-[0_0_0_1px_rgba(194,65,12,0.2)]',
					disabled && 'cursor-not-allowed opacity-50'
				)}
			>
				{/* Current-user avatar */}
				<Avatar className="h-8 w-8 shrink-0">
					{currentUser.avatarUrl && (
						<AvatarImage
							src={currentUser.avatarUrl}
							alt={currentUser.name}
						/>
					)}
					<AvatarFallback className="bg-orange-700 text-[10px] font-bold text-white">
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
						'text-odin-dark-1000 placeholder:text-odin-dark-1000-a-65',
						'focus-visible:ring-0 focus-visible:ring-offset-0'
					)}
				/>

				{/* ── Raise Suspicion ── */}
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
									? 'bg-orange-700/20 text-orange-500'
									: 'text-odin-dark-1000-a-65 hover:bg-orange-700/10 hover:text-orange-500'
							)}
						>
							<Flag className="h-4 w-4" />
						</Button>
					</PopoverTrigger>

					<PopoverContent
						side="top"
						align="end"
						className="w-52 rounded-2xl border-odin-dark-500 bg-odin-dark-300 p-1 shadow-xl"
					>
						{/* Popover header */}
						<div className="flex items-center gap-2 px-3 py-2">
							<Flag
								className="h-3 w-3 shrink-0 text-orange-500"
								strokeWidth={2.5}
							/>
							<p className="font-ps2p text-[9px] uppercase tracking-widest text-orange-500">
								Raise Suspicion
							</p>
						</div>
						<div className="mx-2 mb-1 h-px bg-odin-dark-500" />

						<Command className="bg-transparent">
							<CommandList>
								<CommandEmpty className="py-4 text-center text-sm text-odin-dark-1000-a-65">
									No players available
								</CommandEmpty>
								<CommandGroup>
									{players.map(player => (
										<CommandItem
											key={player.id}
											value={player.name}
											onSelect={() => handleSelectPlayer(player)}
											className="cursor-pointer gap-2.5 rounded-xl py-2 text-odin-dark-1000 aria-selected:bg-odin-dark-500"
										>
											<Avatar className="h-6 w-6 shrink-0">
												{player.avatarUrl && (
													<AvatarImage
														src={player.avatarUrl}
														alt={player.name}
													/>
												)}
												<AvatarFallback className="bg-odin-dark-600 text-[9px] font-bold text-odin-dark-1000">
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
						'h-8 w-8 shrink-0 rounded-full bg-orange-700',
						'hover:bg-orange-600',
						'disabled:cursor-not-allowed disabled:opacity-30'
					)}
				>
					<Send className="h-3 w-3 text-white" />
				</Button>
			</div>

			{/* Hint */}
			<p className="text-center text-[12px] text-odin-dark-1000-a-65">
				Tetrode is a psychological game. Agents will lie, study, and vote
				against you.
			</p>
		</div>
	);
}
