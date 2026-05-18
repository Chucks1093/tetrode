import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Clover } from 'lucide-react';
import { authService } from '@/services/auth.service';
import showToast from '@/utils/toast.util';

function OAuthCallback() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [statusText, setStatusText] = useState('Finishing Google login...');

	useEffect(() => {
		const result = authService.handleOAuthCallback(searchParams);

		if (result.success) {
			showToast.success(result.message);
			navigate('/auth/onboarding', { replace: true });
			return;
		}

		showToast.error(result.message);
		setStatusText(result.message);
		const timer = setTimeout(() => {
			navigate('/', { replace: true });
		}, 1500);

		return () => clearTimeout(timer);
	}, [navigate, searchParams]);

	return (
		<div className="min-h-screen bg-surface-0 px-4 text-text-primary">
			<div className="mx-auto flex max-w-5xl items-center justify-center pt-20 sm:pt-8">
				<div className="absolute left-4 top-6 flex items-center gap-2 sm:left-8 sm:top-8">
					<Clover className="text-gold-base" />
					<p className="font-ps2p text-xs uppercase tracking-[0.18em] text-gold-base sm:text-sm">
						Tetrode
					</p>
				</div>
				<div className="w-full max-w-md rounded-2xl border border-surface-3 bg-surface-1 p-6 text-center sm:p-8">
					<h1 className="font-jakarta text-lg font-semibold text-text-primary sm:text-xl">
						Google Authentication
					</h1>
					<p className="mt-3 font-jakarta text-sm text-text-muted">
						{statusText}
					</p>
				</div>
			</div>
		</div>
	);
}

export default OAuthCallback;
