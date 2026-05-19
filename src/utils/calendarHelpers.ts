import type { CalendarDayInfo, CalendarDayStatus } from '@src/types/myCalendar';

export type CalendarGridCell = {
  day: number | null;
  dateKey: string | null;
  dayInfo: CalendarDayInfo | null;
};

export type StatusVisualStyle = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  muted?: boolean;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const STATUS_STYLES: Record<CalendarDayStatus, StatusVisualStyle> = {
  present: {
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    borderColor: '#86efac',
  },
  absent: {
    backgroundColor: '#fee2e2',
    textColor: '#991b1b',
    borderColor: '#fca5a5',
  },
  leave: {
    backgroundColor: '#fef9c3',
    textColor: '#a16207',
    borderColor: '#fde047',
  },
  holiday: {
    backgroundColor: '#dbeafe',
    textColor: '#1e40af',
    borderColor: '#93c5fd',
  },
  weekend: {
    backgroundColor: '#f1f5f9',
    textColor: '#475569',
    borderColor: '#cbd5e1',
  },
  half_day: {
    backgroundColor: '#ffedd5',
    textColor: '#9a3412',
    borderColor: '#fdba74',
  },
  not_joined: {
    backgroundColor: '#f8fafc',
    textColor: '#94a3b8',
    borderColor: '#e2e8f0',
    muted: true,
  },
  upcoming: {
    backgroundColor: '#f8fafc',
    textColor: '#64748b',
    borderColor: '#e2e8f0',
  },
};

export function getMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Sunday-first offset (0 = Sunday). */
export function getFirstDayOffset(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function formatMonthTitle(year: number, month: number): string {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  return `${name} ${year}`;
}

export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function getStatusStyle(status: CalendarDayStatus | string | undefined): StatusVisualStyle {
  if (status && status in STATUS_STYLES) {
    return STATUS_STYLES[status as CalendarDayStatus];
  }
  return STATUS_STYLES.upcoming;
}

export function buildCalendarGrid(
  year: number,
  month: number,
  days: Record<string, CalendarDayInfo> | undefined,
): CalendarGridCell[] {
  const offset = getFirstDayOffset(year, month);
  const totalDays = getMonthDays(year, month);
  const grid: CalendarGridCell[] = [];

  for (let i = 0; i < offset; i += 1) {
    grid.push({ day: null, dateKey: null, dayInfo: null });
  }

  for (let d = 1; d <= totalDays; d += 1) {
    const dateKey = formatDateKey(year, month, d);
    grid.push({
      day: d,
      dateKey,
      dayInfo: days?.[dateKey] ?? null,
    });
  }

  return grid;
}

export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Whether a day has modal content beyond a bare status (e.g. planned leave on upcoming days). */
export function hasCalendarDayDetails(dayInfo: CalendarDayInfo | null | undefined): boolean {
  if (!dayInfo) {
    return false;
  }
  return Boolean(
    (dayInfo.activities?.length ?? 0) > 0 ||
      (dayInfo.breaks?.length ?? 0) > 0 ||
      (dayInfo.logs?.length ?? 0) > 0 ||
      dayInfo.is_holiday ||
      dayInfo.is_leave ||
      dayInfo.is_approved != null ||
      dayInfo.is_deductible != null,
  );
}

/** e.g. 8400 → "140h 0m", 120 → "2h 0m" */
export function formatMinutesToDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

export function formatLogTypeLabel(logType: string): string {
  if (logType === 'day_status') {
    return 'Day status';
  }
  return logType
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatAttendanceMethod(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let nextMonth = month + delta;
  let nextYear = year;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}
