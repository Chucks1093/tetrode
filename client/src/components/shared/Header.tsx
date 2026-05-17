import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Link } from 'react-router';
import { authService } from '@/services/auth.service';
import AuthModal from './AuthModal';

export default function Header() {
	const [isAuthenticated, setIsAuthenticated] = useState(
		authService.isAuthenticated()
	);
	const [isAuthBusy, setIsAuthBusy] = useState(false);
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

	useEffect(() => {
		return authService.subscribe(() => {
			setIsAuthenticated(authService.isAuthenticated());
		});
	}, []);

	const handleAuthClick = async () => {
		if (!authService.isAuthenticated()) {
			setIsAuthModalOpen(true);
			return;
		}

		try {
			setIsAuthBusy(true);
			await authService.logout();
		} catch (error) {
			console.error('Privy auth failed:', error);
		} finally {
			setIsAuthBusy(false);
		}
	};

	return (
		<header className="fixed inset-x-0 top-0 z-50 border-b border-surface-3 bg-surface-0/90 backdrop-blur">
			<AuthModal
				open={isAuthModalOpen}
				onOpenChange={setIsAuthModalOpen}
			/>
			<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<Link
					to="/"
					className="font-ps2p text-sm uppercase text-gold-base"
				>
					tetrode
				</Link>

				<nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-xs text-text-muted md:flex">
					<a
						className="uppercase tracking-widest transition-colors hover:text-text-primary"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Leaderboard
					</a>
					<a
						className="uppercase tracking-widest transition-colors hover:text-text-primary"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Twitter
					</a>
					<a
						className="uppercase tracking-widest transition-colors hover:text-text-primary"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						Community
					</a>
					<a
						className="uppercase tracking-widest transition-colors hover:text-text-primary"
						href="#"
						target="_blank"
						rel="noreferrer"
					>
						About
					</a>
				</nav>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleAuthClick}
						disabled={isAuthBusy}
						className="flex items-center gap-2 rounded-sm border border-gold-base/40 bg-gold-base/10 px-4 py-2 font-ps2p text-[9px] uppercase tracking-wider text-gold-base transition-all hover:border-gold-base hover:bg-gold-base hover:text-surface-0"
					>
						<LogIn className="size-3.5" />
						{isAuthenticated
							? isAuthBusy
								? 'Leaving'
								: 'Logout'
							: isAuthBusy
								? 'Opening'
								: 'Register'}
					</button>
				</div>
			</div>
		</header>
	);
}
