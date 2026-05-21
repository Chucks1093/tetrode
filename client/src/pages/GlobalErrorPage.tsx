import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

type GlobalErrorPageProps = {
	title?: string;
	description?: string;
	showErrorDetails?: boolean;
};

export default function GlobalErrorPage({
	title,
	description,
	showErrorDetails = true,
}: GlobalErrorPageProps) {
	const routeError = useRouteError();

	let resolvedTitle = title ?? 'Something went wrong';
	let resolvedDescription =
		description ?? 'An unexpected error happened. Go back home and try again.';

	if (!title && showErrorDetails && routeError) {
		if (isRouteErrorResponse(routeError)) {
			if (routeError.status === 404) {
				resolvedTitle = 'Page not found';
				resolvedDescription =
					'This page does not exist. It may have moved or never existed at all.';
			} else {
				resolvedTitle = `${routeError.status} ${routeError.statusText}`;
				resolvedDescription =
					typeof routeError.data === 'string'
						? routeError.data
						: 'Something went wrong while loading this page.';
			}
		} else if (routeError instanceof Error) {
			resolvedDescription = routeError.message || resolvedDescription;
		}
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-text-primary">
			<section className="w-full max-w-md rounded-sm border border-surface-3 bg-surface-1 p-10 text-center">

				{/* Logo */}
				<div className="flex items-center justify-center gap-2">
					<img src="/icons/logo.svg" alt="Tetrode" className="h-8 w-8" />
					<span className="font-ps2p text-[9px] uppercase tracking-widest text-gold-base">
						Tetrode
					</span>
				</div>

				{/* Title */}
				<h1
					className="mt-8 font-game-paused text-3xl uppercase text-text-secondary"
					style={{
						transform: 'skewX(-6deg)',
						display: 'inline-block',
						textShadow:
							'2px 2px 0 #b8890f, 4px 4px 0 #8b6914, 6px 6px 0 rgba(107,81,15,0.3)',
					}}
				>
					{resolvedTitle}
				</h1>

				<p className="mt-4 font-jakarta text-sm leading-relaxed text-text-muted">
					{resolvedDescription}
				</p>

				<Link
					to="/"
					className="mx-auto mt-8 inline-flex items-center gap-2 rounded-sm border border-gold-base/40 bg-gold-base/10 px-6 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-gold-base transition-all hover:border-gold-base hover:bg-gold-base hover:text-surface-0"
				>
					Back to Arena
				</Link>
			</section>
		</main>
	);
}
