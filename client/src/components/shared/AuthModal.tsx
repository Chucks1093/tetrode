'use client';

import { Check, ChevronRight, Copy, Eye, EyeOff, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp';
import { useEnsurePrivyWallet } from '@/hooks/auth/useEnsurePrivyWallet';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';
import showToast from '@/utils/toast.util';

interface AuthModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialMode?: AuthMode;
}

type AuthMode = 'signin' | 'signup' | 'verify' | 'onboarding' | 'wallet';

export default function AuthModal({
	open,
	onOpenChange,
	initialMode = 'signin',
}: AuthModalProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const currentUser = useAuthStore(state => state.user);
	const { ensureWallet } = useEnsurePrivyWallet();
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const [name, setName] = useState('');
	const [walletAddress, setWalletAddress] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [otp, setOtp] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [walletLoading, setWalletLoading] = useState(false);
	const [walletCopied, setWalletCopied] = useState(false);
	const [timeLeft, setTimeLeft] = useState(45);
	const [canResend, setCanResend] = useState(false);

	const copyWalletAddress = async () => {
		if (!walletAddress) return;
		await navigator.clipboard.writeText(walletAddress);
		setWalletCopied(true);
		setTimeout(() => setWalletCopied(false), 2000);
	};

	const isSignUp = mode === 'signup';
	const isVerify = mode === 'verify';
	const isOnboarding = mode === 'onboarding';
	const isWalletStep = mode === 'wallet';

	useEffect(() => {
		if (!open) {
			setMode(initialMode);
			setName('');
			setWalletAddress('');
			setEmail('');
			setPassword('');
			setOtp('');
			setShowPassword(false);
			setLoading(false);
			setWalletLoading(false);
			setTimeLeft(45);
			setCanResend(false);
		}
	}, [initialMode, open]);

	useEffect(() => {
		if (!open) return;
		setMode(initialMode);
		if (initialMode === 'onboarding') {
			if (currentUser?.name) setName(currentUser.name);
			if (currentUser?.walletAddress) setWalletAddress(currentUser.walletAddress);
		}
	}, [currentUser?.name, initialMode, open]);

	useEffect(() => {
		if (!open || !isVerify) return;
		if (timeLeft <= 0) { setCanResend(true); return; }
		const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
		return () => clearTimeout(timer);
	}, [isVerify, open, timeLeft]);

	useEffect(() => {
		if (!open || !isOnboarding || walletAddress || walletLoading) return;
		let active = true;
		async function prepareWallet() {
			try {
				setWalletLoading(true);
				const addr = await ensureWallet();
				if (!active) return;
				setWalletAddress(addr);
			} catch (error) {
				if (!active) return;
				showToast.error(error instanceof Error ? error.message : 'Could not initialize wallet');
			} finally {
				if (active) setWalletLoading(false);
			}
		}
		void prepareWallet();
		return () => { active = false; };
	}, [ensureWallet, isOnboarding, open, walletAddress, walletLoading]);

	const deriveNameFromEmail = (value: string) => {
		const localPart = value.split('@')[0]?.trim() ?? '';
		const normalized = localPart.replace(/[._-]+/g, ' ').trim();
		return normalized.length >= 2 ? normalized : 'Player';
	};

	const openVerifyStep = () => { setMode('verify'); setOtp(''); setTimeLeft(45); setCanResend(false); };
	const openOnboardingStep = (nextName?: string) => { setMode('onboarding'); setName(nextName ?? currentUser?.name ?? ''); };
	const openWalletStep = (address: string) => { setWalletAddress(address); setMode('wallet'); };

	const finishAuthFlow = () => {
		const redirectFromQuery = searchParams.get('redirect');
		const redirectTarget = redirectFromQuery || authService.consumeRedirectAfterLogin();
		if (redirectTarget && redirectTarget.startsWith('/')) {
			onOpenChange(false);
			navigate(redirectTarget, { replace: true });
			return;
		}
		onOpenChange(false);
	};

	const handleSignIn = async () => {
		if (!email.trim() || !password.trim()) { showToast.error('Enter your email and password.'); return; }
		try {
			setLoading(true);
			await authService.login(email.trim(), password);
			showToast.success('Login successful');
			finishAuthFlow();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Login failed';
			if (message.toLowerCase().includes('verify your email')) {
				showToast.error('Verify your email first.');
				openVerifyStep();
				return;
			}
			showToast.error(message);
		} finally { setLoading(false); }
	};

	const handleSignUp = async () => {
		if (!email.trim() || !password.trim()) { showToast.error('Enter your email and password.'); return; }
		try {
			setLoading(true);
			await authService.register({ name: deriveNameFromEmail(email.trim()), email: email.trim(), password });
			showToast.success('Verification code sent to your email');
			openVerifyStep();
		} catch (error) {
			showToast.error(error instanceof Error ? error.message : 'Registration failed');
		} finally { setLoading(false); }
	};

	const handleVerify = async () => {
		if (otp.trim().length !== 6) { showToast.error('Enter the 6-digit code.'); return; }
		try {
			setLoading(true);
			await authService.verifyEmail(email.trim(), otp.trim());
			showToast.success('Email verified');
			openOnboardingStep(deriveNameFromEmail(email.trim()));
		} catch (error) {
			showToast.error(error instanceof Error ? error.message : 'Invalid OTP');
		} finally { setLoading(false); }
	};

	const handleResend = async () => {
		if (!canResend || !email.trim()) return;
		try {
			setLoading(true);
			await authService.resendVerification(email.trim());
			showToast.success('Code resent');
			setOtp(''); setTimeLeft(45); setCanResend(false);
		} catch (error) {
			showToast.error(error instanceof Error ? error.message : 'Could not resend code');
		} finally { setLoading(false); }
	};

	const handleContinue = async () => {
		if (isOnboarding) {
			if (!name.trim() || name.trim().length < 2) { showToast.error('Enter your name.'); return; }
			try {
				setLoading(true);
				await authService.updateProfile({ name: name.trim() });
				const addr = walletAddress || currentUser?.walletAddress || (await ensureWallet());
				setWalletAddress(addr);
				showToast.success('Profile updated');
				openWalletStep(addr);
			} catch (error) {
				showToast.error(error instanceof Error ? error.message : 'Could not save name');
			} finally { setLoading(false); }
			return;
		}
		if (isWalletStep) { finishAuthFlow(); return; }
		if (isVerify) { await handleVerify(); return; }
		if (isSignUp) { await handleSignUp(); return; }
		await handleSignIn();
	};

	const handleGoogleSignIn = () => {
		const redirectFromQuery = searchParams.get('redirect');
		if (redirectFromQuery) authService.setRedirectAfterLogin(redirectFromQuery);
		authService.startGoogleAuth();
	};

	const handleAuthKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter' || loading) return;
		event.preventDefault();
		await handleContinue();
	};

	const title = isWalletStep
		? 'Wallet ready'
		: isOnboarding
		? 'What should we call you?'
		: isVerify
		? 'Check your email'
		: isSignUp
		? 'Create account'
		: 'Welcome back';

	const subtitle = isWalletStep
		? 'Your embedded wallet is set up and linked to your account.'
		: isOnboarding
		? 'This name is what other players will see in-game.'
		: isVerify
		? `Enter the 6-digit code sent to ${email || 'your email'}`
		: isSignUp
		? 'Sign up to start playing on Tetrode.'
		: 'Sign in to continue to Tetrode.';

	const ctaLabel = loading
		? isOnboarding ? 'Saving…'
		: isVerify ? 'Verifying…'
		: isSignUp ? 'Creating…'
		: 'Signing in…'
		: isWalletStep ? 'Enter Tetrode'
		: isOnboarding ? 'Continue'
		: isVerify ? 'Verify'
		: 'Continue';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="overflow-hidden rounded-xl border border-surface-3 bg-surface-1 p-0 text-text-primary shadow-2xl sm:max-w-[380px]"
			>
				{/* Close button */}
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
					aria-label="Close"
				>
					<X className="size-4" />
				</button>

				<div className="px-6 pb-5 pt-10">
					{/* Logo mark */}
					<div className="flex justify-center">
						<img src="/icons/logo.svg" alt="Tetrode" className="h-12 w-12" />
					</div>

					{/* Title */}
					<div className="mt-4 text-center">
						<DialogTitle className="font-ps2p text-[13px] uppercase tracking-wide text-text-primary">
							{title}
						</DialogTitle>
						<DialogDescription className="mt-2 text-[11px] text-text-muted">
							{subtitle}
						</DialogDescription>
					</div>

					{/* Body */}
					<div className="mt-5">
						{isWalletStep ? (
							<div className="space-y-3">
								<div>
									<p className="mb-1.5 text-xs font-medium text-text-secondary">
										Your wallet address
									</p>
									<div className="flex items-center gap-2 rounded-md border border-surface-3 bg-surface-2 px-3 py-2.5">
										<span className="flex-1 break-all font-ps2p text-[7px] leading-relaxed text-text-secondary">
											{walletAddress}
										</span>
										<button
											type="button"
											onClick={() => void copyWalletAddress()}
											className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
											aria-label="Copy wallet address"
										>
											{walletCopied
												? <Check className="size-3.5 text-success" />
												: <Copy className="size-3.5" />}
										</button>
									</div>
								</div>

							</div>
						) : isOnboarding ? (
							<div>
								<label className="mb-1.5 block text-xs font-medium text-text-secondary">
									Display name
								</label>
								<Input
									type="text"
									value={name}
									onChange={e => setName(e.target.value)}
									onKeyDown={handleAuthKeyDown}
									placeholder="Enter your name"
									className="h-10 rounded-md border-surface-3 bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20 dark:bg-surface-2"
								/>
								<p className="mt-1.5 text-[10px] text-text-muted">
									{walletLoading
										? 'Preparing wallet in the background…'
										: walletAddress
										? 'Wallet ready and linked.'
										: 'Your wallet will be set up automatically.'}
								</p>
							</div>
						) : !isVerify ? (
							<>
								{/* Google */}
								<Button
									type="button"
									onClick={handleGoogleSignIn}
									className="h-9 w-full rounded-md border border-surface-3 bg-transparent text-xs text-text-muted shadow-none hover:bg-surface-2 hover:text-text-primary"
								>
									<img
										src="/icons/google.svg"
										alt="Google"
										className="size-4 shrink-0"
										onError={e => { e.currentTarget.style.display = 'none'; }}
									/>
									Continue with Google
								</Button>

								<div className="my-4 flex items-center gap-3">
									<div className="h-px flex-1 bg-surface-3" />
									<span className="text-[11px] text-text-muted">or</span>
									<div className="h-px flex-1 bg-surface-3" />
								</div>

								<div className="space-y-3">
									<div>
										<label className="mb-1.5 block text-xs font-medium text-text-secondary">
											Email
										</label>
										<Input
											type="email"
											value={email}
											onChange={e => setEmail(e.target.value)}
											onKeyDown={handleAuthKeyDown}
											placeholder="you@example.com"
											className="h-10 rounded-md border-surface-3 bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20 dark:bg-surface-2"
										/>
									</div>

									<div>
										<label className="mb-1.5 block text-xs font-medium text-text-secondary">
											Password
										</label>
										<div className="relative">
											<Input
												type={showPassword ? 'text' : 'password'}
												value={password}
												onChange={e => setPassword(e.target.value)}
												onKeyDown={handleAuthKeyDown}
												placeholder="••••••••"
												className="h-10 rounded-md border-surface-3 bg-surface-2 px-3 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20 dark:bg-surface-2"
											/>
											<button
												type="button"
												onClick={() => setShowPassword(v => !v)}
												className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
												aria-label={showPassword ? 'Hide password' : 'Show password'}
											>
												{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
											</button>
										</div>
										{isSignUp && (
											<p className="mt-1 text-[10px] text-text-muted">
												8+ chars with uppercase, lowercase, and a number.
											</p>
										)}
									</div>
								</div>
							</>
						) : (
							/* OTP */
							<div className="flex flex-col items-center gap-3">
								<InputOTP
									maxLength={6}
									value={otp}
									onChange={setOtp}
									onComplete={() => { void handleVerify(); }}
								>
									<InputOTPGroup className="gap-1.5">
										{Array.from({ length: 6 }).map((_, index) => (
											<InputOTPSlot
												key={index}
												index={index}
												className="h-10 w-10 rounded-md border border-surface-3 bg-surface-2 text-sm text-text-primary first:rounded-md first:border last:rounded-md"
											/>
										))}
									</InputOTPGroup>
								</InputOTP>

								<p className="text-[11px] text-text-muted">
									Didn&apos;t get it?{' '}
									{canResend ? (
										<button
											type="button"
											onClick={handleResend}
											className="font-medium text-text-primary transition-colors hover:text-gold-bright"
										>
											Resend
										</button>
									) : (
										<span>Resend in {timeLeft}s</span>
									)}
								</p>
							</div>
						)}

						{/* CTA */}
						<Button
							type="button"
							disabled={loading}
							onClick={handleContinue}
							className="mt-5 h-10 w-full gap-1 rounded-md bg-white text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
						>
							{ctaLabel}<ChevronRight className="size-[18px] text-black" />
						</Button>
					</div>
				</div>

				{/* Footer */}
				<div className="border-t border-surface-3 bg-surface-2 px-6 py-3 text-center">
					<p className="text-[11px] text-text-muted">
						{isWalletStep ? (
							<>You can export this wallet later from your profile.</>
						) : isOnboarding ? (
							<>
								Wrong account?{' '}
								<button type="button" onClick={() => setMode('signin')} className="font-medium text-text-primary underline underline-offset-2 hover:text-gold-bright">
									Sign in
								</button>
							</>
						) : isVerify ? (
							<>
								Wrong email?{' '}
								<button type="button" onClick={() => setMode('signup')} className="font-medium text-text-primary underline underline-offset-2 hover:text-gold-bright">
									Go back
								</button>
							</>
						) : isSignUp ? (
							<>
								Already have an account?{' '}
								<button type="button" onClick={() => setMode('signin')} className="font-medium text-text-primary underline underline-offset-2 hover:text-gold-bright">
									Sign in
								</button>
							</>
						) : (
							<>
								No account?{' '}
								<button type="button" onClick={() => setMode('signup')} className="font-medium text-text-primary underline underline-offset-2 hover:text-gold-bright">
									Sign up
								</button>
							</>
						)}
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
