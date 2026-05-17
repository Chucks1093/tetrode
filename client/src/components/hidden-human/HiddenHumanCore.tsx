'use client';

import { useEffect, useState } from 'react';
import { ChatFeed, ChatInput } from '@/components/shared/chat';
import type { FeedMessage, ChatPlayer } from '@/components/shared/chat';
import { cn } from '@/lib/utils';
import { chatService, type RoomChatMessage } from '@/services/chat.service';
import { playerService } from '@/services/player.service';
import type { Room } from '@/services/room.service';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

const PHASE = { label: 'Discussion', round: 1, total: 3 };
const INITIAL_TIMER = 90;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

interface HiddenHumanCoreProps {
	room?: Room | null;
	roomError?: string | null;
}

export default function HiddenHumanCore({
	room,
	roomError,
}: HiddenHumanCoreProps) {
	const playerIdentity = playerService.getIdentity();
	const currentParticipant =
		room?.participants?.find(
			participant =>
				participant.type === 'HUMAN' &&
				participant.actorId === playerIdentity.actorId
		) ?? null;
	const otherParticipants =
		room?.participants?.filter(
			participant => participant.id !== currentParticipant?.id
		) ?? [];
	const [messages, setMessages] = useState<FeedMessage[]>([]);
	const [messagesError, setMessagesError] = useState<string | null>(null);
	const [timer, setTimer] = useState(INITIAL_TIMER);

	useEffect(() => {
		const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 0)), 1000);
		return () => clearInterval(id);
	}, []);

	const syncMessages = async (
		currentRoomId: string,
		participantId?: string | null
	) => {
		const response = await chatService.getMessages(currentRoomId);
		setMessages(
			response.messages.map(message =>
				toFeedMessage(message, participantId ?? null)
			)
		);
	};

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
					response.messages.map(message =>
						toFeedMessage(message, currentParticipant?.id ?? null)
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

	const chatPlayers: ChatPlayer[] = otherParticipants.map(participant => ({
		id: participant.id,
		name: participant.displayName,
		initials: initials(participant.displayName),
	}));

	const handleSend = async (text: string) => {
		if (!room?.id || !currentParticipant?.id) {
			return;
		}

		const optimisticId = `temp-${Date.now()}`;
		const optimisticMessage: FeedMessage = {
			id: optimisticId,
			sender: currentParticipant.displayName,
			type: 'human',
			text,
			time: nowStamp(),
		};

		setMessages(prev => [...prev, optimisticMessage]);

		try {
			const createdMessage = await chatService.createMessage(room.id, {
				senderId: currentParticipant.id,
				content: text,
			});
			setMessages(prev =>
				prev.map(message =>
					message.id === optimisticId
						? toFeedMessage(createdMessage, currentParticipant.id)
						: message
				)
			);
			await syncMessages(room.id, currentParticipant.id);
			setMessagesError(null);
		} catch (error) {
			setMessages(prev => prev.filter(message => message.id !== optimisticId));
			setMessagesError(
				error instanceof Error ? error.message : 'Failed to send message.'
			);
		}
	};

	const handleRaiseSuspicion = (player: ChatPlayer) => {
		setMessages(prev => [
			...prev,
			{
				id: prev.length + 1,
				sender: 'SYSTEM',
				type: 'system',
				text: `You raised suspicion on ${player.name}.`,
				eventType: 'accusation' as const,
			},
		]);
	};

	return (
		<section className="flex min-h-screen flex-col gap-3 pb-20">
			<header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--surface-4)] bg-[color:var(--surface-1)]/92 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
					<p className="font-ps2p text-sm uppercase text-[var(--accent-bright)]">
						The Hidden Human
					</p>

					<div className="flex items-center gap-6 text-xs text-[var(--text-secondary)]">
						<p className="uppercase tracking-widest text-[var(--text-muted)]">
							{PHASE.label}
						</p>
						<p className="uppercase tracking-widest text-[var(--text-muted)]">
							{room
								? `Room ${room.id.slice(0, 8)}`
								: `Round ${PHASE.round}/${PHASE.total}`}
						</p>
						<p
							className={cn(
								'font-ps2p text-sm tabular-nums',
								timer <= 30
									? 'animate-pulse text-red-500'
									: 'text-[var(--accent-bright)]'
							)}
						>
							{fmtTimer(timer)}
						</p>
					</div>
				</div>
			</header>

			{/* ── Scrollable chat ── */}
			<div className="mx-auto mt-18 w-full max-w-5xl bg-transparent px-4 sm:px-6">
				{roomError ? (
					<p className="py-2 text-sm text-red-400">{roomError}</p>
				) : null}
				{messagesError ? (
					<p className="py-2 text-sm text-red-400">{messagesError}</p>
				) : null}
				<ChatFeed messages={messages} />
			</div>

			{/* ── Chat input ── */}
			<div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--surface-4)] bg-[color:var(--surface-0)]/94 pb-2 pt-4 backdrop-blur">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<ChatInput
						currentUser={{
							name: currentParticipant?.displayName ?? playerIdentity.displayName,
							initials: initials(
								currentParticipant?.displayName ?? playerIdentity.displayName
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
