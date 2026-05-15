import { ExternalLink, Milestone } from 'lucide-react';
import type { StoryDetail } from '@/services/story.service';

type TimelineEvent = {
	id: string;
	at: Date;
	title: string;
	description: string;
	url?: string;
};

function formatTimelineDate(value: Date): string {
	return value.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function buildTimelineEvents(story: StoryDetail): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	if (story.trend?.publishedAt) {
		events.push({
			id: 'trend-published',
			at: new Date(story.trend.publishedAt),
			title: 'Trend surfaced',
			description: 'First known publication time for this trend',
		});
	}

	events.push({
		id: 'story-created',
		at: new Date(story.createdAt),
		title: 'Story published on Proofline',
		description: 'Initial version went live',
	});

	if (story.updatedAt && story.updatedAt !== story.createdAt) {
		events.push({
			id: 'story-updated',
			at: new Date(story.updatedAt),
			title: 'Story updated',
			description: 'New evidence and context were added',
		});
	}

	story.citations
		.filter(citation => Boolean(citation.publishedAt))
		.forEach(citation => {
			events.push({
				id: `citation-${citation.rank}`,
				at: new Date(citation.publishedAt as string),
				title: `${citation.publisher} published`,
				description: `${citation.publisher}: ${citation.title}`,
				url: citation.url,
			});
		});

	return events
		.filter(event => !Number.isNaN(event.at.getTime()))
		.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export default function StoryTimeline({ story }: { story: StoryDetail }) {
	const events = buildTimelineEvents(story);
	if (events.length === 0) return null;

	return (
		<section className="min-w-0">
			<div className="mb-4 flex items-center gap-2">
				<Milestone className="size-4 text-odin-dark-1000-a-65" />
				<h2 className="text-sm font-semibold text-odin-dark-1000 sm:text-base">
					Story Timeline
				</h2>
			</div>

			<div className="space-y-4">
				{events.map((event, index) => (
					<div key={event.id} className="flex gap-3">
						<div className="relative flex w-2 shrink-0 justify-center">
							<span className="mt-1 size-2 rounded-full bg-odin-dark-1000-a-65" />
							{index < events.length - 1 ? (
								<span className="absolute left-1/2 top-4 h-[calc(100%+1rem)] w-px -translate-x-1/2 bg-odin-dark-500" />
							) : null}
						</div>

						<div className="min-w-0 pb-1">
							<p className="text-xs text-odin-dark-1000-a-65">
								{formatTimelineDate(event.at)}
							</p>
							<p className="mt-1 text-sm font-semibold text-odin-dark-1000">
								{event.title}
							</p>
							<p className="mt-1 text-sm text-odin-dark-1000-a-65">
								{event.description}
							</p>
							{event.url ? (
								<a
									href={event.url}
									target="_blank"
									rel="noreferrer"
									className="mt-1 inline-flex items-center gap-1 text-xs text-odin-dark-1000-a-65 underline-offset-2 hover:text-odin-dark-1000 hover:underline"
								>
									Open source
									<ExternalLink className="size-3" />
								</a>
							) : null}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
