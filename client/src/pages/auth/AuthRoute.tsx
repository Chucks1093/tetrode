import { useNavigate, useParams } from 'react-router';
import AuthModal from '@/components/shared/AuthModal';

type AuthMode = 'signin' | 'signup' | 'verify' | 'onboarding' | 'wallet';

function isValidMode(mode: string | null): mode is AuthMode {
	return (
		mode === 'signin' ||
		mode === 'signup' ||
		mode === 'verify' ||
		mode === 'onboarding' ||
		mode === 'wallet'
	);
}

export default function AuthRoute() {
	const navigate = useNavigate();
	const { mode } = useParams();

	return (
		<AuthModal
			open
			initialMode={isValidMode(mode ?? null) ? (mode as AuthMode) : 'signup'}
			onOpenChange={nextOpen => {
				if (!nextOpen) navigate('/', { replace: true });
			}}
		/>
	);
}
