import { ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface AuthModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
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

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
	const [mode, setMode] = useState<'signin' | 'signup'>('signin');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);

	const isSignUp = mode === 'signup';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className=" sm:max-w-sm overflow-hidden rounded-xl border border-surface-3 bg-surface-1 p-0 text-text-primary shadow-2xl"
			>
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-5 top-5 z-10 flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
					aria-label="Close auth modal"
				>
					<X className="size-5" />
				</button>

				<div className=" pb-6 pt-4 sm:px-8 sm:pb-7 sm:pt-10">
					<CloverMark />

					<div className="mt-4 text-center">
						<DialogTitle className="font-jakarta text-lg font-semibold text-text-primary">
							{isSignUp ? 'Create your account' : 'Sign in to Tetrode'}
						</DialogTitle>
						<DialogDescription className="mt-2 text-xs font-medium text-text-muted">
							{isSignUp
								? 'Welcome! Please fill in the details to get started.'
								: 'Welcome back! Please sign in to continue'}
						</DialogDescription>
					</div>

					<div className="mt-6">
						<Button
							type="button"
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
								placeholder="Enter your email address"
								className="h-11 rounded-xl border-surface-3 bg-transparent px-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-gold-base focus-visible:ring-gold-base/20"
							/>
						</div>

						{isSignUp ? (
							<div className="mt-5">
								<label className="mb-2 block text-sm font-medium text-text-primary">
									Password
								</label>
								<div className="relative">
									<Input
										type={showPassword ? 'text' : 'password'}
										value={password}
										onChange={e => setPassword(e.target.value)}
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
							</div>
						) : null}

						<Button
							type="button"
							className="mt-6 h-11 w-full rounded-xl bg-white text-base font-medium text-black hover:bg-white/95"
						>
							Continue{' '}
							<ChevronRight className="size-4.5 text-text-muted" />
						</Button>
					</div>
				</div>

				<div className="border-t border-surface-3 bg-surface-2 px-6 py-4 text-center sm:px-10">
					<p className="text-sm text-text-muted">
						{isSignUp
							? 'Already have an account? '
							: "Don't have an account? "}
						<button
							type="button"
							onClick={() =>
								setMode(current =>
									current === 'signup' ? 'signin' : 'signup'
								)
							}
							className="font-medium text-text-primary transition-colors hover:text-gold-bright"
						>
							{isSignUp ? 'Sign in' : 'Sign up'}
						</button>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
