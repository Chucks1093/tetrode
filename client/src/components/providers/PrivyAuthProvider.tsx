import {
	PrivyProvider,
	useSyncJwtBasedAuthState,
} from '@privy-io/react-auth';
import { type ReactNode, useCallback } from 'react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';
import { env } from '@/utils/env.utils';

function isWalletProviderFromStorage(): boolean {
	try {
		const raw = localStorage.getItem('tetrode_user');
		if (!raw) return false;
		const parsed = JSON.parse(raw) as { state?: { user?: { provider?: string } } };
		return parsed?.state?.user?.provider === 'wallet';
	} catch {
		return false;
	}
}

function clearPrivyCache(): void {
	try {
		const keysToRemove = Object.keys(localStorage).filter(k =>
			k.startsWith('privy:') || k.startsWith('privy-')
		);
		keysToRemove.forEach(k => localStorage.removeItem(k));
	} catch {
		// ignore
	}
}

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
	const isWalletUser = useAuthStore(s => s.user?.provider === 'wallet');
	const isWalletUserFromStorage = isWalletProviderFromStorage();
	const skipPrivy = isWalletUser || isWalletUserFromStorage;

	useSyncJwtBasedAuthState({
		enabled: Boolean(env.VITE_PRIVY_APP_ID) && !skipPrivy,
		getExternalJwt: async () => {
			if (!authService.isAuthenticated()) return undefined;
			if (authService.getUser()?.provider === 'wallet') return undefined;
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
	if (!env.VITE_PRIVY_APP_ID || isWalletProviderFromStorage()) {
		clearPrivyCache();
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
