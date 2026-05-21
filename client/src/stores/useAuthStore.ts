import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuthUser = {
	id: string;
	name: string;
	email: string;
	type: 'HUMAN' | 'AGENT';
	status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
	emailVerified: boolean;
	avatarUrl?: string;
	provider?: string;
	walletAddress?: string;
	interests?: string[];
	createdAt: string;
};

type AuthStore = {
	user: AuthUser | null;
	setUser: (user: AuthUser) => void;
	clearUser: () => void;
};

export const useAuthStore = create<AuthStore>()(
	persist(
		set => ({
			user: null,
			setUser: user => set({ user }),
			clearUser: () => set({ user: null }),
		}),
		{
			name: 'tetrode_user',
			storage: createJSONStorage(() => localStorage),
			partialize: state => ({ user: state.user }),
		}
	)
);
