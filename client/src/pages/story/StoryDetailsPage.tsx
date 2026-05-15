import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
	ArrowLeft,
	Bookmark,
	Copy,
	Eye,
	ExternalLink,
	Flag,
	Share2,
} from 'lucide-react';
import { storyService, type StoryDetail } from '@/services/story.service';
import { bookmarkService } from '@/services/bookmark.service';
import showToast from '@/utils/toast.util';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import StorySourcesStrip from '@/components/story/StorySourcesStrip';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StoryComments from '../../components/story/StoryComments';
import StoryMarkdownContent from '../../components/story/StoryMarkdownContent';
import StoryTimeline from '../../components/story/StoryTimeline';
import ReportDialog from '@/components/common/ReportDialog';

function formatDate(value: string | null): string {
	if (!value) return 'Unknown date';
	return new Date(value).toLocaleDateString(undefined, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

export default function StoryDetailsPage() {
	const params = useParams();
	const storyId = params.storyId ?? '';

	const [story, setStory] = useState<StoryDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isBookmarked, setIsBookmarked] = useState(false);
	const [bookmarkBusy, setBookmarkBusy] = useState(false);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);

	useEffect(() => {
		let mounted = true;
		if (!storyId) {
			setError('Invalid story id');
			setLoading(false);
			return;
		}

		const run = async () => {
			try {
				setLoading(true);
				setError(null);
				const response = await storyService.getStory(storyId);
				if (!mounted) return;
				setStory(response);
			} catch (err) {
				if (!mounted) return;
				const message =
					err instanceof Error ? err.message : 'Failed to load story';
				setError(message);
			} finally {
				if (mounted) setLoading(false);
			}
		};

		run();
		return () => {
			mounted = false;
		};
	}, [storyId]);

	useEffect(() => {
		let mounted = true;
		const hasSession = Boolean(
			localStorage.getItem('proofline_session_token')
		);
		if (!storyId || !hasSession) {
			setIsBookmarked(false);
			return;
		}

		const run = async () => {
			try {
				const bookmarked =
					await bookmarkService.getStoryBookmarkStatus(storyId);
				if (!mounted) return;
				setIsBookmarked(bookmarked);
			} catch {
				if (!mounted) return;
				setIsBookmarked(false);
			}
		};

		run();
		return () => {
			mounted = false;
		};
	}, [storyId]);

	const handleToggleBookmark = async () => {
		if (!storyId || bookmarkBusy) return;
		try {
			setBookmarkBusy(true);
			if (isBookmarked) {
				await bookmarkService.deleteStoryBookmark(storyId);
				setIsBookmarked(false);
				showToast.success('Removed from bookmarks');
				return;
			}

			await bookmarkService.createStoryBookmark(storyId);
			setIsBookmarked(true);
			showToast.success('Saved to bookmarks');
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to update bookmark';
			showToast.error(message);
		} finally {
			setBookmarkBusy(false);
		}
	};

	const shareUrl =
		typeof window !== 'undefined'
			? `${window.location.origin}/stories/${storyId}`
			: `/stories/${storyId}`;

	const handleCopyStoryLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			showToast.success('Story link copied');
		} catch {
			showToast.error('Unable to copy story link');
		}
	};

	const handleNativeShare = async () => {
		if (!story) return;
		if (typeof navigator === 'undefined' || !navigator.share) {
			await handleCopyStoryLink();
			return;
		}

		try {
			await navigator.share({
				title: story.headline,
				text: story.subtitle,
				url: shareUrl,
			});
		} catch {
			// user canceled or share failed
		}
	};

	const handleShareOnX = () => {
		if (!story) return;
		const text = `${story.headline} ${shareUrl}`;
		const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	return (
		<main className="min-h-screen bg-odin-dark-200 px-4 py-6 text-odin-dark-1000 sm:px-6 sm:py-10">
			<section className="mx-auto max-w-6xl">
				<Header />

				<div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:mt-12 sm:gap-4">
					<Link
						to="/stories"
						className="inline-flex items-center gap-2 rounded-full border border-odin-dark-500 bg-odin-dark-300 px-3.5 py-2 text-xs font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-400 sm:px-4 sm:text-sm"
					>
						<ArrowLeft size={16} />
						Back to Stories
					</Link>
				</div>

				{loading ? (
					<div className="rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-6 text-odin-dark-1000-a-65">
						Loading story...
					</div>
				) : null}

				{error ? (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
						{error}
					</div>
				) : null}

				{story && !loading && !error ? (
					<div className="grid min-w-0 gap-6 sm:gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
						<div className="min-w-0">
							<article className="h-fit min-w-0 overflow-hidden rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-4 shadow-sm sm:rounded-3xl sm:p-7">
								<div className="mb-2 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
									<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-odin-dark-1000-a-65 sm:gap-3 sm:text-sm">
										<span className="capitalize">
											{story.trend.category}
										</span>
										<span className="text-odin-dark-1000-a-50">
											•
										</span>
										<span>{formatDate(story.createdAt)}</span>
									</div>

									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													type="button"
													aria-label="Bookmark story"
													onClick={handleToggleBookmark}
													disabled={bookmarkBusy || !storyId}
													className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-odin-dark-1000-a-20 bg-odin-dark-400 text-odin-dark-1000 transition hover:bg-odin-dark-500 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-9"
												>
													<Bookmark
														size={17}
														className={
															isBookmarked
																? 'fill-current'
																: undefined
														}
													/>
												</button>
											</TooltipTrigger>
											<TooltipContent>
												{isBookmarked ? 'Bookmarked' : 'Bookmark'}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<h1 className="mt-2 text-2xl font-semibold leading-tight text-odin-dark-1000 sm:text-3xl">
									{story.headline}
								</h1>
								<p className="mt-3 text-sm text-odin-dark-1000-a-65 sm:text-base">
									{story.subtitle}
								</p>

								<div className="mt-5 flex flex-wrap gap-2 text-[11px] text-odin-dark-1000-a-65 sm:text-xs">
									<span className="rounded-full bg-odin-dark-500 px-3 py-1 font-semibold text-odin-dark-1000">
										{story.verdict}
									</span>
									<span className="rounded-full border border-odin-dark-500 px-3 py-1">
										{story.confidence}% confidence
									</span>
									{typeof (story as { viewsCount?: number })
										.viewsCount === 'number' ? (
										<span className="inline-flex items-center gap-1 rounded-full border border-odin-dark-500 px-3 py-1">
											<Eye size={13} />
											{(story as { viewsCount?: number }).viewsCount}
										</span>
									) : null}
								</div>

								<StorySourcesStrip
									citations={story.citations}
									headline={story.headline}
								/>

								<div className="mt-6 sm:mt-7">
									<StoryMarkdownContent
										content={story.bodyMarkdown}
										citationLinks={story.citations.reduce<
											Record<number, string>
										>((acc, citation) => {
											acc[citation.rank] = citation.url;
											return acc;
										}, {})}
									/>
								</div>

								<div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-odin-dark-500 pt-4 sm:mt-8 sm:gap-3 sm:pt-5">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="inline-flex items-center gap-2 rounded-full border border-odin-dark-500 bg-odin-dark-400 px-3.5 py-2 text-xs font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 sm:px-4 sm:text-sm"
											>
												<Share2 size={16} />
												Share article
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent className="w-48 border-odin-dark-500 bg-odin-dark-300 text-odin-dark-1000">
											<DropdownMenuItem
												onClick={handleCopyStoryLink}
											>
												<Copy size={15} />
												Copy link
											</DropdownMenuItem>
											<DropdownMenuItem onClick={handleNativeShare}>
												<Share2 size={15} />
												Share...
											</DropdownMenuItem>
											<DropdownMenuItem onClick={handleShareOnX}>
												<ExternalLink size={15} />
												Share on X
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>

									<button
										type="button"
										onClick={() => setReportDialogOpen(true)}
										className="inline-flex items-center gap-2 rounded-full border border-odin-dark-500 bg-odin-dark-400 px-3.5 py-2 text-xs font-semibold text-odin-dark-1000 transition hover:bg-odin-dark-500 sm:px-4 sm:text-sm"
									>
										<Flag size={16} />
										Report article
									</button>
								</div>
							</article>

							<div className="mt-7 lg:hidden">
								<StoryTimeline story={story} />
							</div>

							<StoryComments
								storyId={story.id}
								citations={story.citations}
							/>
						</div>

						<aside className="hidden lg:block lg:pl-2">
							<StoryTimeline story={story} />
						</aside>
					</div>
				) : null}
				<Footer className="mt-12 border-odin-dark-500 text-odin-dark-1000-a-65" />
			</section>

			<ReportDialog
				open={reportDialogOpen}
				onOpenChange={setReportDialogOpen}
				targetType="STORY"
				targetId={story?.id ?? ''}
				title="Report article"
				description="Tell us what is wrong with this article."
			/>
		</main>
	);
}
