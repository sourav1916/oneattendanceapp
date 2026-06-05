export function coerceLeaveDays(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatLeaveDays(value: unknown): string {
  const n = coerceLeaveDays(value);
  if (Number.isInteger(n)) {
    return String(n);
  }
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? String(Math.round(n)) : fixed;
}
