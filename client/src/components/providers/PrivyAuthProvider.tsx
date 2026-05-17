import { useEffect, type ReactNode } from 'react';
import { PrivyProvider, useLogin, usePrivy } from '@privy-io/react-auth';
import { authService } from '@/services/auth.service';
import { env } from '@/utils/env.utils';

function PrivyBridge({ children }: { children: ReactNode }) {
	const { login } = useLogin();
	const { ready, authenticated, user, getAccessToken, logout } = usePrivy();

	useEffect(() => {
		authService.setPrivyAdapter({
			login,
			logout,
			getAccessToken,
		});

		return () => {
			authService.clearPrivyAdapter();
		};
	}, [getAccessToken, login, logout]);

	useEffect(() => {
		let isMounted = true;

		async function syncSession() {
			if (!ready) {
				await authService.syncPrivySession({
					ready: false,
					authenticated: false,
					user: null,
					accessToken: null,
				});
				return;
			}

			const accessToken = authenticated
				? await getAccessToken().catch(() => null)
				: null;

			if (!isMounted) return;

			await authService.syncPrivySession({
				ready,
				authenticated,
				user: user ?? null,
				accessToken,
			});
		}

		void syncSession();

		return () => {
			isMounted = false;
		};
	}, [authenticated, getAccessToken, ready, user]);

	return children;
}

export default function PrivyAuthProvider({
	children,
}: {
	children: ReactNode;
}) {
	if (!env.VITE_PRIVY_APP_ID) {
		return children;
	}

	return (
		<PrivyProvider
			appId={env.VITE_PRIVY_APP_ID}
			clientId={env.VITE_PRIVY_CLIENT_ID}
			config={{
				appearance: {
					theme: 'dark',
					accentColor: '#f97316',
					showWalletLoginFirst: false,
					landingHeader: 'Enter Tetrode',
					loginMessage: 'Sign in with Google to enter the arena.',
				},
				embeddedWallets: {
					ethereum: {
						createOnLogin: 'users-without-wallets',
					},
				},
			}}
		>
			<PrivyBridge>{children}</PrivyBridge>
		</PrivyProvider>
	);
}
