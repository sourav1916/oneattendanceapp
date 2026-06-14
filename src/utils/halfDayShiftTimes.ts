import type { HalfDayType } from '@src/types/markAttendance';

export function timeToMinutes(time: string): number {
  const [h, m, s = 0] = time.split(':').map(Number);
  return h * 60 + m + Math.floor(s / 60);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalized / 60)).padStart(2, '0');
  const m = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}:00`;
}

/** Normalizes `HH:mm` or `HH:mm:ss` to `HH:mm` for mark-attendance API fields. */
export function normalizeToHhMm(time: string): string {
  const parts = time.trim().split(':');
  const h = String(Number(parts[0]) || 0).padStart(2, '0');
  const m = String(Number(parts[1]) || 0).padStart(2, '0');
  return `${h}:${m}`;
}

export function getShiftMidpoint(shiftStart: string, shiftEnd: string): string {
  let start = timeToMinutes(shiftStart);
  let end = timeToMinutes(shiftEnd);
  if (end <= start) {
    end += 1440;
  }
  return minutesToTime(Math.floor((start + end) / 2));
}

export type HalfDayShiftTimes = {
  start_time: string;
  end_time: string;
};

export function getHalfDayTimes(
  shiftStart: string,
  shiftEnd: string,
  halfDayType: HalfDayType,
): HalfDayShiftTimes {
  const midpoint = getShiftMidpoint(shiftStart, shiftEnd);
  if (halfDayType === 'first_half') {
    return { start_time: shiftStart, end_time: midpoint };
  }
  return { start_time: midpoint, end_time: shiftEnd };
}

export function canComputeHalfDayTimes(
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
): boolean {
  return Boolean(shiftStart?.trim() && shiftEnd?.trim());
}

export function getHalfDayTimesAsHhMm(
  shiftStart: string,
  shiftEnd: string,
  halfDayType: HalfDayType,
): { start_time: string; end_time: string } {
  const times = getHalfDayTimes(shiftStart, shiftEnd, halfDayType);
  return {
    start_time: normalizeToHhMm(times.start_time),
    end_time: normalizeToHhMm(times.end_time),
  };
}

export function hhMmToMinutes(hhmm: string): number {
  const normalized = normalizeToHhMm(hhmm);
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutesToHhMm(hhmm: string, deltaMinutes: number): string {
  const total = Math.min(
    Math.max(hhMmToMinutes(hhmm) + deltaMinutes, 0),
    23 * 60 + 59,
  );
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function durationBetweenHhMm(start: string, end: string): number | null {
  if (!start.trim() || !end.trim()) {
    return null;
  }
  const startMin = hhMmToMinutes(start);
  const endMin = hhMmToMinutes(end);
  if (endMin <= startMin) {
    return null;
  }
  return endMin - startMin;
}

export function formatDurationLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  return `${m}m`;
}

export function minutesToDurationHhMm(totalMinutes: number): string {
  const safe = Math.max(0, totalMinutes);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function durationHhMmToMinutes(hhmm: string): number {
  return hhMmToMinutes(hhmm);
}
