import axios from 'axios';
import type { UserResponse } from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>('/auth/register', { username, email, password });
  return data;
}

export async function login(email: string, password: string): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export function initiateGoogleLogin(): void {
  window.location.href = `${API_BASE}/auth/google`;
}

/**
 * Request a password-reset email. Returns the generic message string from
 * the backend; the response is identical whether or not the email is
 * registered (anti-enumeration), so callers should always show "check
 * your inbox" regardless of the outcome.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
  return data;
}

/**
 * Consume a reset token and set a new password. Throws on 400 (invalid /
 * expired / reused token) so the page can show a clear error.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return data;
}
