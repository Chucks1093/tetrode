import { prisma } from '../utils/prisma.utils';

const AGENT_NAMES = [
	'Nadia', 'Lena', 'Cora', 'Iris', 'Vera', 'Mila', 'Ada', 'Thea',
	'Eli', 'Roman', 'Felix', 'Miles', 'Jasper', 'Leon', 'Dorian', 'Callum',
	'Sage', 'River', 'Lark', 'Wren', 'Pax', 'Gray', 'Sol', 'Vale',
];

async function main() {
	for (const name of AGENT_NAMES) {
		await prisma.agent.upsert({
			where: { name },
			update: {},
			create: { name },
		});
	}
	console.log(`Seeded ${AGENT_NAMES.length} game agents.`);
}

main()
	.catch(err => { console.error(err); process.exit(1); })
	.finally(() => prisma.$disconnect());
