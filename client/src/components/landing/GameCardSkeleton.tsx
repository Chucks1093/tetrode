import { Skeleton } from '@/components/ui/skeleton';

export default function GameCardSkeleton() {
	return (
		<article className="overflow-hidden rounded-3xl border border-odin-dark-500 bg-odin-dark-300 p-2 shadow-sm">
			<div className="relative h-[12rem] overflow-hidden rounded-3xl sm:h-[14rem]">
				<Skeleton className="h-full w-full rounded-3xl" />
				<Skeleton className="absolute right-3 top-3 h-8 w-28 rounded-full" />
			</div>

			<div className="p-4">
				<Skeleton className="h-7 w-2/3 rounded-lg" />
				<Skeleton className="mt-3 h-4 w-full rounded-lg" />
				<Skeleton className="mt-2 h-4 w-5/6 rounded-lg" />

				<div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-odin-dark-500 py-4">
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-5 rounded-full" />
						<Skeleton className="h-4 w-20 rounded-lg" />
					</div>

					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-5 rounded-full" />
						<Skeleton className="h-4 w-20 rounded-lg" />
					</div>
				</div>

				<Skeleton className="mt-3 h-11 w-full rounded-lg" />
			</div>
		</article>
	);
}
