import { Bookmark, Clock3, Heart } from 'lucide-react';
import { Link } from 'react-router';
import type { StoryListItem } from '@/services/story.service';
import StorySourcesBadge from './StorySourcesBadge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

type FeaturedStoryProps = {
	story: StoryListItem;
};

function formatRelativeTime(value: string): string {
	const now = Date.now();
	const then = new Date(value).getTime();
	const diffMs = Math.max(0, now - then);

	const minutes = Math.floor(diffMs / (1000 * 60));
	if (minutes < 60)
		return `Published ${minutes || 1} minute${minutes === 1 ? '' : 's'} ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24)
		return `Published ${hours} hour${hours === 1 ? '' : 's'} ago`;

	const days = Math.floor(hours / 24);
	return `Published ${days} day${days === 1 ? '' : 's'} ago`;
}

export default function FeaturedStory({ story }: FeaturedStoryProps) {
	return (
		<Link
			to={`/stories/${story.id}`}
			className="grid gap-4 rounded-2xl border border-odin-dark-500 bg-odin-dark-200 p-3 text-white transition hover:bg-odin-dark-300 sm:gap-6 sm:p-5 lg:grid-cols-[1.02fr_0.98fr] lg:gap-7 lg:p-7"
		>
			<div className="order-2 lg:order-1">
				<h2 className="mt-1 font-gelasio text-2xl font-medium leading-tight tracking-tight text-odin-dark-1000 sm:mt-3 sm:text-3xl lg:mt-5 lg:text-4xl">
					{story.headline}
				</h2>

				<div className="mt-3 flex items-center gap-2 text-xs text-odin-dark-1000-a-65 sm:mt-4 sm:text-sm lg:mt-5">
					<Clock3 size={16} />
					<span>{formatRelativeTime(story.createdAt)}</span>
				</div>

				<p className="mt-3 max-w-lg font-gelasio text-sm text-odin-dark-1000-a-65 sm:mt-4 sm:text-base lg:mt-5 lg:text-lg">
					{story.subtitle}
				</p>

				<div className="mt-5 flex max-w-md items-center justify-between pt-1 text-white/70 sm:mt-6 lg:mt-8">
					<StorySourcesBadge story={story} />
					<TooltipProvider>
						<div className="flex items-center gap-5 hidden">
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label="Like story"
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-odin-dark-1000-a-65 transition hover:bg-black/45 hover:text-white"
										onClick={event => {
											event.preventDefault();
											event.stopPropagation();
										}}
									>
										<Heart size={21} />
									</button>
								</TooltipTrigger>
								<TooltipContent>Like</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label="Bookmark story"
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-odin-dark-1000-a-65 transition hover:bg-black/45 hover:text-white"
										onClick={event => {
											event.preventDefault();
											event.stopPropagation();
										}}
									>
										<Bookmark size={21} />
									</button>
								</TooltipTrigger>
								<TooltipContent>Bookmark</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>
				</div>
			</div>

			<div className="order-1 overflow-hidden rounded-2xl bg-odin-dark-100 lg:order-2 lg:rounded-[1.6rem]">
				{story.imageUrl ? (
					<img
						src={story.imageUrl}
						alt={story.title || story.headline}
						className="h-full min-h-[220px] max-h-50 w-full object-cover sm:min-h-[280px] lg:min-h-[320px]"
						loading="lazy"
						onError={event => {
							event.currentTarget.style.display = 'none';
						}}
					/>
				) : (
					<div className="flex h-full min-h-55 items-center justify-center text-sm text-odin-dark-1000-a-65 sm:min-h-[280px] sm:text-base lg:min-h-[360px] lg:text-lg">
						No image available
					</div>
				)}
			</div>
		</Link>
	);
}
