import axios from 'axios';
import type { TFunction } from 'i18next';

import type { AppThemeColors } from '@src/theme/palettes';
import type {
  AllowedAttendanceAction,
  AttendanceShiftInfo,
  CurrentAttendanceStatusData,
  TodayAttendanceSummary,
} from '@src/types/currentAttendanceStatus';

import { readApiError } from './readApiError';

/** Formats minutes as `2h 5m` or `45m`. Returns "-" when value is missing or not a finite number. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) {
    return '-';
  }
  const m = Math.max(0, Math.floor(Number(minutes)));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) {
    return `${rem}m`;
  }
  if (rem === 0) {
    return `${h}h`;
  }
  return `${h}h ${rem}m`;
}

function finiteNonNegMinutes(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) {
    return null;
  }
  return Math.max(0, Math.floor(Number(v)));
}

function finiteNonNegHoursAsMinutes(hours: number | null | undefined): number | null {
  if (hours == null || !Number.isFinite(Number(hours))) {
    return null;
  }
  return Math.max(0, Math.round(Number(hours) * 60));
}

/** e.g. `2h 5m/8h` with "-" when the denominator is unknown (compact slash, no spaces). */
export function formatMinutesRatio(
  numeratorMin: number | null | undefined,
  denominatorMin: number | null | undefined,
): string {
  const left = formatMinutes(numeratorMin);
  const d = finiteNonNegMinutes(denominatorMin);
  const right = d == null ? '-' : formatMinutes(d);
  return `${left}/${right}`;
}

/**
 * Formats a signed minute delta for display inside parentheses, e.g. `-8h 30m`, `1h` (no leading +).
 * Returns empty string when zero or non-finite.
 */
export function formatSignedMinutesDelta(deltaMinutes: number): string {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes === 0) {
    return '';
  }
  const neg = deltaMinutes < 0;
  const abs = Math.abs(Math.round(deltaMinutes));
  const h = Math.floor(abs / 60);
  const rem = abs % 60;
  let core: string;
  if (h === 0) {
    core = `${rem}m`;
  } else if (rem === 0) {
    core = `${h}h`;
  } else {
    core = `${h}h ${rem}m`;
  }
  return neg ? `-${core}` : core;
}

/** "Sunday" from API day name (handles mixed case). */
export function capitalizeDayName(name: string | null | undefined): string {
  const t = name?.trim();
  if (!t) {
    return '';
  }
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Parses common date strings and returns `DD/MM/YYYY` (full year), or original trimmed string if unrecognized. */
export function formatDateDDMMYY(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) {
    return '';
  }
  const datePart = s.split('T')[0].split(' ')[0];
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  if (iso) {
    const y = iso[1];
    const mm = String(Number(iso[2])).padStart(2, '0');
    const dd = String(Number(iso[3])).padStart(2, '0');
    return `${dd}/${mm}/${y}`;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(datePart);
  if (dmy) {
    const dd = String(Number(dmy[1])).padStart(2, '0');
    const mm = String(Number(dmy[2])).padStart(2, '0');
    let yStr = dmy[3];
    if (yStr.length === 2) {
      const y2 = Number(yStr);
      const y4 = y2 < 70 ? 2000 + y2 : 1900 + y2;
      yStr = String(y4);
    }
    return `${dd}/${mm}/${yStr}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

function formatMinutesSinceMidnightToClock12(totalMinutes: number): string {
  let m = Math.round(totalMinutes) % (24 * 60);
  if (m < 0) {
    m += 24 * 60;
  }
  const h24 = Math.floor(m / 60) % 24;
  const min = m % 60;
  const isAm = h24 < 12;
  let h12 = h24 % 12;
  if (h12 === 0) {
    h12 = 12;
  }
  const suffix = isAm ? 'AM' : 'PM';
  return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${suffix}`;
}

function tryParseTimeStringToMinutes(raw: string): number | null {
  const t = raw.trim();

  const mer = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(t);
  if (mer) {
    let h = Number(mer[1]);
    const mi = Number(mer[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mi) || mi < 0 || mi > 59 || h < 1 || h > 12) {
      return null;
    }
    const ap = mer[4].toUpperCase();
    if (ap === 'AM') {
      h = h === 12 ? 0 : h;
    } else if (ap === 'PM') {
      h = h === 12 ? 12 : h + 12;
    } else {
      return null;
    }
    return h * 60 + mi;
  }

  const forDateParse = /\d{4}-\d{2}-\d{2} \d/.test(t) ? t.replace(' ', 'T') : t;
  const parsed = Date.parse(forDateParse);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    if (!Number.isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  const clock24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (clock24) {
    const h = Number(clock24[1]);
    const mi = Number(clock24[2]);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) {
      return h * 60 + mi;
    }
  }

  const isoTail = /[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t);
  if (isoTail) {
    const h = Number(isoTail[1]);
    const mi = Number(isoTail[2]);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) {
      return h * 60 + mi;
    }
  }

  return null;
}

/** Normalizes activity `time` from the API to `09:12 AM` for the timeline. */
export function formatTimelineClock12(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) {
    return '—';
  }
  const mins = tryParseTimeStringToMinutes(s);
  if (mins == null) {
    return s.length > 16 ? `${s.slice(0, 16)}…` : s;
  }
  return formatMinutesSinceMidnightToClock12(mins);
}

/** Prefer minutes; fall back to hours × 60 when the API sends only hours. */
export function resolveWorkedMinutes(summary: TodayAttendanceSummary | null | undefined): number | null {
  if (summary == null) {
    return null;
  }
  const m = finiteNonNegMinutes(summary.total_work_minutes);
  if (m != null) {
    return m;
  }
  return finiteNonNegHoursAsMinutes(summary.total_work_hours);
}

/** Prefer minutes; fall back to hours × 60 when the API sends only hours. */
export function resolveBreakConsumedMinutes(
  summary: TodayAttendanceSummary | null | undefined,
): number | null {
  if (summary == null) {
    return null;
  }
  const m = finiteNonNegMinutes(summary.total_break_minutes);
  if (m != null) {
    return m;
  }
  return finiteNonNegHoursAsMinutes(summary.total_break_hours);
}

/** Expected work target from shift: minutes first, else expected hours × 60. */
export function resolveExpectedWorkMinutesFromShift(shift: AttendanceShiftInfo | null | undefined): number | null {
  if (shift == null) {
    return null;
  }
  const m = finiteNonNegMinutes(shift.expected_work_minutes);
  if (m != null) {
    return m;
  }
  return finiteNonNegHoursAsMinutes(shift.expected_work_hours);
}

export function canShowAction(
  data: CurrentAttendanceStatusData | null | undefined,
  action: AllowedAttendanceAction,
): boolean {
  return data?.allowed_actions?.includes(action) ?? false;
}

export function getStatusColor(
  status: string | null | undefined,
  colors: AppThemeColors,
): string {
  switch (status) {
    case 'WORKING':
      return '#22c55e';
    case 'ON_BREAK':
      return '#f59e0b';
    case 'COMPLETED':
      return colors.primary;
    case 'HOLIDAY':
      return '#a855f7';
    case 'WEEKEND':
      return colors.textMuted;
    case 'LEAVE':
      return '#ca8a04';
    case 'ABSENT':
      return '#dc2626';
    case 'NOT_PUNCHED_IN':
    default:
      return colors.textMuted;
  }
}

export function getStatusLabel(status: string | null | undefined, t: TFunction): string {
  const key = `attendance.statusApi.${status ?? 'unknown'}`;
  const translated = t(key);
  if (translated === key) {
    return t('attendance.statusApi.unknown');
  }
  return translated;
}

export function getActivityLabel(type: string | null | undefined, t: TFunction): string {
  if (type == null || String(type).trim() === '') {
    return t('attendance.activityLabel.unknown');
  }
  const key = `attendance.activityLabel.${type}`;
  const translated = t(key);
  if (translated === key) {
    return t('attendance.activityLabel.unknown');
  }
  return translated;
}

export function getMethodLabel(method: string | null | undefined, t: TFunction): string {
  const m = (method ?? '').toLowerCase().trim();
  if (!m) {
    return '-';
  }
  const key = `attendance.methodLabel.${m}`;
  const translated = t(key);
  if (translated === key) {
    return m;
  }
  return translated;
}

/**
 * Maps fetch errors to user-facing copy: network (no response), 401/404, body message, or generic.
 */
export function resolveAttendanceStatusFetchError(err: unknown, t: TFunction): string {
  if (!axios.isAxiosError(err)) {
    const msg = readApiError(err);
    if (msg == null || String(msg).trim() === '') {
      return t('attendance.errors.unexpected');
    }
    return msg;
  }
  if (err.response == null) {
    return t('attendance.errors.network');
  }
  const s = err.response.status;
  if (s === 401) {
    return t('attendance.errors.sessionExpired');
  }
  if (s === 404) {
    return t('attendance.errors.employeeNotFound');
  }
  const bodyMsg = readApiError(err);
  return bodyMsg != null && String(bodyMsg).trim() !== ''
    ? bodyMsg
    : t('attendance.errors.unexpected');
}

/** @deprecated Use resolveAttendanceStatusFetchError */
export function mapAttendanceStatusLoadError(err: unknown, t: TFunction): string {
  return resolveAttendanceStatusFetchError(err, t);
}
