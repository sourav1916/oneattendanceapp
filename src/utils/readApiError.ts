import axios from 'axios';

export function readApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : 'Something went wrong';
  }

  const body = err.response?.data;
  if (typeof body === 'string' && body.trim()) {
    const text = body.trim();
    // Host/CDN error pages are HTML, not actionable API messages.
    if (/<\/?(html|head|body|script)\b/i.test(text)) {
      return `Server rejected the request (HTTP ${err.response?.status ?? 'error'}). Please try again.`;
    }
    return text;
  }
  if (body && typeof body === 'object') {
    const o = body as { message?: unknown; error?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message.trim();
    }
    if (typeof o.error === 'string' && o.error.trim()) {
      return o.error.trim();
    }
  }

  if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (!err.response && err.message === 'Network Error') {
    return 'Could not reach the server. Check your internet connection and try again.';
  }

  return err.message || 'Request failed';
}
