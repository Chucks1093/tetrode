import { type MouseEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bookmark } from 'lucide-react';
import type { StoryListItem } from '@/services/story.service';
import { bookmarkService } from '@/services/bookmark.service';
import showToast from '@/utils/toast.util';
import StorySourcesBadge from './StorySourcesBadge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

type StoryCardProps = {
	story: StoryListItem;
};

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString(undefined, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

export default function StoryCard({ story }: StoryCardProps) {
	const category = story.trend?.category || 'Insight';
	const imageSrc = story.imageUrl || '/images/placeholder.jpeg';
	const [isBookmarked, setIsBookmarked] = useState(Boolean(story.isBookmarked));
	const [bookmarkBusy, setBookmarkBusy] = useState(false);

	useEffect(() => {
		setIsBookmarked(Boolean(story.isBookmarked));
	}, [story.id, story.isBookmarked]);

	const handleToggleBookmark = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (bookmarkBusy) return;

		try {
			setBookmarkBusy(true);
			if (isBookmarked) {
				await bookmarkService.deleteStoryBookmark(story.id);
				setIsBookmarked(false);
				showToast.success('Removed from bookmarks');
				return;
			}

			await bookmarkService.createStoryBookmark(story.id);
			setIsBookmarked(true);
			showToast.success('Saved to bookmarks');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to update bookmark';
			showToast.error(message);
		} finally {
			setBookmarkBusy(false);
		}
	};

	return (
		<Link
			to={`/stories/${story.id}`}
			className="group overflow-hidden rounded-2xl border border-odin-dark-500 bg-odin-dark-300 shadow-sm transition hover:-translate-y-1 hover:border-odin-dark-700 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
		>
			<div className="relative">
				<img
					src={imageSrc}
					alt={story.title || story.headline}
					className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
					loading="lazy"
					onError={event => {
						event.currentTarget.src = '/images/placeholder.jpeg';
					}}
				/>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								aria-label={isBookmarked ? 'Bookmarked story' : 'Bookmark story'}
								disabled={bookmarkBusy}
								className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white transition hover:bg-black/70"
								onClick={handleToggleBookmark}
							>
								<Bookmark
									size={18}
									className={isBookmarked ? 'fill-current' : undefined}
								/>
							</button>
						</TooltipTrigger>
						<TooltipContent>
							{isBookmarked ? 'Bookmarked' : 'Bookmark'}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<StorySourcesBadge
					story={story}
					className="absolute bottom-3 left-3 bg-black/60 border-white/15"
				/>
			</div>

			<div className="space-y-4 p-5">
				<div className="flex items-center gap-3 text-sm text-odin-dark-1000-a-65">
					<span className="capitalize">{category}</span>
					<span className="text-odin-dark-1000-a-50">•</span>
					<span>{formatDate(story.createdAt)}</span>
				</div>

				<h2 className="line-clamp-2 font-gelasio text-xl font-medium leading-tight text-odin-dark-1000 transition group-hover:text-white">
					{story.headline}
				</h2>

				<p className="line-clamp-3 font-gelasio text-md leading-relaxed text-odin-dark-1000-a-65">
					{story.subtitle}
				</p>
			</div>
		</Link>
	);
}
