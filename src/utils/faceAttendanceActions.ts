import type { TFunction } from 'i18next';

import type { FaceAttendanceActionType } from '@src/types/faceAttendance';

export const FACE_ATTENDANCE_ACTIONS: FaceAttendanceActionType[] = [
  'punch in',
  'punch out',
  'break start',
  'break end',
];

export function faceAttendanceActionLabel(
  t: TFunction,
  action: FaceAttendanceActionType,
): string {
  switch (action) {
    case 'punch in':
      return t('home.faceAttendance.actions.punchIn');
    case 'punch out':
      return t('home.faceAttendance.actions.punchOut');
    case 'break start':
      return t('home.faceAttendance.actions.breakStart');
    case 'break end':
      return t('home.faceAttendance.actions.breakEnd');
    default:
      return action;
  }
}

export function faceAttendanceActionHint(
  t: TFunction,
  action: FaceAttendanceActionType,
): string {
  switch (action) {
    case 'punch in':
      return t('home.faceAttendance.actionHints.punchIn');
    case 'punch out':
      return t('home.faceAttendance.actionHints.punchOut');
    case 'break start':
      return t('home.faceAttendance.actionHints.breakStart');
    case 'break end':
      return t('home.faceAttendance.actionHints.breakEnd');
    default:
      return '';
  }
}
