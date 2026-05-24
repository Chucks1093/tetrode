import { Link } from 'react-router';

const navLinks = [
	{ label: 'Leaderboard', href: '/leaderboard', external: false },
	{ label: 'Twitter', href: 'https://x.com/tetrodegames', external: true },
	{ label: 'Community', href: 'https://t.me/tetrodegames', external: true },
	{ label: 'About', href: '/about', external: false },
];

const legalLinks = [
	{ label: 'Privacy Policy', href: '/privacy-policy', external: false },
	{ label: 'Terms of Use', href: '/terms', external: false },
];

export default function Footer() {
	return (
		<footer className="mt-14 border-t border-surface-3">
			<div className="mx-auto max-w-6xl px-1 pt-10">
				{/* Top row */}
				<div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
					{/* Brand */}
					<Link
						to="/"
						className="font-ps2p text-sm uppercase text-gold-base"
					>
						tetrode
					</Link>

					{/* Nav links */}
					<nav className="flex flex-wrap gap-x-8 gap-y-3">
						{navLinks.map(({ label, href, external }) =>
							external ? (
								<a
									key={label}
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
								>
									{label}
								</a>
							) : (
								<Link
									key={label}
									to={href}
									className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
								>
									{label}
								</Link>
							)
						)}
					</nav>
				</div>

				{/* Divider */}
				<div className="my-8 border-t border-surface-3" />

				{/* Bottom row */}
				<div className="flex flex-col items-start justify-between gap-4 pb-8 sm:flex-row sm:items-center">
					<p className="text-[11px] text-text-muted">
						© {new Date().getFullYear()} Tetrode. Humans vs AI — may the
						best mind win.
					</p>

					<nav className="flex flex-wrap gap-x-6 gap-y-2">
						{legalLinks.map(({ label, href }) => (
							<Link
								key={label}
								to={href}
								className="text-[11px] text-text-muted transition-colors hover:text-text-primary"
							>
								{label}
							</Link>
						))}
					</nav>
				</div>
			</div>
		</footer>
	);
}
