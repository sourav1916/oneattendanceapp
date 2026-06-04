/** Calendar helpers for {@link DatePicker} (ISO `YYYY-MM-DD` only). */

export function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  return { y, m: mo, d };
}

export function toIsoDateParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Sunday … 6 = Saturday for the first of the month. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export type CalendarCell = {
  day: number;
  iso: string;
  inMonth: boolean;
  disabled: boolean;
  isToday: boolean;
  isSelected: boolean;
};

export function buildMonthGrid(options: {
  viewYear: number;
  viewMonth: number;
  selectedIso: string;
  todayIso: string;
  minDate?: string;
  maxDate?: string;
  weekStartsOn: 0 | 1;
}): CalendarCell[] {
  const { viewYear, viewMonth, selectedIso, todayIso, minDate, maxDate, weekStartsOn } = options;
  const totalDays = daysInMonth(viewYear, viewMonth);
  let startPad = firstWeekdayOfMonth(viewYear, viewMonth) - weekStartsOn;
  if (startPad < 0) {
    startPad += 7;
  }

  const cells: CalendarCell[] = [];

  const prev = shiftMonth(viewYear, viewMonth, -1);
  const prevDays = daysInMonth(prev.y, prev.m);
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevDays - i;
    const iso = toIsoDateParts(prev.y, prev.m, day);
    cells.push(makeCell(day, iso, false, selectedIso, todayIso, minDate, maxDate));
  }

  for (let day = 1; day <= totalDays; day++) {
    const iso = toIsoDateParts(viewYear, viewMonth, day);
    cells.push(makeCell(day, iso, true, selectedIso, todayIso, minDate, maxDate));
  }

  const nextMonth = shiftMonth(viewYear, viewMonth, 1);
  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    const iso = toIsoDateParts(nextMonth.y, nextMonth.m, trailingDay);
    cells.push(makeCell(trailingDay, iso, false, selectedIso, todayIso, minDate, maxDate));
    trailingDay += 1;
  }

  return cells;
}

function makeCell(
  day: number,
  iso: string,
  inMonth: boolean,
  selectedIso: string,
  todayIso: string,
  minDate?: string,
  maxDate?: string,
): CalendarCell {
  let disabled = !inMonth;
  if (minDate && compareIso(iso, minDate) < 0) {
    disabled = true;
  }
  if (maxDate && compareIso(iso, maxDate) > 0) {
    disabled = true;
  }
  return {
    day,
    iso,
    inMonth,
    disabled,
    isToday: iso === todayIso,
    isSelected: iso === selectedIso,
  };
}

export function monthYearLabel(year: number, month: number, locale: string): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function weekdayLabels(locale: string, weekStartsOn: 0 | 1): string[] {
  const base = new Date(2024, 0, 7);
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + ((weekStartsOn + i) % 7));
    labels.push(d.toLocaleDateString(locale, { weekday: 'short' }));
  }
  return labels;
}

export function viewFromIso(iso: string, fallback: { y: number; m: number }): { y: number; m: number } {
  const p = parseIsoDate(iso);
  if (!p) {
    return fallback;
  }
  return { y: p.y, m: p.m };
}

export type RangeCalendarCell = CalendarCell & {
  isRangeStart: boolean;
  isRangeEnd: boolean;
  inRange: boolean;
};

function normalizeRange(start: string | null, end: string | null): [string | null, string | null] {
  if (start == null || end == null) {
    return [start, end];
  }
  return compareIso(start, end) <= 0 ? [start, end] : [end, start];
}

function isIsoInRange(iso: string, start: string | null, end: string | null): boolean {
  const [rangeStart, rangeEnd] = normalizeRange(start, end);
  if (rangeStart == null) {
    return false;
  }
  if (rangeEnd == null) {
    return iso === rangeStart;
  }
  return compareIso(iso, rangeStart) >= 0 && compareIso(iso, rangeEnd) <= 0;
}

export function buildMonthRangeGrid(options: {
  viewYear: number;
  viewMonth: number;
  startIso: string | null;
  endIso: string | null;
  todayIso: string;
  minDate?: string;
  maxDate?: string;
  weekStartsOn: 0 | 1;
}): RangeCalendarCell[] {
  const { viewYear, viewMonth, startIso, endIso, todayIso, minDate, maxDate, weekStartsOn } =
    options;
  const [rangeStart, rangeEnd] = normalizeRange(startIso, endIso);
  const anchorIso = rangeStart ?? rangeEnd ?? todayIso;
  const base = buildMonthGrid({
    viewYear,
    viewMonth,
    selectedIso: anchorIso,
    todayIso,
    minDate,
    maxDate,
    weekStartsOn,
  });

  return base.map(cell => ({
    ...cell,
    isSelected: false,
    isRangeStart: rangeStart != null && cell.iso === rangeStart,
    isRangeEnd: rangeEnd != null && cell.iso === rangeEnd,
    inRange: isIsoInRange(cell.iso, startIso, endIso),
  }));
}
