import type { EmployeeLeaveRow } from '@src/types/employeeLeave';
import type { ApproveEditLeavePayload } from '@src/types/leaveManagement';

export type ApproveLeaveFormValues = {
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayType: 'first_half' | 'second_half';
};

/** Builds PUT /leave/management/approve-edit body; omits unchanged optional fields. */
export function buildApproveEditPayload(
  leave: EmployeeLeaveRow,
  form: ApproveLeaveFormValues,
): ApproveEditLeavePayload {
  const payload: ApproveEditLeavePayload = { id: leave.id };

  const datesChanged =
    form.startDate !== leave.start_date || form.endDate !== leave.end_date;
  const halfDayChanged = form.isHalfDay !== leave.is_half_day;
  const halfTypeChanged =
    form.isHalfDay &&
    form.halfDayType !== (leave.half_day_type ?? 'first_half');

  if (!datesChanged && !halfDayChanged && !halfTypeChanged) {
    return payload;
  }

  if (form.isHalfDay) {
    payload.is_half_day = true;
    payload.half_day_type = form.halfDayType;
    payload.start_date = form.startDate;
    payload.end_date = form.endDate;
    return payload;
  }

  if (halfDayChanged) {
    payload.is_half_day = false;
  }
  if (form.startDate !== leave.start_date) {
    payload.start_date = form.startDate;
  }
  if (form.endDate !== leave.end_date) {
    payload.end_date = form.endDate;
  }

  return payload;
}
