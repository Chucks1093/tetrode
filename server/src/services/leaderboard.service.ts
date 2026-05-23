import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoAlfajores } from 'viem/chains';
import { envConfig } from '../config';

const LEADERBOARD_ABI = parseAbi([
	'function recordWin(address player, uint256 pointsAwarded) external',
	'function recordGame(address player) external',
	'function getPlayer(address player) external view returns (uint256 points, uint256 gamesPlayed, uint256 gamesWon)',
]);

const WIN_POINTS = BigInt(100);

function getClients() {
	const privateKey = envConfig.ORACLE_PRIVATE_KEY;
	const contractAddress = envConfig.LEADERBOARD_CONTRACT_ADDRESS;

	if (!privateKey || !contractAddress) return null;

	const account = privateKeyToAccount(privateKey as `0x${string}`);
	const chain = envConfig.MODE === 'production' ? celo : celoAlfajores;

	const walletClient = createWalletClient({ account, chain, transport: http() });
	const publicClient = createPublicClient({ chain, transport: http() });

	return { walletClient, publicClient, account, contractAddress: contractAddress as `0x${string}` };
}

export async function recordWin(playerWalletAddress: string): Promise<void> {
	const clients = getClients();
	if (!clients) return;

	const { walletClient, contractAddress } = clients;

	try {
		await walletClient.writeContract({
			address: contractAddress,
			abi: LEADERBOARD_ABI,
			functionName: 'recordWin',
			args: [playerWalletAddress as `0x${string}`, WIN_POINTS],
		});
	} catch (error) {
		// Non-fatal — game result stands, leaderboard update can be retried
		console.error('[leaderboard] recordWin failed:', error);
	}
}

export async function recordGame(playerWalletAddress: string): Promise<void> {
	const clients = getClients();
	if (!clients) return;

	const { walletClient, contractAddress } = clients;

	try {
		await walletClient.writeContract({
			address: contractAddress,
			abi: LEADERBOARD_ABI,
			functionName: 'recordGame',
			args: [playerWalletAddress as `0x${string}`],
		});
	} catch (error) {
		console.error('[leaderboard] recordGame failed:', error);
	}
}
