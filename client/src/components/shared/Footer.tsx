import { Link } from 'react-router';

const navLinks = [
	{ label: 'Leaderboard', href: '#' },
	{ label: 'Twitter', href: '#' },
	{ label: 'Community', href: '#' },
	{ label: 'About', href: '#' },
];

const legalLinks = [
	{ label: 'Privacy Policy', href: '#' },
	{ label: 'Terms of Use', href: '#' },
	{ label: 'Cookie Preferences', href: '#' },
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
						{navLinks.map(link => (
							<a
								key={link.label}
								href={link.href}
								className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
							>
								{link.label}
							</a>
						))}
					</nav>
				</div>

				{/* Divider */}
				<div className="my-8 border-t border-surface-3" />

				{/* Bottom row */}
				<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
					<p className="text-[11px] text-text-muted">
						© {new Date().getFullYear()} Tetrode. Humans vs AI — may the
						best mind win.
					</p>

					<nav className="flex flex-wrap gap-x-6 gap-y-2">
						{legalLinks.map(link => (
							<a
								key={link.label}
								href={link.href}
								className="text-[11px] text-text-muted transition-colors hover:text-text-secondary"
							>
								{link.label}
							</a>
						))}
					</nav>
				</div>
			</div>
		</footer>
	);
}
