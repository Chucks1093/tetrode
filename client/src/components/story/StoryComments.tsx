import { useEffect, useMemo, useState } from 'react';
import { commentService, type StoryComment } from '@/services/comment.service';
import type { StoryCitation } from '@/services/story.service';
import { authService } from '@/services/auth.service';
import CommentThreadItem from '@/components/story/CommentThreadItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReportDialog from '@/components/common/ReportDialog';
import type { CommentReply } from '@/services/comment.service';

function initials(name: string | null): string {
	if (!name) return 'PL';
	const chunks = name.trim().split(/\s+/).filter(Boolean);
	if (chunks.length === 0) return 'PL';
	if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
	return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

type StoryCommentsProps = {
	storyId: string;
	citations?: StoryCitation[];
};

export default function StoryComments({
	storyId,
	citations = [],
}: StoryCommentsProps) {
	const [comments, setComments] = useState<StoryComment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [body, setBody] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [reportCommentId, setReportCommentId] = useState<string | null>(null);

	const currentUser = authService.getUser();
	const currentUserAvatar = currentUser?.avatarUrl || '/icons/avatar.png';

	const citationLinks = useMemo(
		() =>
			citations.reduce<Record<number, string>>((acc, citation) => {
				acc[citation.rank] = citation.url;
				return acc;
			}, {}),
		[citations]
	);

	const loadComments = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await commentService.getStoryComments(storyId);
			setComments(response.comments);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to load comments';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!storyId) return;
		void loadComments();
	}, [storyId]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!body.trim()) return;

		try {
			setSubmitting(true);
			setError(null);
			await commentService.createStoryComment(storyId, {
				body: body.trim(),
			});
			setBody('');
			await loadComments();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to create comment';
			setError(message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleOpenCommentReport = (item: CommentReply) => {
		setReportCommentId(item.id);
	};

	return (
		<section className="mt-6 rounded-2xl border border-odin-dark-500 bg-odin-dark-300 p-4 shadow-sm sm:mt-8 sm:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-semibold text-odin-dark-1000 sm:text-xl">
						Comments
					</h2>
					<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-odin-dark-500 bg-odin-dark-200 px-2 text-xs font-semibold text-odin-dark-1000-a-65">
						{comments.length}
					</span>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="mt-4">
				<div className="rounded-xl border border-odin-dark-500 bg-odin-dark-200/40 px-4 py-3 ring-0 transition-colors duration-200 focus-within:border-odin-dark-500 focus-within:bg-odin-dark-300/70 focus-within:ring-[3px] focus-within:ring-odin-dark-500/40">
					<p className="mb-2 text-xs font-medium uppercase tracking-wide text-odin-dark-1000-a-50">
						Reply
					</p>
					<div className="flex items-start gap-3">
						{currentUser ? (
							<Avatar className="mt-0.5 size-9 border border-odin-dark-500 sm:size-10">
								<AvatarImage
									src={currentUserAvatar}
									alt={currentUser.name}
								/>
								<AvatarFallback className="bg-odin-dark-500 text-odin-dark-1000">
									{initials(currentUser.name)}
								</AvatarFallback>
							</Avatar>
						) : null}

						<div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
							<textarea
								value={body}
								onChange={event => setBody(event.target.value)}
								placeholder="Post your reply"
								maxLength={600}
								rows={2}
								className="min-h-9 flex-1 resize-none bg-transparent pt-0.5 text-sm leading-6 text-odin-dark-1000 outline-none placeholder:text-odin-dark-1000-a-50 sm:text-base"
							/>
							<button
								type="submit"
								disabled={submitting || !body.trim()}
								className="rounded-full bg-odin-dark-1000-a-65 px-3.5 py-1 text-xs font-bold text-odin-dark-100 transition hover:bg-odin-dark-1000 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
							>
								{submitting ? '...' : 'Reply'}
							</button>
						</div>
					</div>
				</div>
			</form>

			{error ? (
				<p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
					{error}
				</p>
			) : null}

			<div className="mt-6 space-y-3">
				{loading ? (
					<p className="text-sm text-odin-dark-1000-a-65">
						Loading comments...
					</p>
				) : null}

				{!loading && comments.length === 0 ? (
					<p className="text-sm text-odin-dark-1000-a-65">
						No comments yet.
					</p>
				) : null}

				{comments.map(comment => (
					<div
						key={comment.id}
						className="space-y-6 border-b border-odin-dark-500 pb-4 last:border-b-0"
					>
						<CommentThreadItem
							item={comment}
							citationLinks={citationLinks}
							showConnector={comment.replies.length > 0}
							onReport={handleOpenCommentReport}
						/>

						{comment.replies.length > 0 &&
							comment.replies.map((reply, index) => (
								<CommentThreadItem
									key={reply.id}
									item={reply}
									citationLinks={citationLinks}
									showConnector={index < comment.replies.length - 1}
									onReport={handleOpenCommentReport}
								/>
							))}
					</div>
				))}
			</div>

			<ReportDialog
				open={Boolean(reportCommentId)}
				onOpenChange={open => {
					if (!open) setReportCommentId(null);
				}}
				targetType="COMMENT"
				targetId={reportCommentId ?? ''}
				title="Report comment"
				description="Tell us what is wrong with this comment."
			/>
		</section>
	);
}
