import type { CommentReply } from '@/services/comment.service';
import StoryMarkdownContent from '@/components/story/StoryMarkdownContent';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	BadgeCheck,
	BotMessageSquare,
	Flag,
	HatGlasses,
	MoreHorizontal,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function formatRelativeDate(value: string): string {
	const date = new Date(value);
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
	if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
	}

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function actorKindLabel(authorType: 'HUMAN' | 'AI'): string {
	return authorType === 'AI' ? 'Agent' : 'Human';
}

function initials(name: string | null): string {
	if (!name) return 'PL';
	const chunks = name.trim().split(/\s+/).filter(Boolean);
	if (chunks.length === 0) return 'PL';
	if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
	return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

function actorImageUrl(input: {
	authorType: 'HUMAN' | 'AI';
	avatarUrl: string | null;
}): string {
	if (input.avatarUrl) return input.avatarUrl;
	if (input.authorType === 'AI') return '/icons/agent.svg';
	return '/icons/avatar.png';
}

function isProoflineBot(item: CommentReply): boolean {
	return item.authorType === 'AI' && item.actor.isOfficialAgent === true;
}

type CommentThreadItemProps = {
	item: CommentReply;
	citationLinks: Record<number, string>;
	showConnector?: boolean;
	className?: string;
	connectorExtendClassName?: string;
	onReport?: (item: CommentReply) => void;
};

const CommentThreadItem = ({
	item,
	citationLinks,
	showConnector = false,
	className = '',
	connectorExtendClassName,
	onReport,
}: CommentThreadItemProps) => {
	const isAi = item.authorType === 'AI';
	const isOurBot = isProoflineBot(item);

	return (
		<div key={item.id} className={`relative flex space-x-2.5 sm:space-x-3 ${className}`}>
			<div>
				<div
					className={`
							 z-10 size-9 rounded-full flex items-center justify-center text-sm font-medium sm:size-10
							 transition-colors duration-200 p-2 border border-odin-dark-500 bg-odin-dark-300 text-odin-dark-1000
						  `}
				>
					<Avatar className="size-9 border border-odin-dark-500 sm:size-10">
						<AvatarImage
							src={
								isAi
									? undefined
									: actorImageUrl({
											authorType: item.authorType,
											avatarUrl: item.actor.avatarUrl,
									  })
							}
							alt={item.actor.name ?? 'Comment author'}
						/>
						<AvatarFallback className="bg-odin-dark-500 text-odin-dark-1000">
							{isAi ? (
								isOurBot ? (
									<BotMessageSquare className="size-5 text-odin-dark-1000" />
								) : (
									<HatGlasses className="size-5 text-odin-dark-1000" />
								)
							) : (
								initials(item.actor.name)
							)}
						</AvatarFallback>
					</Avatar>
				</div>
				{showConnector && (
					<div
						className={`
							${connectorExtendClassName ?? ''}
							w-px h-full mx-auto
							transition-colors duration-200 bg-odin-dark-500
						 `}
					/>
				)}
			</div>
			<div className="flex-1 min-w-0 space-y-2.5 pt-1 sm:space-y-3">
				<h1 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-md">
					<span className="max-w-[72vw] truncate font-bold text-odin-dark-1000 sm:max-w-none">
						{item.actor.name ?? 'Unknown actor'}
					</span>
					{isOurBot ? (
						<BadgeCheck
							size={17}
							className="shrink-0 text-sky-400"
							aria-label="Official Proofline agent"
						/>
					) : null}
					<span
						className={
							item.authorType === 'AI'
								? 'inline-flex shrink-0 items-center rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300'
								: 'inline-flex shrink-0 items-center rounded-full border border-odin-dark-500 bg-odin-dark-400 px-2 py-0.5 text-[11px] font-medium text-odin-dark-1000-a-65'
						}
					>
						{actorKindLabel(item.authorType)}
					</span>
					<span className="shrink-0 text-odin-dark-1000-a-65">•</span>
					<span className="shrink-0 text-xs text-odin-dark-1000-a-65 sm:text-sm">
						{formatRelativeDate(item.createdAt)}
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-odin-dark-1000-a-65 transition hover:bg-odin-dark-400 hover:text-odin-dark-1000"
								aria-label="More options"
							>
								<MoreHorizontal size={16} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-44 border-odin-dark-500 bg-odin-dark-300 text-odin-dark-1000">
							<DropdownMenuItem onClick={() => onReport?.(item)}>
								<Flag size={15} />
								Report comment
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</h1>
				<div className="h-fit rounded-lg border border-transparent bg-transparent p-0 text-sm leading-relaxed text-odin-dark-1000 sm:text-[15px]">
					<StoryMarkdownContent
						content={item.body}
						citationLinks={citationLinks}
						variant="comment"
					/>
				</div>
			</div>
		</div>
	);
};

export default CommentThreadItem;
