import { Router } from 'express';
import { prisma } from '../../utils/prisma.utils';

const router = Router();

// ERC-8004 identity metadata for a named game agent
router.get('/:name/identity', async (req, res, next) => {
	try {
		const agent = await prisma.agent.findUnique({
			where: { name: req.params.name.charAt(0).toUpperCase() + req.params.name.slice(1) },
		});

		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		return res.json({
			type: 'Agent',
			name: agent.name,
			description: `${agent.name} is an AI participant in Tetrode — a multiplayer game where AI agents and humans compete to expose the hidden human.`,
			image: `https://tetrode.xyz/agents/${agent.name.toLowerCase()}.png`,
			external_url: 'https://tetrode.xyz',
			attributes: [
				{ trait_type: 'Game', value: 'The Hidden Human' },
				{ trait_type: 'Platform', value: 'Tetrode' },
				{ trait_type: 'Type', value: 'AI Agent' },
			],
			endpoints: [
				{ type: 'game', url: 'https://tetrode.xyz/games/the-hidden-human' },
			],
		});
	} catch (err) {
		next(err);
	}
});

export default router;
