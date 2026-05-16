/** API returns `YYYY-MM-DD HH:mm:ss` (no timezone). */
export function parseApiLocalDateTime(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/.exec(value.trim());
  if (!m) {
    return null;
  }
  const d = new Date(`${m[1]}T${m[2]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatSessionDateTime(value: string, localeTag: string): string {
  const d = parseApiLocalDateTime(value);
  if (!d) {
    return value;
  }
  try {
    return d.toLocaleString(localeTag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}
