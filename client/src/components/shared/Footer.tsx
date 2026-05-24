import { Link } from 'react-router';

const navLinks = ['Leaderboard', 'Twitter', 'Community', 'About'];

const legalLinks = ['Privacy Policy', 'Terms of Use', 'Cookie Preferences'];

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
						{navLinks.map(label => (
							<span
								key={label}
								className="font-ps2p text-[8px] uppercase tracking-widest text-text-muted"
							>
								{label}
							</span>
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
						{legalLinks.map(label => (
							<span
								key={label}
								className="text-[11px] text-text-muted"
							>
								{label}
							</span>
						))}
					</nav>
				</div>
			</div>
		</footer>
	);
}
