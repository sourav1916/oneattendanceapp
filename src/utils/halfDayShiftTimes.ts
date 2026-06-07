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
