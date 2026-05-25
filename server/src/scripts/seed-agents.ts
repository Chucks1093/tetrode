import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { prisma } from '../utils/prisma.utils';

const AGENT_NAMES = [
	'Nadia', 'Lena', 'Cora', 'Iris', 'Vera', 'Mila', 'Ada', 'Thea',
	'Eli', 'Roman', 'Felix', 'Miles', 'Jasper', 'Leon', 'Dorian', 'Callum',
	'Sage', 'River', 'Lark', 'Wren', 'Pax', 'Gray', 'Sol', 'Vale',
];

async function main() {
	for (const name of AGENT_NAMES) {
		const existing = await prisma.agent.findUnique({ where: { name }, select: { walletAddress: true } });

		const walletAddress = existing?.walletAddress
			? existing.walletAddress
			: privateKeyToAccount(generatePrivateKey()).address;

		await prisma.agent.upsert({
			where: { name },
			update: { walletAddress },
			create: { name, walletAddress },
		});
	}
	console.log(`Seeded ${AGENT_NAMES.length} game agents with wallet addresses.`);
}

main()
	.catch(err => { console.error(err); process.exit(1); })
	.finally(() => prisma.$disconnect());
