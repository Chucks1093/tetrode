import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourcePublisherItem } from '@/services/story.service';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/carousel';

type FollowSourcesStripProps = {
	publishers: SourcePublisherItem[];
	followedPublisherKeys: Set<string>;
	pendingPublisherKeys: Set<string>;
	onToggle: (publisher: string, publisherKey: string) => void;
	className?: string;
};

function initials(value: string): string {
	const cleaned = value.replace(/^www\./i, '').trim();
	if (!cleaned) return 'PL';
	return cleaned.slice(0, 2).toUpperCase();
}

function normalizePublisherKey(value: string): string {
	return value.trim().toLowerCase().replace(/^www\./, '');
}

export default function FollowSourcesStrip({
	publishers,
	followedPublisherKeys,
	pendingPublisherKeys,
	onToggle,
	className,
}: FollowSourcesStripProps) {
	if (publishers.length === 0) return null;

	return (
		<section
			className={cn(
				'rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-4 sm:p-5',
				className
			)}
		>
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="text-sm font-semibold text-odin-dark-1000">
					Follow Sources
				</p>
				<p className="text-xs text-odin-dark-1000-a-65">
					{followedPublisherKeys.size} following
				</p>
			</div>

			<Carousel
				opts={{
					align: 'start',
					dragFree: true,
				}}
				className="px-10"
			>
				<CarouselContent>
					{publishers.map(item => {
						const publisherKey = normalizePublisherKey(item.publisher);
						const isFollowed = followedPublisherKeys.has(publisherKey);
						const isPending = pendingPublisherKeys.has(publisherKey);

						return (
							<CarouselItem
								key={publisherKey}
								className="basis-auto"
							>
								<button
									type="button"
									onClick={() => onToggle(item.publisher, publisherKey)}
									disabled={isPending}
									className={cn(
										'group inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-70',
										isFollowed
											? 'border-odin-dark-700 bg-odin-dark-500 text-odin-dark-1000'
											: 'border-odin-dark-500 bg-odin-dark-400 text-odin-dark-1000-a-65 hover:border-odin-dark-700 hover:text-odin-dark-1000'
									)}
								>
									<span className="relative inline-flex size-6 items-center justify-center overflow-visible rounded-full border border-odin-dark-500 bg-odin-dark-100 text-[10px] font-semibold text-odin-dark-1000-a-65">
										{item.faviconUrl ? (
											<img
												src={item.faviconUrl}
												alt={`${item.publisher} favicon`}
												className="size-full rounded-full object-cover"
												loading="lazy"
												onError={event => {
													event.currentTarget.style.display = 'none';
												}}
											/>
										) : (
											initials(item.publisher)
										)}

										<span className="absolute -right-1 -bottom-1 inline-flex size-3.5 items-center justify-center rounded-full bg-odin-dark-1000 text-odin-dark-200">
											{isFollowed ? (
												<Check className="size-2.5" />
											) : (
												<Plus className="size-2.5" />
											)}
										</span>
									</span>

									<span className="max-w-[140px] truncate capitalize sm:max-w-[180px]">
										{item.publisher.replace(/^www\./i, '')}
									</span>
								</button>
							</CarouselItem>
						);
					})}
				</CarouselContent>
				<CarouselPrevious className="left-0 border-odin-dark-500 bg-odin-dark-400 text-odin-dark-1000 hover:bg-odin-dark-500" />
				<CarouselNext className="right-0 border-odin-dark-500 bg-odin-dark-400 text-odin-dark-1000 hover:bg-odin-dark-500" />
			</Carousel>
		</section>
	);
}
