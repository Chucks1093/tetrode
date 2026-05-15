import { useEffect, useState } from 'react';
import { storyService, type StoryListItem } from '@/services/story.service';
import { bookmarkService } from '@/services/bookmark.service';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import StoryCard from '@/components/story/StoryCard';
import FeaturedStory from '@/components/story/FeaturedStory';
import FollowSourcesStrip from '@/components/story/FollowSourcesStrip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SourcePublisherItem } from '@/services/story.service';
import showToast from '@/utils/toast.util';

const PAGE_SIZE = 24;

function normalizePublisherKey(value: string): string {
	return value.trim().toLowerCase().replace(/^www\./, '');
}

export default function StoriesPage() {
	const [stories, setStories] = useState<StoryListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [totalStories, setTotalStories] = useState(0);
	const [sourcePublishers, setSourcePublishers] = useState<SourcePublisherItem[]>(
		[]
	);
	const [followingPublisherKeys, setFollowingPublisherKeys] = useState<
		Set<string>
	>(new Set());
	const [pendingPublisherKeys, setPendingPublisherKeys] = useState<Set<string>>(
		new Set()
	);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			try {
				setLoading(true);
				setError(null);
				const [response, bookmarksResult] = await Promise.allSettled([
					storyService.getStories({
						limit: PAGE_SIZE,
						offset: (page - 1) * PAGE_SIZE,
					}),
					bookmarkService.getMyBookmarks(),
				]);
				if (response.status !== 'fulfilled') {
					throw response.reason;
				}

				if (!mounted) return;
				const bookmarkedStoryIds =
					bookmarksResult.status === 'fulfilled'
						? new Set(bookmarksResult.value.map(item => item.storyId))
						: new Set<string>();

				setStories(
					response.value.stories.map(story => ({
						...story,
						isBookmarked: bookmarkedStoryIds.has(story.id),
					}))
				);
				setHasMore(response.value.pagination.hasMore);
				setTotalStories(response.value.pagination.total);
			} catch (err) {
				if (!mounted) return;
				const message =
					err instanceof Error ? err.message : 'Failed to load stories';
				setError(message);
			} finally {
				if (mounted) setLoading(false);
			}
		};

		run();
		return () => {
			mounted = false;
		};
	}, [page]);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			try {
				const [publishers, followed] = await Promise.all([
					storyService.getSourcePublishers(30),
					storyService.getFollowedSourcePublishers(),
				]);
				if (!mounted) return;
				setSourcePublishers(publishers);
				setFollowingPublisherKeys(
					new Set(
						followed.map(item => normalizePublisherKey(item.publisherKey))
					)
				);
			} catch {
				if (!mounted) return;
				setSourcePublishers([]);
			}
		};
		run();
		return () => {
			mounted = false;
		};
	}, []);

	const categories = [
		'All',
		...Array.from(
			new Set(
				stories
					.map(story => story.trend?.category?.trim())
					.filter((value): value is string => Boolean(value))
			)
		),
	];

	const filteredStories =
		selectedCategory === 'All'
			? stories
			: stories.filter(story => story.trend?.category === selectedCategory);

	const featuredStory = filteredStories[0] ?? null;
	const fallbackPublishers: SourcePublisherItem[] = Array.from(
		new Map(
			stories
				.flatMap(story => story.sourcePreviews)
				.filter(source => source.publisher?.trim().length > 0)
				.map(source => [
					normalizePublisherKey(source.publisher),
					{
						publisher: source.publisher,
						faviconUrl: source.faviconUrl,
						storyCount: 1,
					} satisfies SourcePublisherItem,
				])
		).values()
	).slice(0, 30);
	const effectiveSourcePublishers =
		sourcePublishers.length > 0 ? sourcePublishers : fallbackPublishers;

	const handleTogglePublisherFollow = async (
		publisher: string,
		publisherKey: string
	) => {
		if (pendingPublisherKeys.has(publisherKey)) return;
		setPendingPublisherKeys(current => new Set([...current, publisherKey]));

		const currentlyFollowed = followingPublisherKeys.has(publisherKey);
		setFollowingPublisherKeys(current => {
			const next = new Set(current);
			if (currentlyFollowed) next.delete(publisherKey);
			else next.add(publisherKey);
			return next;
		});

		try {
			if (currentlyFollowed) {
				await storyService.unfollowSourcePublisher(publisher);
			} else {
				await storyService.followSourcePublisher(publisher);
			}
		} catch (error) {
			setFollowingPublisherKeys(current => {
				const next = new Set(current);
				if (currentlyFollowed) next.add(publisherKey);
				else next.delete(publisherKey);
				return next;
			});
			const message =
				error instanceof Error
					? error.message
					: 'Failed to update followed source';
			showToast.error(message);
		} finally {
			setPendingPublisherKeys(current => {
				const next = new Set(current);
				next.delete(publisherKey);
				return next;
			});
		}
	};

	return (
		<main className="min-h-screen bg-odin-dark-200 px-6 py-10 text-odin-dark-1000">
			<section className="mx-auto max-w-6xl">
				<Header />

				{loading ? (
					<div className="rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-6 text-odin-dark-1000-a-65 mt-4">
						Loading stories...
					</div>
				) : null}

				{error ? (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 mt-4">
						{error}
					</div>
				) : null}

				{!loading && !error ? (
					<div className="mt-9">
						<FollowSourcesStrip
							publishers={effectiveSourcePublishers}
							followedPublisherKeys={followingPublisherKeys}
							pendingPublisherKeys={pendingPublisherKeys}
							onToggle={handleTogglePublisherFollow}
							className="mb-6"
						/>

						<div>
							<p className="w-fit rounded-sm bg-odin-dark-500 px-2.5 py-1 text-sm font-inter text-odin-dark-1000-a-65">
								Trending
							</p>
						</div>

						{featuredStory ? (
							<div className="mt-6">
								<FeaturedStory story={featuredStory} />
							</div>
						) : null}

						<Tabs
							value={selectedCategory}
							onValueChange={setSelectedCategory}
							className="mt-6"
						>
							<div className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-8 rounded-none border-0 border-b border-odin-dark-500 bg-transparent p-0">
										{categories.map(category => (
											<TabsTrigger
												key={category}
												value={category}
												className="whitespace-nowrap rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-3 pt-1 capitalize text-base text-odin-dark-1000-a-65 shadow-none data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-odin-dark-1000 data-[state=active]:shadow-none data-[state=inactive]:hover:bg-transparent data-[state=inactive]:hover:text-odin-dark-1000"
											>
												{category}
											</TabsTrigger>
										))}
								</TabsList>
							</div>
						</Tabs>

						<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 mt-9">
							{filteredStories.map(story => (
								<StoryCard key={story.id} story={story} />
							))}
						</div>

						<div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-odin-dark-500 bg-odin-dark-300 px-4 py-3">
							<p className="text-sm text-odin-dark-1000-a-65">
								Page {page}
								{totalStories > 0
									? ` • ${totalStories} stories total`
									: ''}
							</p>

							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={page === 1 || loading}
									onClick={() =>
										setPage(current => Math.max(1, current - 1))
									}
									className="rounded-full border border-odin-dark-500 bg-odin-dark-400 px-4 py-2 text-sm font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>

								<button
									type="button"
									disabled={!hasMore || loading}
									onClick={() => setPage(current => current + 1)}
									className="rounded-full border border-odin-dark-500 bg-odin-dark-400 px-4 py-2 text-sm font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						</div>
					</div>
				) : null}
				<Footer className="mt-12 border-odin-dark-500 text-odin-dark-1000-a-65" />
			</section>
		</main>
	);
}
