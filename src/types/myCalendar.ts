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

export type CalendarCreatedBy = {
  name: string;
  role: string;
};

export type CalendarActivity = {
  type: CalendarActivityType;
  time: string;
  attendance_method: string;
  created_by?: CalendarCreatedBy;
};

export type CalendarBreak = {
  type: CalendarBreakType;
  time: string;
  attendance_method: string;
  created_by?: CalendarCreatedBy;
};

export type CalendarLog = {
  log_type: CalendarLogType | string;
  time: string;
  attendance_method?: string;
  day_status?: CalendarDayStatus;
  created_by?: CalendarCreatedBy;
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

export type CalendarVerifiedBy = {
  name: string;
  role: string;
};

export type CalendarDayInfo = {
  day_status: CalendarDayStatus;
  is_approved?: boolean;
  verified_by?: CalendarVerifiedBy | null;
  is_deductible?: boolean;
  is_overtime?: boolean;
  activities?: CalendarActivity[];
  breaks?: CalendarBreak[];
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

export type MyCalendarData = {
  shift?: CalendarShift | null;
  days: Record<string, CalendarDayInfo>;
};

export type MyCalendarResponse = {
  success: boolean;
  message: string;
  data: MyCalendarData | null;
};
