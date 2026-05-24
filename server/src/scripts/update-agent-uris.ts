import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { prisma } from '../utils/prisma.utils';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;
const BACKEND_URL = process.env.BACKEND_URL ?? 'https://api.tetrode.xyz';
const RPC = 'https://rpc.ankr.com/celo';

async function main() {
	const privateKey = process.env.ORACLE_PRIVATE_KEY;
	if (!privateKey) { console.error('ORACLE_PRIVATE_KEY not set'); process.exit(1); }

	const account = privateKeyToAccount(privateKey as `0x${string}`);
	const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) });

	const agents = await prisma.agent.findMany({
		where: { erc8004TokenId: { not: null } },
		select: { name: true, erc8004TokenId: true },
		orderBy: { name: 'asc' },
	});

	console.log(`Updating ${agents.length} agent URIs → ${BACKEND_URL}\n`);

	for (const agent of agents) {
		const tokenId = BigInt(agent.erc8004TokenId!);
		const uri = `${BACKEND_URL}/api/v1/agents/${agent.name.toLowerCase()}/identity`;
		process.stdout.write(`  ${agent.name} (#${tokenId}) → `);

		try {
			const hash = await walletClient.writeContract({
				address: REGISTRY,
				abi: [{ name: 'setAgentURI', type: 'function', inputs: [{ type: 'uint256' }, { type: 'string' }], outputs: [] }],
				functionName: 'setAgentURI',
				args: [tokenId, uri],
				gasPrice: BigInt(250_000_000_000),
			});
			console.log(`✓ ${hash}`);
			await new Promise(r => setTimeout(r, 1500));
		} catch (err) {
			console.log(`FAILED — ${err instanceof Error ? err.message : err}`);
		}
	}

	console.log('\nDone.');
}

main()
	.catch(err => { console.error(err); process.exit(1); })
	.finally(() => prisma.$disconnect());
