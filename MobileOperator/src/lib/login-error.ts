import type { AxiosError } from 'axios';

import { API_URL } from '../config/env';
import { getApiErrorMessage } from '../lib/api-error';

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const axiosError = error as AxiosError;
  if (axiosError.code === 'ERR_NETWORK') return true;
  if (axiosError.message === 'Network Error') return true;
  return !axiosError.response;
}

export function getLoginErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return `Cannot reach the server (${API_URL}). On a physical phone, use mobile data or Wi‑Fi that can access the PRMSC server — not localhost.`;
  }

  const serverMessage = getApiErrorMessage(error, '');
  if (serverMessage) return serverMessage;

  return 'Login failed. Check your email, password, and connection.';
}
