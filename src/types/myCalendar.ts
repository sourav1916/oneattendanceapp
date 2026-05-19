export type CalendarDayStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'weekend'
  | 'half_day'
  | 'not_joined'
  | 'upcoming';

export type CalendarActivityType = 'PUNCH_IN' | 'PUNCH_OUT';
export type CalendarBreakType = 'BREAK_START' | 'BREAK_END';
export type CalendarLogType =
  | 'PUNCH_IN'
  | 'PUNCH_OUT'
  | 'BREAK_START'
  | 'BREAK_END'
  | 'day_status';

export type CalendarActivity = {
  type: CalendarActivityType;
  time: string;
  attendance_method: string;
};

export type CalendarBreak = {
  type: CalendarBreakType;
  time: string;
  attendance_method: string;
};

export type CalendarLog = {
  log_type: CalendarLogType | string;
  time: string;
  attendance_method?: string;
  day_status?: CalendarDayStatus;
};

export type CalendarHolidayDetails = {
  name: string;
  is_optional: boolean;
};

export type CalendarLeaveDetails = {
  code: string;
  name: string;
  type: string;
  half_day_type: string | null;
};

export type CalendarDayInfo = {
  day_status: CalendarDayStatus;
  is_approved?: boolean;
  is_deductible?: boolean;
  activities?: CalendarActivity[][];
  breaks?: CalendarBreak[][];
  logs?: CalendarLog[];
  is_holiday?: CalendarHolidayDetails;
  is_leave?: CalendarLeaveDetails;
};

export type CalendarShift = {
  start_time: string;
  end_time: string;
  expected_work_minutes: number;
  break_minutes: number;
};

export type CalendarStatistics = {
  expected_work_minutes: number;
  worked_minutes: number;
  expected_break_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
};

export type CalendarMeta = {
  year: number;
  month: number;
  total_days: number;
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  weekend: number;
  half_day: number;
  not_joined: number;
  upcoming: number;
};

export type MyCalendarData = {
  shift?: CalendarShift | null;
  days: Record<string, CalendarDayInfo>;
  statistics?: CalendarStatistics | null;
};

export type MyCalendarResponse = {
  success: boolean;
  message: string;
  data: MyCalendarData | null;
  meta?: CalendarMeta | null;
};
