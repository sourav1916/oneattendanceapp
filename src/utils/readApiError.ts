import axios from 'axios';

export function readApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : 'Something went wrong';
  }

  const body = err.response?.data;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  if (body && typeof body === 'object') {
    const o = body as { message?: unknown; error?: unknown };
    if (typeof o.message === 'string') {
      return o.message;
    }
    if (typeof o.error === 'string') {
      return o.error;
    }
  }

  return err.message || 'Request failed';
}
