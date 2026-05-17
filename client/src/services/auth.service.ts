// src/services/auth.service.ts
import { BaseApiService, type APIResponse } from './api.service';

type AuthSubscriber = () => void;

type PrivyAdapter = {
	login: () => Promise<void>;
	logout: () => Promise<void>;
	getAccessToken: () => Promise<string | null>;
};

export interface User {
	id: string;
	name: string;
	email: string;
	type: 'HUMAN' | 'AGENT';
	status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
	emailVerified: boolean;
	avatarUrl?: string;
	provider?: string;
	interests?: string[];
	createdAt: string;
}

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

export interface LoginData {
	email: string;
	password: string;
}

class AuthService extends BaseApiService {
	private USER_PROFILE_KEY = 'proofline_user';
	private SESSION_TOKEN_KEY = 'proofline_session_token';
	private privyReady = false;
	private privyAuthenticated = false;
	private privyAdapter: PrivyAdapter | null = null;
	private subscribers = new Set<AuthSubscriber>();

	private setSessionToken(token?: string): void {
		if (!token) return;
		localStorage.setItem(this.SESSION_TOKEN_KEY, token);
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

	isReady(): boolean {
		return this.privyReady;
	}

	setPrivyAdapter(adapter: PrivyAdapter): void {
		this.privyAdapter = adapter;
	}

	clearPrivyAdapter(): void {
		this.privyAdapter = null;
	}

	async startPrivyLogin(): Promise<void> {
		if (!this.privyAdapter) {
			throw new ApiError(
				'Privy is not initialized. Check your frontend env and provider setup.',
				500
			);
		}

		await this.privyAdapter.login();
	}

	async syncPrivySession(input: {
		ready: boolean;
		authenticated: boolean;
		user: unknown;
		accessToken: string | null;
	}): Promise<void> {
		this.privyReady = input.ready;
		this.privyAuthenticated = input.authenticated;

		if (!input.authenticated) {
			this.clearAuth();
			this.notify();
			return;
		}

		const mappedUser = this.mapPrivyUser(input.user);
		if (mappedUser) {
			this.setUser(mappedUser);
		}

		if (input.accessToken) {
			this.setSessionToken(input.accessToken);
		}

		this.notify();
	}

	private mapPrivyUser(user: unknown): User | null {
		if (!user || typeof user !== 'object') {
			return null;
		}

		const candidate = user as Record<string, unknown>;
		const id = typeof candidate.id === 'string' ? candidate.id : '';
		const createdAt =
			typeof candidate.createdAt === 'string'
				? candidate.createdAt
				: new Date().toISOString();

		const linkedAccounts = Array.isArray(candidate.linkedAccounts)
			? candidate.linkedAccounts
			: [];

		let name = '';
		let email = '';
		let avatarUrl: string | undefined;

		for (const account of linkedAccounts) {
			if (!account || typeof account !== 'object') continue;
			const linked = account as Record<string, unknown>;

			if (!name && typeof linked.name === 'string') {
				name = linked.name.trim();
			}

			if (!email && typeof linked.email === 'string') {
				email = linked.email.trim();
			}

			if (!avatarUrl && typeof linked.avatarUrl === 'string') {
				avatarUrl = linked.avatarUrl;
			}

			if (
				!avatarUrl &&
				typeof linked.profilePictureUrl === 'string'
			) {
				avatarUrl = linked.profilePictureUrl;
			}
		}

		if (!name && email) {
			name = email.split('@')[0] ?? 'Player';
		}

		if (!name) {
			name = 'Player';
		}

		if (!id) {
			return null;
		}

		return {
			id,
			name,
			email,
			type: 'HUMAN',
			status: 'ACTIVE',
			emailVerified: Boolean(email),
			avatarUrl,
			provider: 'privy',
			interests: [],
			createdAt,
		};
	}

	getSessionToken(): string | null {
		return localStorage.getItem(this.SESSION_TOKEN_KEY);
	}

	// Login - POST /profile/login
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

	// Signup - POST /profile/register
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


	async completeOnboarding(input: {
		avatarUrl: string;
		interests: string[];
	}): Promise<User> {
		try {
			const response = await this.api.patch<
				APIResponse<{ profile: User }>
			>('/profile/onboarding', input);
			const profile = response.data.data.profile;
			this.setUser(profile);
			return profile;
		} catch (error) {
			throw this.handleError(error);
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

	// Logout - POST /profile/logout
	async logout(): Promise<void> {
		try {
			if (this.privyAdapter) {
				await this.privyAdapter.logout();
			} else {
				await this.api.post('/profile/logout');
			}
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			this.clearAuth();
			this.privyAuthenticated = false;
			this.notify();
		}
	}

	// Get profile - GET /profile/me
	async getProfile(): Promise<User> {
		try {
			const response =
				await this.api.get<APIResponse<User>>('/profile/me');

			const user = response.data.data;
			this.setUser(user);
			return user;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	// Request password reset - POST /auth/password-reset/request
	async requestPasswordReset(email: string): Promise<void> {
		try {
			await this.api.post('/profile/password/forgot', { email });
		} catch (error) {
			throw this.handleError(error);
		}
	}

	// Reset password - POST /auth/password-reset/confirm
	async resetPassword(token: string, newPassword: string): Promise<void> {
		try {
			await this.api.post('/profile/password/reset', {
				token,
				newPassword,
			});
		} catch (error) {
			throw this.handleError(error);
		}
	}

	// User management
	setUser(user: User): void {
		localStorage.setItem(this.USER_PROFILE_KEY, JSON.stringify(user));
	}

	getUser(): User | null {
		const userStr = localStorage.getItem(this.USER_PROFILE_KEY);
		return userStr ? JSON.parse(userStr) : null;
	}

	isAuthenticated(): boolean {
		return (!!this.getUser() && !!this.getSessionToken()) || this.privyAuthenticated;
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
			return {
				success: true,
				message: 'Google login successful',
				profile,
			};
		} catch {
			return {
				success: false,
				message: 'Could not parse Google profile response',
			};
		}
	}

	protected clearAuth(): void {
		localStorage.removeItem(this.USER_PROFILE_KEY);
		localStorage.removeItem(this.SESSION_TOKEN_KEY);
	}
}

export const authService = new AuthService();
