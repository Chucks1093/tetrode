import { redirect } from 'react-router';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/services/api.service';

export async function requireAuthLoader({
	request,
}: {
	request: Request;
}) {
	const currentUrl = new URL(request.url);
	const targetPath = `${currentUrl.pathname}${currentUrl.search}`;
	const token = authService.getSessionToken();
	if (!token) {
		return redirect(`/auth/signin?redirect=${encodeURIComponent(targetPath)}`);
	}

	try {
		const profile = await authService.getProfile();
		if (!profile) {
			await authService.logout();
			return redirect(
				`/auth/signin?redirect=${encodeURIComponent(targetPath)}`
			);
		}

		if (!profile.emailVerified) {
			return redirect('/auth/verify');
		}

		return null;
	} catch (error) {
		// Only force logout on actual auth failures (401/403).
		// Network errors (server restarting, offline) should not wipe the session.
		if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
			await authService.logout();
			return redirect(`/auth/signin?redirect=${encodeURIComponent(targetPath)}`);
		}
		return null;
	}
}
