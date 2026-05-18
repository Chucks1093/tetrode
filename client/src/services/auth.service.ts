import { env } from '@/utils/env.utils';
import { BaseApiService, type APIResponse } from './api.service';

type AuthSubscriber = () => void;

export interface User {
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

interface UpdateProfileData {
	name?: string;
	avatarUrl?: string;
}

export interface LoginData {
	email: string;
	password: string;
}

class AuthService extends BaseApiService {
	private USER_PROFILE_KEY = 'proofline_user';
	private SESSION_TOKEN_KEY = 'proofline_session_token';
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

	startGoogleAuth(): void {
		window.location.href = `${env.VITE_BACKEND_URL}/profile/google`;
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

	async updateProfile(input: UpdateProfileData): Promise<User> {
		try {
			const response = await this.api.patch<
				APIResponse<{ profile: User }>
			>('/profile', input);
			const profile = response.data.data.profile;
			this.setUser(profile);
			this.notify();
			return profile;
		} catch (error) {
			throw this.handleError(error);
		}
	}

	async completeOnboarding(input: {
		avatarUrl: string;
		interests: string[];
	}): Promise<User> {
		const existingUser = this.getUser();

		if (!existingUser) {
			throw new Error('No active profile found');
		}

		const updatedUser: User = {
			...existingUser,
			avatarUrl: input.avatarUrl,
			interests: input.interests,
		};

		this.setUser(updatedUser);
		this.notify();
		return updatedUser;
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
			await this.api.post('/profile/logout');
		} catch (error) {
			console.error('Logout error:', error);
		} finally {
			this.clearAuth();
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
		return !!this.getUser() && !!this.getSessionToken();
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
