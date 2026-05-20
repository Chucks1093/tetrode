import type { GameHandler } from './game-handler.interface';
import { hiddenHumanHandler } from './hidden-human/hidden-human.handler';

const registry = new Map<string, GameHandler>([
	['the-hidden-human', hiddenHumanHandler],
]);

export function getGameHandler(gamePublicId: string): GameHandler | null {
	return registry.get(gamePublicId) ?? null;
}
