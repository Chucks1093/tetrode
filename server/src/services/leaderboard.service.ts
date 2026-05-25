import { createWalletClient, createPublicClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { envConfig } from '../config';

const USDC_ABI = parseAbi([
	'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
]);

const LEADERBOARD_ABI = parseAbi([
	'function recordGame(address player) external',
	'function recordWin(address player, uint256 pointsAwarded) external',
	'function getPlayer(address player) external view returns (uint256 points, uint256 gamesPlayed, uint256 gamesWon)',
]);

const TETRODE_PASS_ABI = parseAbi([
	'function balanceOf(address account) external view returns (uint256)',
	'function mint(address to, uint256 amount) external',
	'function adminBurn(address from, uint256 amount) external',
]);

const WIN_POINTS = BigInt(100);

const celoSepolia = defineChain({
	id: 11142220,
	name: 'Celo Sepolia',
	nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
	rpcUrls: { default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] } },
});

function getChainAndRpc() {
	if (envConfig.MODE === 'production') {
		return { chain: celo, rpc: 'https://rpc.ankr.com/celo' };
	}
	return { chain: celoSepolia, rpc: 'https://forno.celo-sepolia.celo-testnet.org' };
}

function createOracleInstance() {
	const privateKey = envConfig.ORACLE_PRIVATE_KEY;
	if (!privateKey) return null;
	const account = privateKeyToAccount(privateKey as `0x${string}`);
	const { chain, rpc } = getChainAndRpc();
	return {
		walletClient: createWalletClient({ account, chain, transport: http(rpc) }),
		publicClient: createPublicClient({ chain, transport: http(rpc) }),
	};
}

// Lazy singleton — one walletClient so viem tracks nonces across all oracle calls
let _oracle: ReturnType<typeof createOracleInstance> = null;

function getOracle() {
	if (!_oracle) _oracle = createOracleInstance();
	return _oracle;
}

// Global queue — serializes every oracle write so concurrent games never collide on nonces
let _oracleQueue: Promise<unknown> = Promise.resolve();
function enqueueOracleTx<T>(fn: () => Promise<T>): Promise<T> {
	const p = _oracleQueue.then(() => fn());
	_oracleQueue = p.catch(() => {}); // swallow so queue stays alive after errors
	return p;
}

function getClients() {
	const oracle = getOracle();
	const contractAddress = envConfig.LEADERBOARD_CONTRACT_ADDRESS;
	if (!oracle || !contractAddress) return null;
	return { ...oracle, contractAddress: contractAddress as `0x${string}` };
}

function getPassClients() {
	const oracle = getOracle();
	const contractAddress = envConfig.TETRODE_PASS_CONTRACT_ADDRESS;
	if (!oracle || !contractAddress) return null;
	return { ...oracle, contractAddress: contractAddress as `0x${string}` };
}

// Called at room creation (game start)
export async function recordGame(playerWalletAddress: string): Promise<void> {
	const clients = getClients();
	if (!clients) return;

	const { walletClient, publicClient, contractAddress } = clients;

	try {
		await enqueueOracleTx(async () => {
			const hash = await walletClient.writeContract({
				address: contractAddress,
				abi: LEADERBOARD_ABI,
				functionName: 'recordGame',
				args: [playerWalletAddress as `0x${string}`],
			});
			await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
		});
	} catch (error) {
		console.error('[leaderboard] recordGame failed:', error);
	}
}

// Called at game end if human won — only adds points/win, NOT gamesPlayed
export async function recordWin(playerWalletAddress: string): Promise<void> {
	const clients = getClients();
	if (!clients) return;

	const { walletClient, publicClient, contractAddress } = clients;

	try {
		await enqueueOracleTx(async () => {
			const hash = await walletClient.writeContract({
				address: contractAddress,
				abi: LEADERBOARD_ABI,
				functionName: 'recordWin',
				args: [playerWalletAddress as `0x${string}`, WIN_POINTS],
			});
			await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
		});
	} catch (error) {
		console.error('[leaderboard] recordWin failed:', error);
	}
}

// Check how many free passes a player has
export async function getFreePassBalance(walletAddress: string): Promise<number> {
	const clients = getPassClients();
	if (!clients) return 0;

	const { publicClient, contractAddress } = clients;

	try {
		const balance = await publicClient.readContract({
			address: contractAddress,
			abi: TETRODE_PASS_ABI,
			functionName: 'balanceOf',
			args: [walletAddress as `0x${string}`],
		});
		return Number(balance);
	} catch (error) {
		console.error('[tetrodepass] getFreePassBalance failed:', error);
		return 0;
	}
}

// Consume 1 free pass from a player's wallet (called at room creation)
export async function useFreePass(walletAddress: string): Promise<boolean> {
	const clients = getPassClients();
	if (!clients) return false;

	const { walletClient, contractAddress } = clients;

	try {
		await enqueueOracleTx(() => walletClient.writeContract({
			address: contractAddress,
			abi: TETRODE_PASS_ABI,
			functionName: 'adminBurn',
			args: [walletAddress as `0x${string}`, BigInt(1)],
		}));
		return true;
	} catch (error) {
		console.error('[tetrodepass] useFreePass failed:', error);
		return false;
	}
}

// Mint 1 free pass to a new user's wallet
export async function mintFreePass(walletAddress: string): Promise<void> {
	const clients = getPassClients();
	if (!clients) return;

	const { walletClient, contractAddress } = clients;

	try {
		await enqueueOracleTx(() => walletClient.writeContract({
			address: contractAddress,
			abi: TETRODE_PASS_ABI,
			functionName: 'mint',
			args: [walletAddress as `0x${string}`, BigInt(1)],
		}));
		console.log(`[tetrodepass] minted 1 pass to ${walletAddress}`);
	} catch (error) {
		console.error('[tetrodepass] mintFreePass failed:', error);
	}
}

// Relay a USDC transferWithAuthorization — user signs, we pay gas
export async function relayUsdcTransfer(auth: {
	from: string;
	to: string;
	value: string;
	validAfter: string;
	validBefore: string;
	nonce: string;
	signature: string;
}): Promise<boolean> {
	const privateKey = envConfig.ORACLE_PRIVATE_KEY;
	const usdcContract = envConfig.USDC_CONTRACT_ADDRESS;
	if (!privateKey || !usdcContract) return false;

	// Split 65-byte signature into v, r, s
	const sig = auth.signature.startsWith('0x') ? auth.signature : `0x${auth.signature}`;
	const r = sig.slice(0, 66) as `0x${string}`;
	const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
	let v = parseInt(sig.slice(130, 132), 16);
	if (v < 27) v += 27; // normalize to 27/28

	const account = privateKeyToAccount(privateKey as `0x${string}`);
	const { chain, rpc } = getChainAndRpc();
	const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
	const publicClient = createPublicClient({ chain, transport: http(rpc) });

	try {
		const hash = await walletClient.writeContract({
			address: usdcContract as `0x${string}`,
			abi: USDC_ABI,
			functionName: 'transferWithAuthorization',
			args: [
				auth.from as `0x${string}`,
				auth.to as `0x${string}`,
				BigInt(auth.value),
				BigInt(auth.validAfter),
				BigInt(auth.validBefore),
				auth.nonce as `0x${string}`,
				v,
				r,
				s,
			],
		});

		const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
		return receipt.status === 'success';
	} catch (error) {
		console.error('[usdc] relayUsdcTransfer failed:', error);
		return false;
	}
}

// Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export async function verifyUsdcPayment(
	txHash: string,
	fromAddress: string,
	minAmountUsdc: number
): Promise<boolean> {
	const treasuryWallet = envConfig.TREASURY_WALLET_ADDRESS;
	const usdcContract = envConfig.USDC_CONTRACT_ADDRESS;
	if (!treasuryWallet || !usdcContract) return false;

	try {
		const { chain, rpc } = getChainAndRpc();
		const publicClient = createPublicClient({ chain, transport: http(rpc) });

		const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
		if (!receipt || receipt.status !== 'success') return false;

		const minAmount = BigInt(Math.round(minAmountUsdc * 1_000_000)); // USDC = 6 decimals

		for (const log of receipt.logs) {
			if (log.address.toLowerCase() !== usdcContract.toLowerCase()) continue;
			if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
			if (log.topics.length < 3) continue;

			const logFrom = '0x' + log.topics[1]!.slice(26);
			const logTo   = '0x' + log.topics[2]!.slice(26);
			const amount  = BigInt(log.data);

			if (
				logFrom.toLowerCase() === fromAddress.toLowerCase() &&
				logTo.toLowerCase()   === treasuryWallet.toLowerCase() &&
				amount >= minAmount
			) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}
