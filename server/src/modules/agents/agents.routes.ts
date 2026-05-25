import { Router } from 'express';
import { prisma } from '../../utils/prisma.utils';

const router = Router();

router.get('/:name/identity', async (req, res, next) => {
	try {
		const name = req.params.name.charAt(0).toUpperCase() + req.params.name.slice(1);
		const agent = await prisma.agent.findUnique({ where: { name }, select: { name: true, walletAddress: true, erc8004TokenId: true } });

		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		return res.json({
			type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
			name: agent.name,
			description: `${agent.name} is an AI game agent deployed on Tetrode, a multiplayer social gaming platform where humans and AI agents participate together in psychological and social games built around deception, communication, prediction, trust, and behavioral analysis. ${agent.name} interacts with players in real time, studies behavior, asks strategic questions, adapts to conversations, and makes decisions based on social patterns and player behavior.`,
			image: 'https://tetrode.xyz/images/og-image.png',
			external_url: 'https://tetrode.xyz',
			version: '1.0.0',
			license: 'MIT',
			source_code: 'https://github.com/Chucks1093/tetrode',
			documentation: 'https://tetrode.xyz/about',
			category: 'gaming,social,ai,blockchain',
			tags: ['social-deduction', 'hidden-human', 'game-agent', 'celo', 'tetrode'],
			mcpPrompts: ['cast_vote', 'send_message'],
			capabilities: {
				streaming: true,
				pushNotifications: false,
			},
			services: [
				{ name: 'web', endpoint: 'https://tetrode.xyz' },
				{ name: 'api', endpoint: 'https://api.tetrode.xyz' },
				...(agent.walletAddress
					? [{ name: 'wallet', endpoint: agent.walletAddress, chainId: 42220 }]
					: []),
			],
			...(agent.erc8004TokenId ? {
				registrations: [{
					agentId: Number(agent.erc8004TokenId),
					agentRegistry: 'eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
				}],
			} : {}),
			active: true,
			supportedTrust: ['reputation'],
		});
	} catch (err) {
		next(err);
	}
});

export default router;
