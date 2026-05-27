import type {
  AttendanceMethodConstant,
  ConstantOption,
} from '@src/types/employeeManagement';
import type {
  AttendanceMethodConstantValue,
  ConstantEntry,
  GlobalConstantsData,
} from '@src/types/globalConstants';

export type InvitePackageFormConstants = {
  designations: ConstantOption[];
  employment_types: ConstantOption[];
  salary_types: ConstantOption[];
  attendance_methods: AttendanceMethodConstant[];
};

function mapOptions(
  entries: ConstantEntry[] | undefined,
): ConstantOption[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter(e => e?.value?.value != null && e.value.label != null)
    .map(e => ({
      value: String(e.value.value),
      label: String(e.value.label),
    }));
}

function mapAttendanceMethods(
  entries: ConstantEntry<AttendanceMethodConstantValue>[] | undefined,
): AttendanceMethodConstant[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter(e => e?.value?.value != null && e.value.label != null)
    .map(e => ({
      id: String(e.value.value),
      name: String(e.value.label),
      available: e.value.is_available !== false,
      requiresDevice: Boolean(e.value.requiresDevice),
    }));
}

export function mapGlobalConstantsToFormConstants(
  data: GlobalConstantsData,
): InvitePackageFormConstants {
  return {
    designations: mapOptions(data.designations),
    employment_types: mapOptions(data.employment_types),
    salary_types: mapOptions(data.salary_types),
    attendance_methods: mapAttendanceMethods(data.attendance_methods),
  };
}
