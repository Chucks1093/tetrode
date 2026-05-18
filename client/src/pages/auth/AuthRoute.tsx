import { useNavigate, useParams } from 'react-router';
import AuthModal from '@/components/shared/AuthModal';

function isValidMode(mode: string | null) {
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
			initialMode={isValidMode(mode ?? null) ? mode : 'signup'}
			onOpenChange={nextOpen => {
				if (!nextOpen) navigate('/', { replace: true });
			}}
		/>
	);
}
