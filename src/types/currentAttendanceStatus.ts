export type AttendanceDayStatus =
  | 'NOT_PUNCHED_IN'
  | 'WORKING'
  | 'ON_BREAK'
  | 'COMPLETED'
  | 'HOLIDAY'
  | 'WEEKEND';

/** Methods the current-status API may expose for punch UI (lowercase strings). */
export type AttendanceUiMethod = 'manual' | 'gps' | 'ip' | 'qr';

export type AllowedAttendanceAction =
  | 'PUNCH_IN'
  | 'PUNCH_OUT'
  | 'BREAK_START'
  | 'BREAK_END';

export type TodayActivityType =
  | 'PUNCH_IN'
  | 'PUNCH_OUT'
  | 'BREAK_START'
  | 'BREAK_END';

export type ActivityLocation = {
  latitude?: number | null;
  longitude?: number | null;
};

export type TodayActivity = {
  type: TodayActivityType;
  attendance_id?: number | null;
  time?: string | null;
  attendance_method?: string | null;
  location?: ActivityLocation | null;
  ip_address?: string | null;
};

export type AttendanceDayInfo = {
  date?: string | null;
  day_name?: string | null;
  is_weekend?: boolean;
  is_holiday?: boolean;
  holiday_name?: string | null;
};

export type AttendanceShiftInfo = {
  start_time?: string | null;
  end_time?: string | null;
  expected_work_minutes?: number | null;
  expected_work_hours?: number | null;
  allowed_break_minutes?: number | null;
  grace_minutes?: number | null;
};

/** Present only for WORKING / ON_BREAK / COMPLETED when API sends it. Fields are optional. */
export type TodayAttendanceSummary = {
  total_work_minutes?: number | null;
  total_break_minutes?: number | null;
  total_work_hours?: number | null;
  total_break_hours?: number | null;
  total_sessions?: number | null;
  total_breaks?: number | null;
  is_live?: boolean;
  is_on_break?: boolean;
};

export type CurrentAttendanceStatusData = {
  employee_id?: number;
  status: AttendanceDayStatus;
  allowed_actions: AllowedAttendanceAction[];
  /** When set, only these punch methods are enabled in the UI. Omitted for older APIs (all methods). */
  allowed_methods?: AttendanceUiMethod[];
  day_info?: AttendanceDayInfo | null;
  shift?: AttendanceShiftInfo | null;
  today_summary?: TodayAttendanceSummary | null;
  today_activities?: TodayActivity[];
};

export type CurrentAttendanceStatusResponse = {
  success: boolean;
  message: string;
  data?: CurrentAttendanceStatusData | null;
};

const VALID_STATUSES: readonly AttendanceDayStatus[] = [
  'NOT_PUNCHED_IN',
  'WORKING',
  'ON_BREAK',
  'COMPLETED',
  'HOLIDAY',
  'WEEKEND',
] as const;

const VALID_ACTIONS: readonly AllowedAttendanceAction[] = [
  'PUNCH_IN',
  'PUNCH_OUT',
  'BREAK_START',
  'BREAK_END',
] as const;

const VALID_UI_METHODS: readonly AttendanceUiMethod[] = [
  'manual',
  'gps',
  'ip',
  'qr',
] as const;

function isAttendanceUiMethod(v: unknown): v is AttendanceUiMethod {
  return typeof v === 'string' && (VALID_UI_METHODS as readonly string[]).includes(v);
}

function normalizeAllowedMethodsArray(raw: unknown): AttendanceUiMethod[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: AttendanceUiMethod[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const n = item.trim().toLowerCase();
    if (isAttendanceUiMethod(n)) {
      out.push(n);
    }
  }
  return out;
}

function isAllowedAction(v: unknown): v is AllowedAttendanceAction {
  return typeof v === 'string' && (VALID_ACTIONS as readonly string[]).includes(v);
}

function isAttendanceStatus(v: unknown): v is AttendanceDayStatus {
  return typeof v === 'string' && (VALID_STATUSES as readonly string[]).includes(v);
}

function isActivityType(v: unknown): v is TodayActivityType {
  return (
    v === 'PUNCH_IN' ||
    v === 'PUNCH_OUT' ||
    v === 'BREAK_START' ||
    v === 'BREAK_END'
  );
}

function parseLocation(raw: unknown): ActivityLocation | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const L = raw as Record<string, unknown>;
  const lat =
    typeof L.latitude === 'number' && Number.isFinite(L.latitude)
      ? L.latitude
      : typeof L.latitude === 'string' && Number.isFinite(Number(L.latitude))
        ? Number(L.latitude)
        : undefined;
  const lng =
    typeof L.longitude === 'number' && Number.isFinite(L.longitude)
      ? L.longitude
      : typeof L.longitude === 'string' && Number.isFinite(Number(L.longitude))
        ? Number(L.longitude)
        : undefined;
  if (lat == null && lng == null) {
    return null;
  }
  return { latitude: lat ?? null, longitude: lng ?? null };
}

function normalizeTodaySummary(
  raw: unknown,
): TodayAttendanceSummary | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const s = raw as Record<string, unknown>;
  const out: TodayAttendanceSummary = {};
  if (typeof s.total_work_minutes === 'number' && Number.isFinite(s.total_work_minutes)) {
    out.total_work_minutes = Math.max(0, Math.round(s.total_work_minutes));
  }
  if (typeof s.total_break_minutes === 'number' && Number.isFinite(s.total_break_minutes)) {
    out.total_break_minutes = Math.max(0, Math.round(s.total_break_minutes));
  }
  if (typeof s.total_work_hours === 'number' && Number.isFinite(s.total_work_hours)) {
    out.total_work_hours = s.total_work_hours;
  }
  if (typeof s.total_break_hours === 'number' && Number.isFinite(s.total_break_hours)) {
    out.total_break_hours = s.total_break_hours;
  }
  if (typeof s.total_sessions === 'number' && Number.isFinite(s.total_sessions)) {
    out.total_sessions = Math.max(0, Math.round(s.total_sessions));
  }
  if (typeof s.total_breaks === 'number' && Number.isFinite(s.total_breaks)) {
    out.total_breaks = Math.max(0, Math.round(s.total_breaks));
  }
  if (typeof s.is_live === 'boolean') {
    out.is_live = s.is_live;
  }
  if (typeof s.is_on_break === 'boolean') {
    out.is_on_break = s.is_on_break;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Coerces a partial API payload into a safe shape. Omits `shift`, `today_summary`, and
 * `today_activities` when the API does not send them (e.g. HOLIDAY / WEEKEND / NOT_PUNCHED_IN).
 */
export function normalizeCurrentAttendanceStatusData(
  raw: Partial<CurrentAttendanceStatusData> | null | undefined,
): CurrentAttendanceStatusData {
  const allowedRaw = raw?.allowed_actions;
  const allowed_actions: AllowedAttendanceAction[] = Array.isArray(allowedRaw)
    ? allowedRaw.filter(isAllowedAction)
    : [];

  const activitiesRaw = raw?.today_activities;
  const today_activities: TodayActivity[] = [];
  if (Array.isArray(activitiesRaw)) {
    for (const row of activitiesRaw) {
      if (row == null || typeof row !== 'object') {
        continue;
      }
      const rec = row as Record<string, unknown>;
      if (!isActivityType(rec.type)) {
        continue;
      }
      const type = rec.type;
      let attendance_id: number | undefined;
      if (typeof rec.attendance_id === 'number') {
        attendance_id = rec.attendance_id;
      } else if (typeof rec.attendance_id === 'string' && /^\d+$/.test(rec.attendance_id)) {
        attendance_id = Number(rec.attendance_id);
      }
      const method =
        typeof rec.attendance_method === 'string' ? rec.attendance_method.trim() : null;
      const ip = typeof rec.ip_address === 'string' ? rec.ip_address.trim() : null;
      const location = parseLocation(rec.location);
      today_activities.push({
        type,
        attendance_id,
        time: typeof rec.time === 'string' ? rec.time : null,
        attendance_method: method || null,
        ip_address: ip && ip.length > 0 ? ip : null,
        location,
      });
    }
  }

  const status: AttendanceDayStatus = isAttendanceStatus(raw?.status)
    ? raw.status
    : 'NOT_PUNCHED_IN';

  const di = raw?.day_info;
  const day_info: AttendanceDayInfo | null =
    di != null && typeof di === 'object'
      ? (() => {
          const d = di as Record<string, unknown>;
          return {
            date: typeof d.date === 'string' ? d.date : null,
            day_name: typeof d.day_name === 'string' ? d.day_name : null,
            is_weekend: typeof d.is_weekend === 'boolean' ? d.is_weekend : undefined,
            is_holiday: typeof d.is_holiday === 'boolean' ? d.is_holiday : undefined,
            holiday_name: typeof d.holiday_name === 'string' ? d.holiday_name : null,
          };
        })()
      : null;

  const shiftParsed: AttendanceShiftInfo | null =
    raw?.shift != null && typeof raw.shift === 'object'
      ? (() => {
          const s = raw.shift as Record<string, unknown>;
          return {
            start_time: typeof s.start_time === 'string' ? s.start_time : null,
            end_time: typeof s.end_time === 'string' ? s.end_time : null,
            expected_work_minutes:
              typeof s.expected_work_minutes === 'number' && Number.isFinite(s.expected_work_minutes)
                ? s.expected_work_minutes
                : null,
            expected_work_hours:
              typeof s.expected_work_hours === 'number' && Number.isFinite(s.expected_work_hours)
                ? s.expected_work_hours
                : null,
            allowed_break_minutes:
              typeof s.allowed_break_minutes === 'number' && Number.isFinite(s.allowed_break_minutes)
                ? s.allowed_break_minutes
                : null,
            grace_minutes:
              typeof s.grace_minutes === 'number' && Number.isFinite(s.grace_minutes)
                ? s.grace_minutes
                : null,
          };
        })()
      : null;

  const today_summary =
    raw != null && Object.prototype.hasOwnProperty.call(raw, 'today_summary')
      ? normalizeTodaySummary(raw.today_summary)
      : undefined;

  const today_activities_out =
    raw != null && Object.prototype.hasOwnProperty.call(raw, 'today_activities')
      ? today_activities
      : undefined;

  const shift_out =
    raw != null && Object.prototype.hasOwnProperty.call(raw, 'shift') ? shiftParsed : undefined;

  const allowed_methods_out = raw?.allowed_methods;
  const allowed_methods =
    raw != null && Object.prototype.hasOwnProperty.call(raw, 'allowed_methods')
      ? normalizeAllowedMethodsArray(allowed_methods_out)
      : undefined;

  return {
    employee_id:
      typeof raw?.employee_id === 'number' && Number.isFinite(raw.employee_id)
        ? raw.employee_id
        : undefined,
    status,
    allowed_actions,
    ...(allowed_methods !== undefined ? { allowed_methods } : {}),
    day_info,
    ...(shift_out !== undefined ? { shift: shift_out } : {}),
    ...(today_summary !== undefined ? { today_summary } : {}),
    ...(today_activities_out !== undefined ? { today_activities: today_activities_out } : {}),
  };
}
