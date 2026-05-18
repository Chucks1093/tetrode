import { useCallback, useEffect, useRef } from 'react';
import { useCreateWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';

export function useEnsurePrivyWallet() {
	const currentUser = useAuthStore(state => state.user);
	const { createWallet } = useCreateWallet();
	const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
	const { wallets } = useWallets();
	const privyStateRef = useRef({
		ready: privyReady,
		authenticated: privyAuthenticated,
	});

	useEffect(() => {
		privyStateRef.current = {
			ready: privyReady,
			authenticated: privyAuthenticated,
		};
	}, [privyAuthenticated, privyReady]);

	const waitForPrivyAuthentication = async () => {
		const timeoutAt = Date.now() + 5000;

		while (Date.now() < timeoutAt) {
			if (
				privyStateRef.current.ready &&
				privyStateRef.current.authenticated
			) {
				return;
			}

			await new Promise(resolve => setTimeout(resolve, 200));
		}

		throw new Error(
			'Wallet setup is still initializing. Please try again in a moment.'
		);
	};

	const getExistingPrivyWalletAddress = () => {
		const privyWallet = wallets.find(wallet => {
			const clientType =
				'walletClientType' in wallet ? wallet.walletClientType : undefined;
			return clientType === 'privy';
		});

		return privyWallet?.address;
	};

	const ensureWallet = useCallback(async () => {
		if (currentUser?.walletAddress) {
			return currentUser.walletAddress;
		}

		await waitForPrivyAuthentication();

		const existingWalletAddress = getExistingPrivyWalletAddress();
		if (existingWalletAddress) {
			await authService.updateWalletAddress(existingWalletAddress);
			return existingWalletAddress;
		}

		const wallet = await createWallet();
		if (!wallet?.address) {
			throw new Error('Wallet was created but address is missing');
		}

		await authService.updateWalletAddress(wallet.address);
		return wallet.address;
	}, [createWallet, currentUser?.walletAddress, wallets]);

	return {
		ensureWallet,
	};
}
