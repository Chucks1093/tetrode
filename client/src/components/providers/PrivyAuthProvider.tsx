import {
	PrivyProvider,
	useSyncJwtBasedAuthState,
} from '@privy-io/react-auth';
import { type ReactNode, useCallback } from 'react';
import { authService } from '@/services/auth.service';
import { env } from '@/utils/env.utils';

const celoMainnet = {
	id: 42220,
	name: 'Celo',
	nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
	rpcUrls: { default: { http: ['https://rpc.ankr.com/celo'] } },
	blockExplorers: {
		default: { name: 'Celoscan', url: 'https://celoscan.io' },
	},
} as const;

function PrivyJwtBridge({ children }: { children: ReactNode }) {
	useSyncJwtBasedAuthState({
		enabled: Boolean(env.VITE_PRIVY_APP_ID),
		getExternalJwt: async () => {
			if (!authService.isAuthenticated()) return undefined;
			return authService.getPrivyAuthToken();
		},
		subscribe: useCallback(onAuthStateChange => {
			return authService.subscribe(onAuthStateChange);
		}, []),
	});

	return <>{children}</>;
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
			config={{
				appearance: {
					theme: 'dark',
					accentColor: '#d4a017',
				},
				supportedChains: [celoMainnet],
				defaultChain: celoMainnet,
				customAuth: {
					isLoading: false,
					getCustomAccessToken: async () => {
						if (!authService.isAuthenticated()) return undefined;
						return authService.getPrivyAuthToken();
					},
				},
			}}
		>
			<PrivyJwtBridge>{children}</PrivyJwtBridge>
		</PrivyProvider>
	);
}
