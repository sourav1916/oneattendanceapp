import type { AttendanceDayStatus, LabeledValue, PunchPayload } from '@src/types/attendanceList';
import { API_ENDPOINT } from '@src/utils/config';

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDaysIso(iso: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return iso;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

export function resolveProfilePictureUrl(path: string | null): string | null {
  if (path == null || path.trim() === '') {
    return null;
  }
  const p = path.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

export function punchHasTime(punch: PunchPayload | null | undefined): boolean {
  return (
    punch != null &&
    typeof punch.time === 'string' &&
    punch.time.trim().length > 0
  );
}

export function formatTimeShort(time: string | null | undefined): string {
  if (time == null || typeof time !== 'string') {
    return '—';
  }
  const t = time.trim();
  if (!t) {
    return '—';
  }
  if (t.length >= 5) {
    return t.slice(0, 5);
  }
  return t;
}

export function formatWorkedMinutes(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

export function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return iso.trim();
  }
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** e.g. `22/05/2026 (Friday)` */
export function formatDateWithWeekday(iso: string, locale = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return iso.trim();
  }
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
  return `${d}/${mo}/${y} (${weekday})`;
}

export function labeledValueLabel(field: LabeledValue | string | null | undefined): string {
  if (field == null) {
    return '';
  }
  if (typeof field === 'string') {
    return field.trim();
  }
  const label = field.label?.trim();
  if (label) {
    return label;
  }
  return field.value?.trim() ?? '';
}

export function sortAttendancesDesc<T extends { attendance_date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
}

export type DayStatusVisual = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

export function dayStatusVisual(
  status: AttendanceDayStatus,
  scheme: 'light' | 'dark',
): DayStatusVisual {
  const dark = scheme === 'dark';
  switch (status) {
    case 'present':
      return {
        backgroundColor: dark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
        textColor: dark ? '#4ade80' : '#15803d',
        borderColor: dark ? 'rgba(74, 222, 128, 0.45)' : '#86efac',
      };
    case 'absent':
      return {
        backgroundColor: dark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
        textColor: dark ? '#f87171' : '#b91c1c',
        borderColor: dark ? 'rgba(248, 113, 113, 0.4)' : '#fca5a5',
      };
    case 'leave':
      return {
        backgroundColor: dark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff',
        textColor: dark ? '#c084fc' : '#7e22ce',
        borderColor: dark ? 'rgba(192, 132, 252, 0.45)' : '#d8b4fe',
      };
    case 'half_day':
      return {
        backgroundColor: dark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5',
        textColor: dark ? '#fb923c' : '#c2410c',
        borderColor: dark ? 'rgba(251, 146, 60, 0.45)' : '#fdba74',
      };
    case 'unmarked':
    default:
      return {
        backgroundColor: dark ? 'rgba(148, 163, 184, 0.2)' : '#f1f5f9',
        textColor: dark ? '#94a3b8' : '#475569',
        borderColor: dark ? 'rgba(148, 163, 184, 0.4)' : '#cbd5e1',
      };
  }
}

export function punchMethodIcon(method: string | undefined): string {
  const m = (method ?? 'manual').toLowerCase();
  if (m.includes('gps') || m.includes('geo')) {
    return 'crosshairs-gps';
  }
  if (m.includes('qr')) {
    return 'qrcode-scan';
  }
  if (m.includes('face')) {
    return 'face-recognition';
  }
  if (m.includes('finger')) {
    return 'fingerprint';
  }
  return 'gesture-tap';
}
