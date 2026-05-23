import makeBlockie from 'ethereum-blockies-base64';
import { Check, Copy, LogIn, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';
import ProfileModal from './ProfileModal';

export default function Header() {
	const navigate = useNavigate();
	const user = useAuthStore(state => state.user);
	const [isAuthenticated, setIsAuthenticated] = useState(
		!!user && authService.isAuthenticated()
	);
	const [isAuthBusy, setIsAuthBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);

	const copyWallet = async () => {
		if (!user?.walletAddress) return;
		await navigator.clipboard.writeText(user.walletAddress);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	useEffect(() => {
		setIsAuthenticated(!!user && authService.isAuthenticated());
	}, [user]);

	const handleLogout = async () => {
		try {
			setIsAuthBusy(true);
			await authService.logout();
		} catch (error) {
			console.error('Logout failed:', error);
		} finally {
			setIsAuthBusy(false);
		}
	};

	const blockie = user ? makeBlockie(user.email ?? user.id) : null;

	return (
		<>
		<header className="fixed inset-x-0 top-0 z-50 border-b border-surface-3 bg-surface-0/90 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				{/* Logo */}
				<Link
					to="/"
					className="flex items-center gap-1 font-ps2p text-sm uppercase text-gold-base"
				>
					<img
						src="/icons/logo.svg"
						alt="Tetrode logo"
						className="h-5 w-5 shrink-0"
					/>
					<span>tetrode</span>
				</Link>

				{/* Nav */}
				<nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-xs text-text-muted md:flex">
					{[
						{ label: 'Leaderboard', href: '/leaderboard', external: false },
						{ label: 'Twitter', href: 'https://x.com/tetrodegames', external: true },
						{ label: 'Telegram', href: 'https://t.me/tetrodegames', external: true },
						{ label: 'About', href: '/about', external: false },
					].map(({ label, href, external }) =>
						external ? (
							<a
								key={label}
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="uppercase tracking-widest transition-colors hover:text-text-primary"
							>
								{label}
							</a>
						) : (
							<Link
								key={label}
								to={href}
								className="uppercase tracking-widest transition-colors hover:text-text-primary"
							>
								{label}
							</Link>
						)
					)}
				</nav>

				{/* Right side */}
				<div className="flex items-center gap-3">
					{isAuthenticated && user ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="group flex items-center gap-2.5 rounded-sm border border-surface-3 bg-surface-1 py-1.5 pl-1.5 pr-3 transition-all hover:border-surface-4 hover:bg-surface-2 focus:outline-none"
								>
									{/* Blockie avatar */}
									<img
										src={blockie!}
										alt={user.name}
										className="size-7 rounded-sm"
									/>
									{/* Name truncated */}
									<span className="max-w-[96px] truncate font-ps2p text-[8px] uppercase tracking-wider text-text-secondary group-hover:text-text-primary">
										{user.name}
									</span>
								</button>
							</DropdownMenuTrigger>

							<DropdownMenuContent
								align="end"
								sideOffset={8}
								className="w-60 rounded-sm border border-surface-3 bg-surface-1 p-1 shadow-xl"
							>
								{/* User info */}
								<div className="flex items-center gap-3 px-3 py-3">
									<img
										src={blockie!}
										alt={user.name}
										className="size-10 rounded-sm"
									/>
									<div className="min-w-0">
										<p className="truncate font-manrope text-sm font-semibold text-text-primary">
											{user.name}
										</p>
										<p className="truncate text-[11px] text-text-muted">
											{user.email}
										</p>
									</div>
								</div>

								<DropdownMenuSeparator className="bg-surface-3" />

								{/* Wallet address display */}
								{user.walletAddress && (
									<div className="px-3 py-2">
										<span className="font-ps2p text-[7px] uppercase tracking-wider text-text-muted">
											{user.walletAddress.slice(0, 6)}…{user.walletAddress.slice(-4)}
										</span>
									</div>
								)}

								<DropdownMenuSeparator className="bg-surface-3" />

								{user.walletAddress && (
									<DropdownMenuItem
										className="flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus:bg-surface-2 focus:text-text-primary"
										onClick={() => void copyWallet()}
									>
										{copied ? (
											<Check className="size-3.5 shrink-0 text-success" />
										) : (
											<Copy className="size-3.5 shrink-0" />
										)}
										{copied ? 'Copied!' : 'Copy Wallet'}
									</DropdownMenuItem>
								)}

								<DropdownMenuItem
									className="flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus:bg-surface-2 focus:text-text-primary"
									onClick={() => setProfileOpen(true)}
								>
									<User className="size-3.5 shrink-0" />
									Profile
								</DropdownMenuItem>

								<DropdownMenuSeparator className="bg-surface-3" />

								<DropdownMenuItem
									className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-terracotta-bright transition-colors hover:bg-terracotta/10 focus:bg-terracotta/10 focus:text-terracotta-bright"
									disabled={isAuthBusy}
									onClick={() => void handleLogout()}
								>
									<LogOut className="size-3.5 shrink-0" />
									{isAuthBusy ? 'Leaving...' : 'Logout'}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<button
							type="button"
							onClick={() => navigate('/auth/signup')}
							className="flex items-center gap-2 rounded-sm border border-gold-base/40 bg-gold-base/10 px-4 py-2 font-ps2p text-[9px] uppercase tracking-wider text-gold-base transition-all hover:border-gold-base hover:bg-gold-base hover:text-surface-0"
						>
							<LogIn className="size-3.5" />
							Register
						</button>
					)}
				</div>
			</div>
		</header>

		<ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
		</>
	);
}
