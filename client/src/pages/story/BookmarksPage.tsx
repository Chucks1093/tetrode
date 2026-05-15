import { useEffect, useMemo, useState } from 'react';
import { Bookmark } from 'lucide-react';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import StoryCard from '@/components/story/StoryCard';
import { bookmarkService, type StoryBookmarkItem } from '@/services/bookmark.service';
import type { StoryListItem } from '@/services/story.service';

const PAGE_SIZE = 24;

function toStoryCardItem(bookmark: StoryBookmarkItem): StoryListItem {
	return {
		id: bookmark.storyId,
		headline: bookmark.headline,
		title: bookmark.title,
		subtitle: bookmark.subtitle,
		verdict: bookmark.verdict as StoryListItem['verdict'],
		confidence: bookmark.confidence,
		imageUrl: bookmark.imageUrl,
		createdAt: bookmark.storyCreatedAt,
		trend: bookmark.trend,
		citationsCount: bookmark.citationsCount,
		sourcePreviews: bookmark.sourcePreviews,
		isBookmarked: true,
	};
}

export default function BookmarksPage() {
	const [bookmarks, setBookmarks] = useState<StoryBookmarkItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			try {
				setLoading(true);
				setError(null);
				const rows = await bookmarkService.getMyBookmarks();
				if (!mounted) return;
				setBookmarks(rows);
				setPage(1);
			} catch (err) {
				if (!mounted) return;
				const message =
					err instanceof Error ? err.message : 'Failed to load bookmarks';
				setError(message);
			} finally {
				if (mounted) setLoading(false);
			}
		};

		run();
		return () => {
			mounted = false;
		};
	}, []);

	const totalPages = Math.max(1, Math.ceil(bookmarks.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);

	const pagedStories = useMemo(() => {
		const offset = (safePage - 1) * PAGE_SIZE;
		return bookmarks.slice(offset, offset + PAGE_SIZE).map(toStoryCardItem);
	}, [bookmarks, safePage]);

	useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	return (
		<main className="min-h-screen bg-odin-dark-200 px-6 py-10 text-odin-dark-1000">
			<section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col">
				<Header />

				<div className="mt-9">
					<h1 className="text-3xl font-semibold text-odin-dark-1000">
						Your Bookmarks
					</h1>
					<p className="mt-2 text-sm text-odin-dark-1000-a-65">
						Stories you saved for later.
					</p>
				</div>

				<div className="mt-8 flex-1">
					{loading ? (
						<div className="rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-6 text-odin-dark-1000-a-65">
							Loading bookmarks...
						</div>
					) : null}

					{error ? (
						<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
							{error}
						</div>
					) : null}

					{!loading && !error ? (
						<>
							{pagedStories.length > 0 ? (
								<>
									<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
										{pagedStories.map(story => (
											<StoryCard key={story.id} story={story} />
										))}
									</div>

									<div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-odin-dark-500 bg-odin-dark-300 px-4 py-3">
										<p className="text-sm text-odin-dark-1000-a-65">
											Page {safePage} of {totalPages} • {bookmarks.length}{' '}
											bookmark{bookmarks.length === 1 ? '' : 's'}
										</p>

										<div className="flex items-center gap-2">
											<button
												type="button"
												disabled={safePage <= 1 || loading}
												onClick={() =>
													setPage(current => Math.max(1, current - 1))
												}
												className="rounded-full border border-odin-dark-500 bg-odin-dark-400 px-4 py-2 text-sm font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 disabled:cursor-not-allowed disabled:opacity-50"
											>
												Previous
											</button>

											<button
												type="button"
												disabled={safePage >= totalPages || loading}
												onClick={() =>
													setPage(current => Math.min(totalPages, current + 1))
												}
												className="rounded-full border border-odin-dark-500 bg-odin-dark-400 px-4 py-2 text-sm font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 disabled:cursor-not-allowed disabled:opacity-50"
											>
												Next
											</button>
										</div>
									</div>
								</>
							) : (
								<div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-10 text-odin-dark-1000-a-65">
									<div className="flex flex-col items-center gap-3 text-center">
										<Bookmark className="h-10 w-10 text-odin-dark-1000-a-50" />
										<p className="text-sm font-medium">No bookmarks</p>
									</div>
								</div>
							)}
						</>
					) : null}
				</div>

				<Footer className="mt-12 border-odin-dark-500 pt-12 text-odin-dark-1000-a-65" />
			</section>
		</main>
	);
}
