import { env } from '@/utils/env.utils';
import { useAuthStore, type AuthUser } from '@/stores/useAuthStore';
import { BaseApiService, type APIResponse } from './api.service';

type AuthSubscriber = () => void;

export type User = AuthUser;

export interface LoginResponse {
	profile: User;
	sessionToken?: string;
	requiresEmailVerification?: boolean;
}

interface RegisterData {
	name: string;
	email: string;
	password: string;
	type?: 'HUMAN' | 'AGENT';
}

interface UpdateProfileData {
	name?: string;
	avatarUrl?: string;
}

interface PrivyTokenResponse {
	token: string;
}

export interface LoginData {
	email: string;
	password: string;
}

class AuthService extends BaseApiService {
	private SESSION_TOKEN_KEY = 'tetrode_session_token';
	private REDIRECT_AFTER_LOGIN_KEY = 'tetrode_redirect_after_login';
	private PRIVY_TOKEN_TTL_MS = 30_000;
	private subscribers = new Set<AuthSubscriber>();
	private privyTokenCache?: {
		sessionToken: string;
		token: string;
		fetchedAt: number;
	};
	private privyTokenInFlight?: Promise<string | undefined>;

	private setSessionToken(token?: string): void {
		if (!token) return;
		if (token !== this.getSessionToken()) {
			this.clearPrivyAuthTokenCache();
		}
		localStorage.setItem(this.SESSION_TOKEN_KEY, token);
		this.notify();
	}

	private clearPrivyAuthTokenCache(): void {
		this.privyTokenCache = undefined;
		this.privyTokenInFlight = undefined;
	}

	private notify(): void {
		for (const subscriber of this.subscribers) {
			subscriber();
		}
	}

	subscribe(listener: AuthSubscriber): () => void {
		this.subscribers.add(listener);
		return () => {
			this.subscribers.delete(listener);
		};
	}

	startGoogleAuth(): void {
		window.location.href = `${env.VITE_BACKEND_URL}/profile/google`;
	}

	setRedirectAfterLogin(target: string): void {
		localStorage.setItem(this.REDIRECT_AFTER_LOGIN_KEY, target);
	}

	consumeRedirectAfterLogin(): string | null {
		const target = localStorage.getItem(this.REDIRECT_AFTER_LOGIN_KEY);
		if (!target) return null;
		localStorage.removeItem(this.REDIRECT_AFTER_LOGIN_KEY);
		return target;
	}

	getSessionToken(): string | null {
		return localStorage.getItem(this.SESSION_TOKEN_KEY);
	}

	async login(email: string, password: string): Promise<User> {
		try {
			const response = await this.api.post<APIResponse<LoginResponse>>(
				'/profile/login',
				{ email, password }
			);
			const profile = response.data.data.profile;
			this.setUser(profile);
			this.setSessionToken(response.data.data.sessionToken);
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async register(input: RegisterData): Promise<User> {
		try {
			const response = await this.api.post<APIResponse<LoginResponse>>(
				'/profile/register',
				input
			);
			const profile = response.data.data.profile;
			this.setUser(profile);
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async verifyEmail(email: string, code: string): Promise<User> {
		try {
			const response = await this.api.post<APIResponse<LoginResponse>>(
				'/profile/verify-email',
				{ email, code }
			);
			const profile = response.data.data.profile;
			this.setUser(profile);
			this.setSessionToken(response.data.data.sessionToken);
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async updateProfile(input: UpdateProfileData): Promise<User> {
		try {
			const response = await this.api.patch<APIResponse<{ profile: User }>>(
				'/profile',
				input
			);
			const profile = response.data.data.profile;
			this.setUser(profile);
			this.notify();
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async updateWalletAddress(walletAddress: string): Promise<User> {
		try {
			const response = await this.api.patch<APIResponse<{ profile: User }>>(
				'/profile/wallet',
				{ walletAddress }
			);
			const profile = response.data.data.profile;
			this.setUser(profile);
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async getPrivyAuthToken(): Promise<string | undefined> {
		if (!this.isAuthenticated()) return undefined;
		const sessionToken = this.getSessionToken();
		if (!sessionToken) return undefined;

		if (
			this.privyTokenCache?.sessionToken === sessionToken &&
			Date.now() - this.privyTokenCache.fetchedAt < this.PRIVY_TOKEN_TTL_MS
		) {
			return this.privyTokenCache.token;
		}

		if (this.privyTokenInFlight) {
			return this.privyTokenInFlight;
		}

		this.privyTokenInFlight = (async () => {
			try {
				const response = await this.api.get<APIResponse<PrivyTokenResponse>>(
					'/profile/privy/token'
				);
				const token = response.data.data.token;
				this.privyTokenCache = {
					sessionToken,
					token,
					fetchedAt: Date.now(),
				};
				return token;
			} catch (error) {
				console.error('Failed to get Privy auth token:', error);
				return undefined;
			} finally {
				this.privyTokenInFlight = undefined;
			}
		})();

		try {
			return await this.privyTokenInFlight;
		} finally {
			// The in-flight promise is cleared by the fetch block above.
		}
	}

	async forgotPassword(email: string): Promise<void> {
		try {
			await this.api.post('/profile/password/forgot', { email });
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async resetPasswordWithCode(input: {
		email: string;
		resetCode: string;
		newPassword: string;
		confirmPassword: string;
	}): Promise<void> {
		try {
			await this.api.post('/profile/password/reset', input);
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async resendVerification(email: string): Promise<void> {
		try {
			await this.api.post('/profile/resend-verification', { email });
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async logout(): Promise<void> {
		try {
			await this.api.post('/profile/logout');
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			this.clearAuth();
			this.notify();
		}
	}

	async getProfile(): Promise<User> {
		try {
			const response = await this.api.get<APIResponse<User>>('/profile/me');
			const user = response.data.data;
			this.setUser(user);
			return user;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	handleOAuthCallback(params: URLSearchParams): {
		success: boolean;
		message: string;
		profile?: User;
	} {
		const success = params.get('success') === 'true';
		const message = params.get('message') || '';
		const profileParam = params.get('profile');
		const tokenParam = params.get('token');

		if (!success || !profileParam || !tokenParam) {
			return {
				success: false,
				message: message || 'Google authentication failed',
			};
		}

		try {
			const profile = JSON.parse(profileParam) as User;
			this.setUser(profile);
			this.setSessionToken(tokenParam);
			return { success: true, message: 'Google login successful', profile };
		} catch {
			return {
				success: false,
				message: 'Could not parse Google profile response',
			};
		}
	}

	setUser(user: User): void {
		useAuthStore.getState().setUser(user);
		this.notify();
	}

	getUser(): User | null {
		return useAuthStore.getState().user;
	}

	isAuthenticated(): boolean {
		return !!this.getUser() && !!this.getSessionToken();
	}

	protected override clearAuth(): void {
		useAuthStore.getState().clearUser();
		localStorage.removeItem(this.SESSION_TOKEN_KEY);
		this.clearPrivyAuthTokenCache();
	}
}

export const authService = new AuthService();
