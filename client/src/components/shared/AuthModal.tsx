import { ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
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
import { authService } from '@/services/auth.service';
import showToast from '@/utils/toast.util';

interface AuthModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialMode?: AuthMode;
}

function CloverMark() {
	return (
		<div className="relative mx-auto h-10 w-10">
			<span className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-gold-bright" />
			<span className="absolute bottom-0 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-gold-bright" />
			<span className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-gold-bright" />
			<span className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-gold-bright" />
		</div>
	);
}

type AuthMode = 'signin' | 'signup' | 'verify' | 'onboarding';

export default function AuthModal({
	open,
	onOpenChange,
	initialMode = 'signin',
}: AuthModalProps) {
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [otp, setOtp] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [timeLeft, setTimeLeft] = useState(45);
	const [canResend, setCanResend] = useState(false);

	const isSignUp = mode === 'signup';
	const isVerify = mode === 'verify';
	const isOnboarding = mode === 'onboarding';

	useEffect(() => {
		if (!open) {
			setMode(initialMode);
			setName('');
			setEmail('');
			setPassword('');
			setOtp('');
			setShowPassword(false);
			setLoading(false);
			setTimeLeft(45);
			setCanResend(false);
		}
	}, [initialMode, open]);

	useEffect(() => {
		if (!open) return;
		setMode(initialMode);

		if (initialMode === 'onboarding') {
			const user = authService.getUser();
			if (user?.name) {
				setName(user.name);
			}
		}
	}, [initialMode, open]);

	useEffect(() => {
		if (!open || !isVerify) return;

		if (timeLeft <= 0) {
			setCanResend(true);
			return;
		}

		const timer = setTimeout(() => {
			setTimeLeft(current => current - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [isVerify, open, timeLeft]);

	const deriveNameFromEmail = (value: string) => {
		const localPart = value.split('@')[0]?.trim() ?? '';
		const normalized = localPart.replace(/[._-]+/g, ' ').trim();
		return normalized.length >= 2 ? normalized : 'Player';
	};

	const openVerifyStep = () => {
		setMode('verify');
		setOtp('');
		setTimeLeft(45);
		setCanResend(false);
	};

	const openOnboardingStep = (nextName?: string) => {
		setMode('onboarding');
		setName(nextName ?? authService.getUser()?.name ?? '');
	};

	const handleSignIn = async () => {
		if (!email.trim() || !password.trim()) {
			showToast.error('Enter your email and password.');
			return;
		}

		try {
			setLoading(true);
			await authService.login(email.trim(), password);
			showToast.success('Login successful');
			onOpenChange(false);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Login failed';

			if (message.toLowerCase().includes('verify your email')) {
				showToast.error('Verify your email first. Enter the OTP sent to you.');
				openVerifyStep();
				return;
			}

			showToast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const handleSignUp = async () => {
		if (!email.trim() || !password.trim()) {
			showToast.error('Enter your email and password.');
			return;
		}

		try {
			setLoading(true);
			await authService.register({
				name: deriveNameFromEmail(email.trim()),
				email: email.trim(),
				password,
			});
			showToast.success('Verification code sent to your email');
			openVerifyStep();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Registration failed';
			showToast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const handleVerify = async () => {
		if (otp.trim().length !== 6) {
			showToast.error('Enter the 6-digit verification code.');
			return;
		}

		try {
			setLoading(true);
			await authService.verifyEmail(email.trim(), otp.trim());
			showToast.success('Email verified successfully');
			openOnboardingStep(deriveNameFromEmail(email.trim()));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Invalid OTP';
			showToast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const handleResend = async () => {
		if (!canResend || !email.trim()) return;

		try {
			setLoading(true);
			await authService.resendVerification(email.trim());
			showToast.success('Verification code resent');
			setOtp('');
			setTimeLeft(45);
			setCanResend(false);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not resend code';
			showToast.error(message);
		} finally {
			setLoading(false);
		}
	};

	const handleContinue = async () => {
		if (isOnboarding) {
			if (!name.trim() || name.trim().length < 2) {
				showToast.error('Enter your name.');
				return;
			}

			try {
				setLoading(true);
				await authService.updateProfile({ name: name.trim() });
				showToast.success('Profile updated');
				onOpenChange(false);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Could not save name';
				showToast.error(message);
			} finally {
				setLoading(false);
			}
			return;
		}

		if (isVerify) {
			await handleVerify();
			return;
		}

		if (isSignUp) {
			await handleSignUp();
			return;
		}

		await handleSignIn();
	};

	const handleGoogleSignIn = () => {
		authService.startGoogleAuth();
	};

	const handleAuthKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter' || loading) return;
		event.preventDefault();
		await handleContinue();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-sm overflow-hidden rounded-xl border border-surface-3 bg-surface-1 p-0 text-text-primary shadow-2xl"
			>
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-5 top-5 z-10 flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
					aria-label="Close auth modal"
				>
					<X className="size-5" />
				</button>

				<div className="pb-6 pt-4 sm:px-8 sm:pb-7 sm:pt-10">
					<CloverMark />

					<div className="mt-4 text-center">
						<DialogTitle className="font-jakarta text-lg font-semibold text-text-primary">
						{isOnboarding
							? 'Tell us your name'
							: isVerify
								? 'Verify your email'
								: isSignUp
									? 'Create your account'
									: 'Sign in to Tetrode'}
						</DialogTitle>
						<DialogDescription className="mt-2 text-xs font-medium text-text-muted">
							{isOnboarding
								? 'This is the name other players will see in Tetrode.'
								: isVerify
								? `Enter the 6-digit code sent to ${email || 'your email'}`
								: isSignUp
									? 'Welcome! Please fill in the details to get started.'
									: 'Welcome back! Please sign in to continue'}
						</DialogDescription>
					</div>

					<div className="mt-6">
						{isOnboarding ? (
							<div>
								<label className="mb-2 block text-sm font-medium text-text-primary">
									Name
								</label>
								<Input
									type="text"
									value={name}
									onChange={e => setName(e.target.value)}
									onKeyDown={handleAuthKeyDown}
									placeholder="Enter your name"
									className="h-11 rounded-xl border-surface-3 bg-transparent px-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20"
								/>
							</div>
						) : !isVerify ? (
							<>
								<Button
									type="button"
									onClick={handleGoogleSignIn}
									className="h-11 w-full rounded-xl border border-surface-3 bg-transparent text-sm font-medium text-text-muted shadow-none hover:bg-surface-2"
								>
									<img
										src="/icons/google.svg"
										alt="Google"
										className="size-4.5"
										onError={e => {
											e.currentTarget.style.display = 'none';
										}}
									/>
									Continue with Google
								</Button>

								<div className="my-5 flex items-center gap-5">
									<div className="h-px flex-1 bg-surface-3" />
									<span className="text-sm text-text-muted">or</span>
									<div className="h-px flex-1 bg-surface-3" />
								</div>

								<div>
									<label className="mb-2 block text-sm font-medium text-text-primary">
										Email address
									</label>
									<Input
										type="email"
										value={email}
										onChange={e => setEmail(e.target.value)}
										onKeyDown={handleAuthKeyDown}
										placeholder="Enter your email address"
										className="h-11 rounded-xl border-surface-3 bg-transparent px-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20"
									/>
								</div>

								<div className="mt-5">
									<label className="mb-2 block text-sm font-medium text-text-primary">
										Password
									</label>
									<div className="relative">
										<Input
											type={showPassword ? 'text' : 'password'}
											value={password}
											onChange={e => setPassword(e.target.value)}
											onKeyDown={handleAuthKeyDown}
											placeholder="Enter your password"
											className="h-11 rounded-xl border-surface-3 bg-transparent px-4 pr-11 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20"
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(current => !current)
											}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
											aria-label={
												showPassword
													? 'Hide password'
													: 'Show password'
											}
										>
											{showPassword ? (
												<EyeOff className="size-4.5" />
											) : (
												<Eye className="size-4.5" />
											)}
										</button>
									</div>
									{isSignUp ? (
										<p className="mt-2 text-[11px] leading-5 text-text-muted">
											Use at least 8 characters with uppercase,
											lowercase, and a number.
										</p>
									) : null}
								</div>
							</>
						) : (
							<div className="mt-2 flex flex-col items-center">
								<InputOTP
									maxLength={6}
									value={otp}
									onChange={setOtp}
									onComplete={() => {
										void handleVerify();
									}}
								>
									<InputOTPGroup className="gap-2">
										{Array.from({ length: 6 }).map((_, index) => (
											<InputOTPSlot
												key={index}
												index={index}
												className="h-11 w-11 rounded-lg border border-surface-3 bg-surface-2 text-base text-text-primary first:rounded-lg first:border last:rounded-lg"
											/>
										))}
									</InputOTPGroup>
								</InputOTP>

								<p className="mt-4 text-xs text-text-muted">
									Didn&apos;t get code?{' '}
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

						<Button
							type="button"
							disabled={loading}
							onClick={handleContinue}
							className="mt-6 h-11 w-full rounded-xl bg-white text-base font-medium text-black hover:bg-white/95"
						>
							{loading
								? isOnboarding
									? 'Saving...'
									: isVerify
									? 'Verifying...'
									: isSignUp
										? 'Creating...'
										: 'Signing in...'
								: isOnboarding
									? 'Continue'
									: isVerify
									? 'Verify & Continue'
									: 'Continue'}{' '}
							<ChevronRight className="size-4.5 text-text-muted" />
						</Button>
					</div>
				</div>

				<div className="border-t border-surface-3 bg-surface-2 px-6 py-4 text-center sm:px-10">
					<p className="text-sm text-text-muted">
						{isOnboarding ? (
							<>
								Want to change account?{' '}
								<button
									type="button"
									onClick={() => setMode('signin')}
									className="font-medium text-text-primary transition-colors hover:text-gold-bright"
								>
									Sign in
								</button>
							</>
						) : isVerify ? (
							<>
								Wrong email?{' '}
								<button
									type="button"
									onClick={() => setMode('signup')}
									className="font-medium text-text-primary transition-colors hover:text-gold-bright"
								>
									Go back
								</button>
							</>
						) : isSignUp ? (
							<>
								Already have an account?{' '}
								<button
									type="button"
									onClick={() => setMode('signin')}
									className="font-medium text-text-primary transition-colors hover:text-gold-bright"
								>
									Sign in
								</button>
							</>
						) : (
							<>
								Don&apos;t have an account?{' '}
								<button
									type="button"
									onClick={() => setMode('signup')}
									className="font-medium text-text-primary transition-colors hover:text-gold-bright"
								>
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
