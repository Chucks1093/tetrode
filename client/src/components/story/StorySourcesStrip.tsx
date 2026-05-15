import { ArrowRight, Origami } from 'lucide-react';
import type { StoryCitation } from '@/services/story.service';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';

type StorySourcesStripProps = {
	citations: StoryCitation[];
	headline: string;
};

export default function StorySourcesStrip({
	citations,
	headline,
}: StorySourcesStripProps) {
	const showOverflow = citations.length > 4;

	return (
		<div className="mt-5 w-full min-w-0 max-w-full">
			<div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-xl">
				<div className="flex w-full min-w-0 gap-2 overflow-hidden pr-14 sm:gap-3 sm:pr-16">
					{citations.map(citation => (
						<a
							key={`${citation.rank}-${citation.url}`}
							href={citation.url}
							target="_blank"
							rel="noreferrer"
							className="w-[min(74vw,205px)] max-w-[205px] shrink-0 rounded-xl border border-odin-dark-500 bg-odin-dark-300 px-2.5 py-2 transition hover:bg-odin-dark-400 sm:px-3"
						>
							<div className="flex items-center gap-2 text-odin-dark-1000-a-65">
								{citation.faviconUrl ? (
									<img
										src={citation.faviconUrl}
										alt={`${citation.publisher} favicon`}
										className="size-4 rounded-full"
										loading="lazy"
									/>
								) : (
									<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-odin-dark-500 text-[10px]">
										{citation.publisher.slice(0, 2).toUpperCase()}
									</span>
								)}
								<span className="line-clamp-1 text-[11px] lowercase text-ellipsis sm:text-xs">
									{citation.publisher}
								</span>
							</div>
							<p className="mt-2 line-clamp-2 text-xs leading-snug text-zinc-400 sm:text-sm">
								{citation.title}
							</p>
						</a>
					))}
				</div>

				{showOverflow ? (
					<Sheet>
						<div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-odin-dark-200 via-odin-dark-200/85 to-transparent" />
						<SheetTrigger asChild>
							<button
								type="button"
								className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-odin-dark-500 bg-odin-dark-300 text-odin-dark-1000 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-odin-dark-400 sm:h-10 sm:w-10"
								aria-label="Open all sources"
							>
								<ArrowRight size={18} />
							</button>
						</SheetTrigger>
						<SheetContent className="border-odin-dark-500 bg-odin-dark-200 p-0 text-odin-dark-1000 sm:max-w-lg">
							<SheetHeader className="px-4 pb-1 pt-5 pr-14 sm:px-6 sm:pt-6">
								<SheetTitle className="font-gelasio flex items-center gap-2.5 text-xl font-medium text-odin-dark-1000 sm:gap-3 sm:text-2xl">
									<Origami
										size={22}
										className="text-odin-dark-1000-a-65"
									/>
									{citations.length} sources
								</SheetTitle>
								<SheetDescription className="pt-1 text-sm text-odin-dark-1000-a-65 sm:text-[0.95rem]">
									{headline}
								</SheetDescription>
							</SheetHeader>

							<div className="mt-1 space-y-2.5 overflow-y-auto px-4 pb-5 sm:space-y-3 sm:px-6 sm:pb-6 [scrollbar-width:thin] [scrollbar-color:var(--odin-dark-600)_var(--odin-dark-200)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-odin-dark-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-odin-dark-200 [&::-webkit-scrollbar-thumb]:bg-odin-dark-600 [&::-webkit-scrollbar-thumb:hover]:bg-odin-dark-700">
								{citations.map(citation => (
									<a
										key={`${citation.rank}-${citation.url}-sheet`}
										href={citation.url}
										target="_blank"
										rel="noreferrer"
										className="block rounded-lg border border-odin-dark-500 bg-odin-dark-300 px-3.5 py-3 transition hover:bg-odin-dark-400 sm:px-4"
									>
										<div className="flex items-center gap-2 text-odin-dark-1000-a-65">
											{citation.faviconUrl ? (
												<img
													src={citation.faviconUrl}
													alt={`${citation.publisher} favicon`}
													className="size-4 rounded-full"
													loading="lazy"
												/>
											) : (
												<span className="inline-flex size-5 items-center justify-center rounded-full bg-odin-dark-500 text-[10px]">
													{citation.publisher
														.slice(0, 2)
														.toUpperCase()}
												</span>
											)}
											<span className="text-sm lowercase text-odin-dark-1000-a-65 sm:text-[0.95rem]">
												{citation.publisher}
											</span>
										</div>

										<p className="mt-2 line-clamp-2 text-ellipsis font-gelasio text-sm leading-snug text-odin-dark-1000 sm:text-md">
											{citation.title}
										</p>

										<p className="mt-2 text-xs leading-relaxed text-odin-dark-1000-a-65 sm:text-sm">
											{citation.snippet}
										</p>
									</a>
								))}
							</div>
						</SheetContent>
					</Sheet>
				) : null}
			</div>
		</div>
	);
}
