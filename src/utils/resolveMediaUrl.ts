import { API_ENDPOINT } from '@src/utils/config';

/** Absolute URL for remote images (full `https://` or API-relative path). */
export function resolveMediaUrl(path: string | null | undefined): string {
  const p = path?.trim() ?? '';
  if (!p) {
    return '';
  }
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}
