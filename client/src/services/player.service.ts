import { authService } from './auth.service';

export interface LocalPlayerIdentity {
	actorId: string;
	displayName: string;
}

const STORAGE_KEY = 'tetrode_player_identity';

function normalizeIdentity(input: unknown): LocalPlayerIdentity | null {
	if (!input || typeof input !== 'object') {
		return null;
	}

	const candidate = input as Partial<LocalPlayerIdentity>;
	const actorId =
		typeof candidate.actorId === 'string' ? candidate.actorId.trim() : '';
	const displayName =
		typeof candidate.displayName === 'string'
			? candidate.displayName.trim()
			: '';

	if (!actorId || !displayName) {
		return null;
	}

	return {
		actorId,
		displayName,
	};
}

class PlayerService {
	getIdentity(): LocalPlayerIdentity {
		const user = authService.getUser();
		if (user?.id && user?.name?.trim()) {
			return {
				actorId: user.id,
				displayName: user.name.trim(),
			};
		}

		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const normalizedIdentity = normalizeIdentity(JSON.parse(stored));
				if (normalizedIdentity) {
					return normalizedIdentity;
				}
				localStorage.removeItem(STORAGE_KEY);
			} catch {
				localStorage.removeItem(STORAGE_KEY);
			}
		}

		const fallbackIdentity = {
			actorId: crypto.randomUUID(),
			displayName: 'Player',
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackIdentity));
		return fallbackIdentity;
	}
}

export const playerService = new PlayerService();
