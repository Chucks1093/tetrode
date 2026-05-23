import { createWalletClient, createPublicClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { prisma } from '../utils/prisma.utils';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const IDENTITY_REGISTRY_ABI = parseAbi([
	'function register(string agentURI) returns (uint256 agentId)',
	'function tokenURI(uint256 tokenId) view returns (string)',
	'function ownerOf(uint256 tokenId) view returns (address)',
]);

// ERC-8004 IdentityRegistry addresses
const REGISTRY_ADDRESS = {
	mainnet: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const,
	testnet: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const,
};

// Celo Sepolia testnet (chain ID 11142220) — same network as our deployed contracts
const celoSepolia = defineChain({
	id: 11142220,
	name: 'Celo Sepolia',
	nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
	},
	testnet: true,
});

const IS_PROD = process.env.MODE === 'production';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

async function main() {
	const privateKey = process.env.ORACLE_PRIVATE_KEY;
	if (!privateKey) {
		console.error('ORACLE_PRIVATE_KEY not set in .env');
		process.exit(1);
	}

	const account = privateKeyToAccount(privateKey as `0x${string}`);
	const chain = IS_PROD ? celo : celoSepolia;
	const registryAddress = IS_PROD ? REGISTRY_ADDRESS.mainnet : REGISTRY_ADDRESS.testnet;

	console.log(`Network: ${IS_PROD ? 'Celo Mainnet' : 'Celo Sepolia (testnet)'}`);
	console.log(`Registry: ${registryAddress}`);
	console.log(`Oracle wallet: ${account.address}`);
	console.log('');

	const walletClient = createWalletClient({ account, chain, transport: http() });
	const publicClient = createPublicClient({ chain, transport: http() });

	const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });
	const unminted = agents.filter(a => !a.erc8004TokenId);

	if (unminted.length === 0) {
		console.log('All agents already minted.');
		return;
	}

	console.log(`Minting ${unminted.length} agents...\n`);

	for (const agent of unminted) {
		const agentURI = `${BACKEND_URL}/api/v1/agents/${agent.name.toLowerCase()}/identity`;

		try {
			process.stdout.write(`  ${agent.name} → `);

			const hash = await walletClient.writeContract({
				address: registryAddress,
				abi: IDENTITY_REGISTRY_ABI,
				functionName: 'register',
				args: [agentURI],
			});

			const receipt = await publicClient.waitForTransactionReceipt({ hash });

			// tokenId is in the Transfer event topics[3] (ERC-721 Transfer)
			const transferLog = receipt.logs.find(
				log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
			);
			const tokenId = transferLog ? BigInt(transferLog.topics[3] ?? '0').toString() : null;

			if (tokenId) {
				await prisma.agent.update({
					where: { id: agent.id },
					data: { erc8004TokenId: tokenId },
				});
				console.log(`tokenId ${tokenId} ✓`);
			} else {
				console.log(`minted (tokenId not parsed) tx: ${hash}`);
			}

			// Small delay between mints to avoid nonce issues
			await new Promise(r => setTimeout(r, 1000));
		} catch (err) {
			console.log(`FAILED — ${err instanceof Error ? err.message : err}`);
		}
	}

	console.log('\nDone.');
}

main()
	.catch(err => { console.error(err); process.exit(1); })
	.finally(() => prisma.$disconnect());
