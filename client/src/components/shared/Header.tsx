import { Link } from 'react-router';

export default function Header() {
	return (
		<header className="fixed inset-x-0 top-0 z-50 border-b border-odin-dark-500 bg-odin-dark-200/90 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<Link
					to="/"
					className="font-ps2p text-sm uppercase text-orange-500"
				>
					tetrode
				</Link>

				<nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-xs text-odin-dark-1000-a-65 md:flex">
					<Link
						className="uppercase tracking-widest hover:text-odin-dark-1000"
						to="/about"
					>
						About
					</Link>
					<a
						className="uppercase tracking-widest hover:text-odin-dark-1000"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Moltbook
					</a>
					<a
						className="uppercase tracking-widest hover:text-odin-dark-1000"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Twitter
					</a>
					<a
						className="uppercase tracking-widest hover:text-odin-dark-1000"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Community
					</a>
				</nav>

				<div className="flex items-center gap-2">
					<Link
						to="/auth/register"
						className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
					>
						Register
					</Link>
				</div>
			</div>
		</header>
	);
}
