import { env } from '@/utils/env.utils';
import axios, { type AxiosInstance, AxiosError } from 'axios';

export interface APIResponse<T = undefined> {
	success: boolean;
	data: T;
	message: string;
}

export interface APIErrorResponse {
	success: false;
	message: string;
	code?: string;
	errors?: Array<{
		field?: string;
		message: string;
	}>;
}

export class ApiError extends Error {
	public status: number;
	public response?: APIErrorResponse;

	constructor(
		message: string,
		status: number = 500,
		response?: APIErrorResponse
	) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.response = response;
	}
}

export class BaseApiService {
	protected api: AxiosInstance;
	protected API_URL: string;

	constructor() {
		this.API_URL = env.VITE_BACKEND_URL;

		this.api = axios.create({
			baseURL: this.API_URL,
			withCredentials: true,
		});

		this.setupInterceptors();
	}

	private setupInterceptors() {
		this.api.interceptors.request.use(config => {
			const token = localStorage.getItem('tetrode_session_token');
			if (!token) return config;
			config.headers = config.headers ?? {};
			config.headers.Authorization = `Bearer ${token}`;
			return config;
		});

		this.api.interceptors.response.use(
			response => response,
			async error => {
				const status = error?.response?.status;
				const message =
					(error?.response?.data?.message as string | undefined) ?? '';

				const isSessionExpired =
					status === 401 &&
					(message.toLowerCase().includes('invalid or expired session') ||
						message.toLowerCase().includes('authentication required'));

				if (isSessionExpired) {
					const currentPath =
						typeof window !== 'undefined'
							? `${window.location.pathname}${window.location.search}`
							: '/';
					const isAuthPath =
						typeof window !== 'undefined' &&
						window.location.pathname.startsWith('/auth/');

					this.clearAuth();

					if (typeof window !== 'undefined' && !isAuthPath) {
						localStorage.setItem('tetrode_redirect_after_login', currentPath);
						window.location.href = `/auth/signin?redirect=${encodeURIComponent(currentPath)}`;
					}
				}

				return Promise.reject(error);
			}
		);
	}

	protected handleError(error: unknown): ApiError {
		if (axios.isAxiosError(error)) {
			const axiosError = error as AxiosError<APIErrorResponse>;

			if (axiosError.response) {
				const status = axiosError.response.status;
				const data = axiosError.response.data;
				const message = data?.message || 'An error occurred';
				return new ApiError(message, status, data);
			} else if (axiosError.request) {
				return new ApiError('Network error - check your connection', 0);
			}
		}

		if (error instanceof Error) {
			return new ApiError(error.message, 500);
		}

		return new ApiError('Something went wrong', 500);
	}

	protected clearAuth(): void {
		localStorage.removeItem('tetrode_session_token');
		localStorage.removeItem('tetrode_user');
	}
}
