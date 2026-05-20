'use client';

import { Check, Copy, DoorOpen, MoreHorizontal, Users } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { chatService, type RoomChatMessage } from '@/services/chat.service';
import { socketService } from '@/services/socket.service';
import { playerService } from '@/services/player.service';
import { roomService, type Room } from '@/services/room.service';

const INITIAL_TIMER = 90;

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
		return {
			id: message.id,
			sender: 'SYSTEM',
			type: 'system',
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
	const [timer, setTimer] = useState(INITIAL_TIMER);
	const [typingAgents, setTypingAgents] = useState<Map<string, string>>(
		new Map()
	);
	const [isLeavingRoom, setIsLeavingRoom] = useState(false);
	const [copiedRoomId, setCopiedRoomId] = useState(false);

	useEffect(() => {
		const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 0)), 1000);
		return () => clearInterval(id);
	}, []);

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

		return () => {
			socketService.offMessage();
			socketService.offAgentTyping();
			socketService.offAgentStopTyping();
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

	const handleRaiseSuspicion = (player: ChatPlayer) => {
		setMessages(prev => [
			...prev,
			{
				id: String(prev.length + 1),
				sender: 'SYSTEM',
				type: 'system',
				text: `You raised suspicion on ${player.name}.`,
				eventType: 'accusation' as const,
			},
		]);
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
			navigate(`/${room.gameId}`);
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
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
					<div>
						<p className="font-ps2p text-sm uppercase text-gold-base">
							The Hidden Human
						</p>
					</div>

					<div className="flex items-center gap-4 text-xs sm:gap-6">
						<p className="max-w-[11rem] truncate uppercase tracking-widest text-text-muted">
							{currentParticipant?.displayName ??
								playerIdentity.displayName}
						</p>
						<p className="uppercase tracking-widest text-text-muted">
							{room
								? `${room.participants?.length ?? 0} Players`
								: 'Room'}
						</p>
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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="flex size-9 items-center justify-center rounded-sm border border-surface-3 bg-surface-2 text-text-muted transition-colors hover:border-surface-4 hover:bg-surface-3 hover:text-text-primary"
									aria-label="Open room menu"
								>
									<MoreHorizontal className="size-4" />
								</button>
							</DropdownMenuTrigger>

							<DropdownMenuContent
								align="end"
								sideOffset={8}
								className="w-60 rounded-sm border border-surface-3 bg-surface-1 p-1 shadow-xl"
							>
								<div className="px-3 py-3">
									<p className="font-ps2p text-[8px] uppercase tracking-wider text-gold-base">
										Room Menu
									</p>
									<p className="mt-2 text-[11px] text-text-muted">
										Manage your current Hidden Human room.
									</p>
								</div>

								<DropdownMenuSeparator className="bg-surface-3" />

								<div className="flex items-center justify-between px-3 py-2.5">
									<div className="flex items-center gap-2">
										<Users className="size-3.5 text-text-muted" />
										<div>
											<p className="font-ps2p text-[7px] uppercase tracking-wider text-text-muted">
												Players
											</p>
											<p className="mt-1 text-[11px] text-text-secondary">
												{room?.participants?.length ?? 0} in room
											</p>
										</div>
									</div>
								</div>

								<div className="flex items-center justify-between px-3 py-2.5">
									<div>
										<p className="font-ps2p text-[7px] uppercase tracking-wider text-text-muted">
											Room Id
										</p>
										<p className="mt-1 text-[11px] text-text-secondary">
											{room?.id.slice(0, 8)}
										</p>
									</div>
									<button
										type="button"
										onClick={e => {
											e.stopPropagation();
											void handleCopyRoomId();
										}}
										className="flex items-center gap-1 rounded-sm border border-surface-3 px-2 py-1 font-ps2p text-[7px] uppercase tracking-wider text-text-muted transition-colors hover:border-surface-4 hover:text-text-primary"
										aria-label="Copy room id"
									>
										{copiedRoomId ? (
											<Check className="size-2.5 text-success" />
										) : (
											<Copy className="size-2.5" />
										)}
										{copiedRoomId ? 'Copied' : 'Copy'}
									</button>
								</div>

								<DropdownMenuSeparator className="bg-surface-3" />

								<DropdownMenuItem
									className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-terracotta-bright transition-colors hover:bg-terracotta/10 focus:bg-terracotta/10 focus:text-terracotta-bright"
									disabled={
										isLeavingRoom || !room || !currentParticipant
									}
									onClick={() => void handleLeaveRoom()}
								>
									<DoorOpen className="size-3.5 shrink-0" />
									{isLeavingRoom ? 'Leaving...' : 'Leave Room'}
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
						onRaiseSuspicion={handleRaiseSuspicion}
						placeholder="Say something… blend in."
						disabled={!room || !currentParticipant}
					/>
				</div>
			</div>
		</section>
	);
}
