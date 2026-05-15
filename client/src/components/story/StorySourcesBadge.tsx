import type { StoryListItem } from '@/services/story.service';

type StorySourcesBadgeProps = {
	story: StoryListItem;
	className?: string;
};

export default function StorySourcesBadge({
	story,
	className = '',
}: StorySourcesBadgeProps) {
	const previews = story.sourcePreviews.slice(0, 3);

	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-full border border-odin-dark-500 bg-odin-dark-300 px-2.5 py-1 ${className}`}
		>
			<div className="flex -space-x-1.5">
				{previews.map(source => (
					<span
						key={`${source.rank}-${source.url}`}
						className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-odin-dark-500 bg-odin-dark-100"
						title={source.publisher}
					>
						{source.faviconUrl || source.imageUrl ? (
							<img
								src={source.faviconUrl ?? source.imageUrl ?? ''}
								alt={`${source.publisher} icon`}
								className="h-full w-full object-cover"
								loading="lazy"
								onError={event => {
									event.currentTarget.style.display = 'none';
								}}
							/>
						) : (
							<span className="text-[10px] text-odin-dark-1000-a-65">
								{source.publisher.slice(0, 2).toUpperCase()}
							</span>
						)}
					</span>
				))}
			</div>
			<span className="font-gelasio text-sm leading-none text-odin-dark-1000-a-65">
				{story.citationsCount} sources
			</span>
		</div>
	);
}
