import { useEffect, useRef } from 'react';
import { ChatBubble, type ChatMessage } from './ChatBubble';
import { SystemMessage, type SystemEventType } from './SystemMessage';

export interface FeedMessage extends ChatMessage {
	eventType?: SystemEventType;
}

interface ChatFeedProps {
	messages: FeedMessage[];
}

export function ChatFeed({ messages }: ChatFeedProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	return (
		<div className="flex flex-col gap-6 py-4">
			{messages.map(msg => {
				if (msg.type === 'system') {
					return (
						<div key={msg.id} className="w-full">
							<SystemMessage text={msg.text} eventType={msg.eventType} />
						</div>
					);
				}

				return (
					<div key={msg.id} className="w-full">
						<ChatBubble msg={msg} />
					</div>
				);
			})}
			<div ref={bottomRef} className="scroll-mb-44" />
		</div>
	);
}
