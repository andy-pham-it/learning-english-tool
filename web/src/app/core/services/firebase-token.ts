import { Auth } from '@angular/fire/auth';

/**
 * Builds request headers for /api/* calls, attaching the current user's
 * Firebase ID token as a Bearer token when signed in.
 */
export async function buildAuthHeaders(auth: Auth): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (!user) {
    return headers;
  }
  try {
    const token = await user.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.error('[firebase-token] Failed to obtain ID token:', err);
  }
  return headers;
}
