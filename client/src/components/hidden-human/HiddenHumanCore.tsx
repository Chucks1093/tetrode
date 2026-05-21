'use client';

import makeBlockie from 'ethereum-blockies-base64';
import { Check, ChevronDown, Copy, DoorOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChatFeed, ChatInput } from '@/components/shared/chat';
import type { FeedMessage, ChatPlayer } from '@/components/shared/chat';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { chatService, type RoomChatMessage } from '@/services/chat.service';
import { socketService } from '@/services/socket.service';
import { playerService } from '@/services/player.service';
import { roomService, type Room } from '@/services/room.service';
import { useAuthStore } from '@/stores/useAuthStore';

const GAME_DURATION_S = 300;

function nowStamp() {
	const d = new Date();
	return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function initials(name: string) {
	return name
		.split(' ')
		.map(part => part[0] ?? '')
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

function fmtTimer(s: number) {
	return `${Math.floor(s / 60)
		.toString()
		.padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function toFeedMessage(
	message: RoomChatMessage,
	currentParticipantId: string | null
): FeedMessage {
	if (message.senderType === 'SYSTEM') {
		const lower = message.content.toLowerCase();
		const eventType = lower.includes('game started')
			? ('phase' as const)
			: lower.includes('has voted')
				? ('vote' as const)
				: lower.includes("time's up")
					? ('result' as const)
					: ('default' as const);
		return {
			id: message.id,
			sender: 'SYSTEM',
			type: 'system',
			eventType,
			text: message.content,
		};
	}

	return {
		id: message.id,
		sender: message.senderName,
		type:
			currentParticipantId && message.senderId === currentParticipantId
				? 'human'
				: 'ai',
		text: message.content,
		time: new Date(message.createdAt).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		}),
	};
}

interface HiddenHumanCoreProps {
	room?: Room | null;
	roomError?: string | null;
}

export default function HiddenHumanCore({
	room,
	roomError,
}: HiddenHumanCoreProps) {
	const navigate = useNavigate();
	const playerIdentity = playerService.getIdentity();
	const authUser = useAuthStore(s => s.user);
	const blockieSeed = authUser?.email ?? authUser?.id ?? playerIdentity.actorId;
	const currentParticipant =
		room?.participants?.find(
			participant => participant.actorId === playerIdentity.actorId
		) ?? null;
	const otherParticipants =
		room?.participants?.filter(
			participant => participant.id !== currentParticipant?.id
		) ?? [];

	const [messages, setMessages] = useState<FeedMessage[]>([]);
	const [messagesError, setMessagesError] = useState<string | null>(null);
	const [timer, setTimer] = useState(GAME_DURATION_S);
	const [typingAgents, setTypingAgents] = useState<Map<string, string>>(
		new Map()
	);
	const [isLeavingRoom, setIsLeavingRoom] = useState(false);
	const [copiedRoomId, setCopiedRoomId] = useState(false);
	const [gameEnded, setGameEnded] = useState(false);
	const [gameResult, setGameResult] = useState<string | null>(null);

	// Sync timer with room.createdAt on first load
	useEffect(() => {
		if (!room?.createdAt) return;
		const elapsed = Math.floor((Date.now() - new Date(room.createdAt).getTime()) / 1000);
		setTimer(Math.max(0, GAME_DURATION_S - elapsed));
	}, [room?.createdAt]);

	// Count down every second
	useEffect(() => {
		const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 0)), 1000);
		return () => clearInterval(id);
	}, []);

	// Stop the local timer display when game ends
	useEffect(() => {
		if (gameEnded) setTimer(0);
	}, [gameEnded]);

	// Load message history on mount
	useEffect(() => {
		let isMounted = true;

		async function loadMessages() {
			if (!room?.id) {
				if (isMounted) {
					setMessages([]);
					setMessagesError(null);
				}
				return;
			}

			try {
				const response = await chatService.getMessages(room.id);
				if (!isMounted) return;
				setMessages(
					response.messages.map(m =>
						toFeedMessage(m, currentParticipant?.id ?? null)
					)
				);
				setMessagesError(null);
			} catch (error) {
				if (!isMounted) return;
				setMessagesError(
					error instanceof Error ? error.message : 'Failed to load chat.'
				);
			}
		}

		void loadMessages();
		return () => {
			isMounted = false;
		};
	}, [room?.id, currentParticipant?.id]);

	// Connect socket and listen for incoming messages
	useEffect(() => {
		if (!room?.id) return;

		socketService.connect();
		socketService.joinRoom(room.id);

		socketService.onMessage((incoming: RoomChatMessage) => {
			setMessages(prev => {
				// Drop duplicates — the optimistic message uses a temp id so won't match
				if (prev.some(m => m.id === incoming.id)) return prev;
				return [
					...prev,
					toFeedMessage(incoming, currentParticipant?.id ?? null),
				];
			});
		});

		socketService.onAgentTyping(({ agentId, name }) => {
			setTypingAgents(prev => new Map(prev).set(agentId, name));
		});

		socketService.onAgentStopTyping(({ agentId }) => {
			setTypingAgents(prev => {
				const next = new Map(prev);
				next.delete(agentId);
				return next;
			});
		});

		socketService.onGameEnded(({ resultText }) => {
			setGameEnded(true);
			setGameResult(resultText);
		});

		return () => {
			socketService.offMessage();
			socketService.offAgentTyping();
			socketService.offAgentStopTyping();
			socketService.offGameEnded();
			socketService.leaveRoom(room.id);
		};
	}, [room?.id, currentParticipant?.id]);

	const chatPlayers: ChatPlayer[] = otherParticipants.map(participant => ({
		id: participant.id,
		name: participant.displayName,
		initials: initials(participant.displayName),
	}));

	const handleSend = async (text: string) => {
		if (!room?.id || !currentParticipant?.id) return;

		const optimisticId = `temp-${Date.now()}`;

		// Show the human's own message immediately
		setMessages(prev => [
			...prev,
			{
				id: optimisticId,
				sender: currentParticipant.displayName,
				type: 'human' as const,
				text,
				time: nowStamp(),
			},
		]);

		try {
			const confirmed = await chatService.createMessage(room.id, {
				senderId: currentParticipant.id,
				content: text,
			});

			// Replace optimistic with the confirmed message from server
			// Agent replies will arrive on their own via the socket
			setMessages(prev => [
				...prev.filter(m => m.id !== optimisticId),
				toFeedMessage(confirmed, currentParticipant.id),
			]);

			setMessagesError(null);
		} catch (error) {
			setMessages(prev => prev.filter(m => m.id !== optimisticId));
			setMessagesError(
				error instanceof Error ? error.message : 'Failed to send message.'
			);
		}
	};

	const handleVote = async (player: ChatPlayer) => {
		if (!room?.id || !currentParticipant?.id) return;
		try {
			await roomService.castVote(room.id, currentParticipant.id, player.id);
		} catch (error) {
			setMessagesError(
				error instanceof Error ? error.message : 'Failed to cast vote.'
			);
		}
	};

	const handleCopyRoomId = async () => {
		if (!room?.id) return;
		await navigator.clipboard.writeText(room.id);
		setCopiedRoomId(true);
		setTimeout(() => setCopiedRoomId(false), 2000);
	};

	const handleLeaveRoom = async () => {
		if (!room?.id || !currentParticipant?.id) {
			return;
		}

		try {
			setIsLeavingRoom(true);
			await roomService.leaveRoom(room.id, currentParticipant.id);
			socketService.leaveRoom(room.id);
			navigate(`/games/${room.gameId}`);
		} catch (error) {
			setMessagesError(
				error instanceof Error ? error.message : 'Failed to leave room.'
			);
		} finally {
			setIsLeavingRoom(false);
		}
	};

	return (
		<section className="flex min-h-screen flex-col gap-3 pb-20">
			<header className="fixed inset-x-0 top-0 z-40 border-b border-surface-3 bg-surface-1/90 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
					{/* Left: title + stacked participants */}
					<div className="flex items-center gap-3">
						<p className="font-ps2p text-sm uppercase text-gold-base">
							The Hidden Human
						</p>

						{room?.participants && room.participants.length > 0 && (
							<TooltipProvider>
								<div className="flex items-center">
									{room.participants.slice(0, 3).map((p, i) => (
										<Tooltip key={p.id}>
											<TooltipTrigger asChild>
												<div
													className="relative flex h-7 w-7 cursor-default items-center justify-center rounded-full border-2 border-surface-1 bg-surface-3 text-[9px] font-semibold text-text-primary"
													style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: 3 - i }}
												>
													{initials(p.displayName)}
												</div>
											</TooltipTrigger>
											<TooltipContent className="rounded-md border-surface-3 bg-surface-2 px-2.5 py-1 text-[11px] text-text-primary shadow-lg">
												{p.displayName}
											</TooltipContent>
										</Tooltip>
									))}
									{room.participants.length > 3 && (
										<div
											className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-1 bg-surface-4 text-[9px] text-text-muted"
											style={{ marginLeft: '-8px', zIndex: 0 }}
										>
											+{room.participants.length - 3}
										</div>
									)}
								</div>
							</TooltipProvider>
						)}
					</div>

					<div className="flex items-center gap-3 sm:gap-4">
						{/* Timer */}
						<p
							className={cn(
								'font-ps2p text-sm tabular-nums',
								timer <= 30
									? 'animate-pulse text-terracotta-bright'
									: 'text-gold-base'
							)}
						>
							{fmtTimer(timer)}
						</p>

						{/* Blockie avatar + dropdown */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="flex items-center gap-1.5 rounded-full border border-surface-3 bg-surface-2 py-1 pl-1 pr-2 transition-colors hover:border-surface-4 hover:bg-surface-3"
									aria-label="Open room menu"
								>
									<img
										src={makeBlockie(blockieSeed)}
										alt="avatar"
										className="h-7 w-7 rounded-full"
									/>
									<ChevronDown className="size-3 text-text-muted" />
								</button>
							</DropdownMenuTrigger>

							<DropdownMenuContent
								align="end"
								sideOffset={8}
								className="w-52 rounded-sm border border-surface-3 bg-surface-1 p-1 shadow-xl"
							>
								<div className="px-3 py-2.5">
									<p className="font-ps2p text-[8px] uppercase tracking-wider text-gold-base">
										The Hidden Human
									</p>
									<p className="mt-1.5 text-[11px] text-text-muted">
										{room?.participants?.length ?? 0} players · {fmtTimer(timer)} left
									</p>
								</div>

								<DropdownMenuSeparator className="bg-surface-3" />

								<DropdownMenuItem
									className="flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 text-[12px] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus:bg-surface-2 focus:text-text-primary"
									onClick={() => void handleCopyRoomId()}
								>
									{copiedRoomId ? (
										<Check className="size-3.5 shrink-0 text-success" />
									) : (
										<Copy className="size-3.5 shrink-0" />
									)}
									{copiedRoomId ? 'Copied!' : 'Copy Room ID'}
								</DropdownMenuItem>

								<DropdownMenuSeparator className="bg-surface-3" />

								<DropdownMenuItem
									className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 text-[12px] text-terracotta-bright transition-colors hover:bg-terracotta/10 focus:bg-terracotta/10 focus:text-terracotta-bright"
									disabled={isLeavingRoom || !room || !currentParticipant}
									onClick={() => void handleLeaveRoom()}
								>
									<DoorOpen className="size-3.5 shrink-0" />
									{isLeavingRoom ? 'Leaving…' : 'Leave Room'}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<div className="mx-auto mt-18 w-full max-w-5xl bg-transparent px-4 sm:px-6">
				{roomError ? (
					<p className="py-2 text-sm text-red-400">{roomError}</p>
				) : null}
				{messagesError ? (
					<p className="py-2 text-sm text-red-400">{messagesError}</p>
				) : null}
				<ChatFeed messages={messages} typingAgents={typingAgents} />

				{gameEnded && (
					<div className="mx-auto mb-4 w-full max-w-lg rounded-sm border border-gold-base/30 bg-surface-1 p-6 text-center">
						<p className="font-ps2p text-[10px] uppercase tracking-widest text-gold-base">
							Game Over
						</p>
						{gameResult && (
							<p className="mt-3 text-sm leading-7 text-text-primary">
								{gameResult}
							</p>
						)}
						<p className="mt-2 text-[11px] text-text-muted">
							This room is no longer active.
						</p>
						<button
							type="button"
							onClick={() => void handleLeaveRoom()}
							disabled={isLeavingRoom}
							className="mt-5 w-full rounded-sm bg-gold-base py-3 font-ps2p text-[9px] uppercase tracking-wider text-surface-0 transition-all hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isLeavingRoom ? 'Leaving…' : 'Leave Room'}
						</button>
					</div>
				)}
			</div>

			<div className="fixed inset-x-0 bottom-0 z-40 pb-2 pt-4 backdrop-blur">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<ChatInput
						currentUser={{
							name:
								currentParticipant?.displayName ??
								playerIdentity.displayName,
							initials: initials(
								currentParticipant?.displayName ??
									playerIdentity.displayName
							),
						}}
						players={chatPlayers}
						onSend={text => void handleSend(text)}
						onVote={player => void handleVote(player)}
						placeholder="Say something… blend in."
						disabled={!room || !currentParticipant || gameEnded}
					/>
				</div>
			</div>

		</section>
	);
}
