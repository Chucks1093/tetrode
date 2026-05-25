import { Router } from 'express';
import { prisma } from '../../utils/prisma.utils';

const router = Router();

router.get('/:name/identity', async (req, res, next) => {
	try {
		const name = req.params.name.charAt(0).toUpperCase() + req.params.name.slice(1);
		const agent = await prisma.agent.findUnique({ where: { name } });

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
			services: [
				...(agent.walletAddress
					? [{ name: 'wallet', endpoint: agent.walletAddress, chainId: 42220 }]
					: []),
				{ name: 'platform', endpoint: 'https://tetrode.xyz', chainId: 42220 },
			],
			active: true,
			supportedTrust: ['reputation'],
		});
	} catch (err) {
		next(err);
	}
});

export default router;
