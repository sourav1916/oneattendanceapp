import { useFocusEffect } from '@react-navigation/native';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  postBreakIn,
  postBreakOut,
  postPunchIn,
  postPunchOut,
} from '@src/api/attendancePunchActions';
import { useCurrentAttendanceStatus } from '@src/api/getCurrentAttendanceStatus';
import {
  AttendanceSwipeConfirmModal,
  type AttendanceMutationEndpoint,
} from '@src/components/modals/AttendanceSwipeConfirmModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { ensureLocationForVerify } from '@src/screens/auth/optionalLocationCoords';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  ApiAttendanceMethod,
  AttendancePunchPayload,
  PunchActionResponse,
} from '@src/types/attendancePunch';
import type {
  AllowedAttendanceAction,
  AttendanceUiMethod,
  CurrentAttendanceStatusData,
  TodayActivity,
  TodayActivityType,
} from '@src/types/currentAttendanceStatus';
import {
  canShowAction,
  capitalizeDayName,
  formatDateDDMMYY,
  formatMinutesRatio,
  formatSignedMinutesDelta,
  formatTimelineClock12,
  getActivityLabel,
  getMethodLabel,
  getStatusColor,
  getStatusLabel,
  resolveBreakConsumedMinutes,
  resolveExpectedWorkMinutesFromShift,
  resolveWorkedMinutes,
} from '@src/utils/attendanceStatusUi';
import { readApiError } from '@src/utils/readApiError';

export type AttendanceMethod = AttendanceUiMethod;

const METHOD_IDS: AttendanceMethod[] = ['manual', 'gps', 'ip', 'qr'];

function isAttendanceMethodAllowed(
  data: CurrentAttendanceStatusData | null | undefined,
  id: AttendanceMethod,
): boolean {
  const list = data?.allowed_methods;
  if (list == null) {
    return true;
  }
  return list.includes(id);
}

type PunchRowSpec = {
  action: AllowedAttendanceAction;
  endpoint: AttendanceMutationEndpoint;
  variant: 'primary' | 'secondary' | 'outline';
  i18nKey: 'in' | 'out' | 'breakStart' | 'breakEnd';
};

const ACTION_BUTTON_CONFIG: Record<
  AllowedAttendanceAction,
  Omit<PunchRowSpec, 'action'>
> = {
  PUNCH_IN: { endpoint: 'in', variant: 'primary', i18nKey: 'in' },
  PUNCH_OUT: { endpoint: 'out', variant: 'outline', i18nKey: 'out' },
  BREAK_START: { endpoint: 'break-in', variant: 'secondary', i18nKey: 'breakStart' },
  BREAK_END: { endpoint: 'break-out', variant: 'secondary', i18nKey: 'breakEnd' },
};

/** Order of punch buttons when the API exposes multiple actions. */
const PREFERRED_PUNCH_ACTION_ORDER: AllowedAttendanceAction[] = [
  'PUNCH_IN',
  'BREAK_START',
  'BREAK_END',
  'PUNCH_OUT',
];

function formatCoord(n: number): string {
  if (!Number.isFinite(n)) {
    return '-';
  }
  return n.toFixed(5).replace(/\.?0+$/, '');
}

function TimelineActivityRows({
  activities,
  ms,
  colors,
  t,
}: {
  activities: TodayActivity[];
  ms: ReturnType<typeof buildAttendanceStyles>;
  colors: AppThemeColors;
  t: TFunction;
}) {
  return (
    <>
      {activities.map((act, idx, arr) => {
        const lat = act.location?.latitude;
        const lng = act.location?.longitude;
        const hasCoords =
          lat != null &&
          lng != null &&
          Number.isFinite(Number(lat)) &&
          Number.isFinite(Number(lng));
        const rawMethod = act.attendance_method != null ? String(act.attendance_method).trim() : '';
        const methodLabel = rawMethod ? getMethodLabel(act.attendance_method, t) : '—';
        const clock = formatTimelineClock12(act.time);
        const extras: string[] = [];
        if (hasCoords) {
          extras.push(
            t('attendance.timeline.coords', {
              lat: formatCoord(Number(lat)),
              lng: formatCoord(Number(lng)),
            }),
          );
        }
        if (act.ip_address != null && String(act.ip_address).trim() !== '') {
          extras.push(String(act.ip_address).trim());
        }
        const extrasLine = extras.length > 0 ? extras.join(' · ') : null;

        return (
          <View
            key={`${act.type}-${act.attendance_id ?? 'x'}-${act.time ?? idx}-${idx}`}
            style={[ms.timelineRow, idx === arr.length - 1 ? ms.timelineRowLast : null]}>
            <View style={ms.timelineIcon}>
              <MaterialCommunityIcons
                name={activityIcon(act.type)}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={ms.flexOneMinZero}>
              <View style={ms.timelinePrimary}>
                <Text style={ms.timelineKind}>{getActivityLabel(act.type, t)}</Text>
                <Text style={ms.timelineSep}>•</Text>
                <Text style={ms.timelineClock}>{clock}</Text>
                <Text style={ms.timelineSep}>•</Text>
                <View style={ms.timelineMethodChip}>
                  <Text style={ms.timelineMethodChipText} numberOfLines={1}>
                    {methodLabel}
                  </Text>
                </View>
              </View>
              {extrasLine ? (
                <Text style={ms.timelineExtras} numberOfLines={2}>
                  {extrasLine}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </>
  );
}

function activityIcon(type: TodayActivityType): string {
  switch (type) {
    case 'PUNCH_IN':
      return 'login';
    case 'PUNCH_OUT':
      return 'logout';
    case 'BREAK_START':
      return 'coffee-outline';
    case 'BREAK_END':
      return 'coffee';
    default:
      return 'circle-outline';
  }
}

function statusHeroIconName(status: string): string {
  switch (status) {
    case 'NOT_PUNCHED_IN':
      return 'clock-alert-outline';
    case 'WORKING':
      return 'briefcase-outline';
    case 'ON_BREAK':
      return 'coffee-outline';
    case 'COMPLETED':
      return 'check-circle';
    case 'HOLIDAY':
      return 'party-popper';
    case 'WEEKEND':
      return 'beach';
    default:
      return 'calendar-blank';
  }
}

function methodChipIconName(id: AttendanceMethod): string {
  switch (id) {
    case 'manual':
      return 'gesture-tap-button';
    case 'gps':
      return 'crosshairs-gps';
    case 'ip':
      return 'ip-network-outline';
    case 'qr':
      return 'qrcode-scan';
    default:
      return 'help-circle-outline';
  }
}

function OnBreakPulseBanner({
  ms,
  t,
}: {
  ms: ReturnType<typeof buildAttendanceStyles>;
  t: TFunction;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.38,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return (
    <Animated.View style={[ms.breakPulseBanner, { opacity: pulse }]}>
      <MaterialCommunityIcons name="timer-sand" size={22} color="#ea580c" />
      <Text style={ms.breakPulseBannerText}>{t('attendance.statusCard.breakReminder')}</Text>
    </Animated.View>
  );
}

function buildAttendanceStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    lead: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: 16,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(248,113,113,0.35)' : '#fecaca',
      padding: 12,
      marginBottom: 14,
    },
    errorBannerText: {
      flex: 1,
      fontSize: 14,
      color: colors.danger,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    statusHeroCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
      overflow: 'hidden',
    },
    statusHeroAccent: {
      height: 4,
      width: '100%',
    },
    statusHeroInner: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
    },
    statusHeroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    statusHeroIconDisk: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.1)' : '#f8fafc',
    },
    statusHeroTextCol: {
      flex: 1,
      minWidth: 0,
    },
    statusHeroEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1.4,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    statusHeroTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.text,
      marginBottom: 8,
    },
    statusHeroDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusHeroDate: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    statusHeroMessage: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
    },
    statusHeroChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    breakPulseBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.45)' : '#fdba74',
      backgroundColor: scheme === 'dark' ? 'rgba(245,158,11,0.12)' : '#fff7ed',
    },
    breakPulseBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: scheme === 'dark' ? '#fed7aa' : '#9a3412',
      lineHeight: 19,
    },
    flexOneMinZero: {
      flex: 1,
      minWidth: 0,
    },
    cardTitleInHeader: {
      marginBottom: 0,
      flex: 1,
    },
    liveBadgeInactive: {
      backgroundColor: colors.secondaryButton,
    },
    liveBadgeInactiveText: {
      color: colors.textMuted,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    cardHeaderIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    mutedLine: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chipHoliday: {
      backgroundColor: scheme === 'dark' ? 'rgba(168,85,247,0.2)' : '#f3e8ff',
    },
    chipHolidayText: {
      color: scheme === 'dark' ? '#e9d5ff' : '#6b21a8',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textMuted,
      flexShrink: 0,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'right',
      flex: 1,
    },
    infoValueDanger: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.danger,
      textAlign: 'right',
      flex: 1,
    },
    summaryValueGood: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    summaryValueBad: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
      color: colors.danger,
    },
    summaryValueNeutral: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
      color: colors.text,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: scheme === 'dark' ? 'rgba(34,197,94,0.15)' : '#dcfce7',
    },
    liveBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#15803d',
    },
    breakBadge: {
      backgroundColor: scheme === 'dark' ? 'rgba(245,158,11,0.18)' : '#ffedd5',
    },
    breakBadgeText: {
      color: '#c2410c',
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    timelineRowLast: {
      borderBottomWidth: 0,
    },
    timelineIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.08)',
    },
    timelinePrimary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 8,
      rowGap: 6,
    },
    timelineKind: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    timelineSep: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      opacity: 0.85,
    },
    timelineClock: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    timelineMethodChip: {
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.06)',
    },
    timelineMethodChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    timelineExtras: {
      marginTop: 8,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
      marginTop: 8,
    },
    methodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
      justifyContent: 'space-between',
    },
    methodChip: {
      width: '47%',
      minWidth: 140,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    methodChipIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.14)' : '#eef2f6',
    },
    methodChipIconWrapSelected: {
      backgroundColor: scheme === 'dark' ? 'rgba(96,165,250,0.22)' : 'rgba(37,99,235,0.12)',
    },
    methodChipTextCol: {
      flex: 1,
      minWidth: 0,
    },
    methodChipSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
    },
    methodChipPressed: {
      opacity: 0.9,
    },
    methodChipDisabled: {
      opacity: 0.42,
    },
    methodChipLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    methodChipLabelSelected: {
      color: colors.primary,
    },
    methodChipHint: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    punchStack: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
      alignItems: 'stretch',
    },
    punchGridCell: {
      flexGrow: 1,
      flexBasis: '47%',
      maxWidth: '100%',
      minWidth: '47%',
      alignSelf: 'stretch',
    },
    punchBtn: {
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderWidth: 1,
      minHeight: 80,
      width: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    punchBtnCompact: {
      minHeight: 96,
      paddingVertical: 12,
      paddingHorizontal: 10,
    },
    /** Lets paired grid buttons share the row height (tallest sibling). */
    punchBtnFillRow: {
      flex: 1,
      alignSelf: 'stretch',
    },
    punchTitleCompact: {
      fontSize: 14,
      marginBottom: 2,
      lineHeight: 19,
    },
    punchSubCompact: {
      fontSize: 12,
      lineHeight: 16,
      minHeight: 32,
    },
    punchPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryPressed,
      borderWidth: 1.5,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        },
        android: { elevation: 8 },
      }),
    },
    punchSecondary: {
      backgroundColor: scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.45)' : '#fcd34d',
      borderWidth: 1.5,
      ...Platform.select({
        ios: {
          shadowColor: '#b45309',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
        },
        android: { elevation: 7 },
      }),
    },
    punchOutline: {
      backgroundColor: scheme === 'dark' ? 'rgba(248,113,113,0.1)' : '#fef2f2',
      borderColor: colors.danger,
      borderWidth: 1.5,
      ...Platform.select({
        ios: {
          shadowColor: '#dc2626',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
        },
        android: { elevation: 7 },
      }),
    },
    punchDisabled: {
      opacity: 0.42,
    },
    punchPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    punchBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    punchBtnInnerCompact: {
      gap: 8,
      flex: 1,
      alignSelf: 'stretch',
      justifyContent: 'center',
    },
    punchIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    punchIconWrapCompact: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    punchIconWrapPrimary: {
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    punchIconWrapSecondary: {
      backgroundColor: scheme === 'dark' ? 'rgba(251,191,36,0.22)' : 'rgba(245,158,11,0.2)',
    },
    punchIconWrapOutline: {
      backgroundColor: scheme === 'dark' ? 'rgba(248,113,113,0.2)' : 'rgba(254,202,202,0.65)',
    },
    punchTextCol: {
      flex: 1,
      minWidth: 0,
    },
    punchChevron: {
      opacity: 0.55,
    },
    punchTitle: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
    },
    punchLabelOnPrimary: {
      color: '#fff',
    },
    punchLabelWarm: {
      color: scheme === 'dark' ? '#fffbeb' : '#9a3412',
    },
    punchLabelDanger: {
      color: colors.danger,
    },
    punchSub: {
      fontSize: 14,
    },
    punchSubOnPrimary: {
      color: 'rgba(255,255,255,0.9)',
    },
    punchSubWarm: {
      color: scheme === 'dark' ? '#fde68a' : '#b45309',
    },
    punchSubDanger: {
      color: scheme === 'dark' ? '#fecaca' : '#b91c1c',
    },
    punchSubMuted: {
      color: colors.textMuted,
    },
    retryLink: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    retryLinkText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    punchStackWrap: {
      position: 'relative',
    },
    punchBusyOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor:
        scheme === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(248, 250, 252, 0.88)',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 0,
    },
    headerTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    refreshBtn: {
      marginTop: 4,
      padding: 8,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.12)' : '#f1f5f9',
    },
    refreshBtnDisabled: {
      opacity: 0.45,
    },
    refreshBtnPressed: {
      opacity: 0.88,
    },
    timelineSectionTop: {
      marginTop: 24,
    },
    skCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    skRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    skRowLast: {
      marginBottom: 0,
    },
    skIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
    },
    skLine: {
      height: 14,
      borderRadius: 8,
      marginBottom: 8,
    },
    skLineShort: {
      width: '55%',
      height: 12,
      borderRadius: 6,
    },
    skBarW36: { width: '36%' },
    skBarW38: { width: '38%' },
    skBarW42: { width: '42%' },
    skBarW48: { width: '48%' },
    skBarW52: { width: '52%' },
    skBarW64: { width: '64%' },
    skBarW72: { width: '72%' },
    skBarW78: { width: '78%' },
    skBarW88: { width: '88%' },
    skMethodRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    skMethodChip: {
      width: '47%',
      minWidth: 140,
      flexGrow: 1,
      height: 64,
      borderRadius: 12,
    },
    skPunch: {
      height: 72,
      borderRadius: 14,
      marginBottom: 12,
    },
    skPunchLast: {
      marginBottom: 0,
    },
    skPulseBase: {
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.28)' : '#e2e8f0',
    },
    skSectionSpacer: {
      height: 14,
      marginTop: 8,
      marginBottom: 6,
    },
  });
}

function punchMciIcon(i18nKey: PunchRowSpec['i18nKey']): string {
  switch (i18nKey) {
    case 'in':
      return 'login-variant';
    case 'out':
      return 'logout-variant';
    case 'breakStart':
      return 'cup-outline';
    case 'breakEnd':
      return 'cup';
    default:
      return 'gesture-tap-button';
  }
}

function PunchButton({
  label,
  sublabel,
  variant,
  iconKey,
  compact,
  disabled,
  onPress,
  ms,
  scheme,
  colors,
}: {
  label: string;
  sublabel: string;
  variant: 'primary' | 'secondary' | 'outline';
  iconKey: PunchRowSpec['i18nKey'];
  compact?: boolean;
  disabled: boolean;
  onPress: () => void;
  ms: ReturnType<typeof buildAttendanceStyles>;
  scheme: 'light' | 'dark';
  colors: AppThemeColors;
}) {
  const container =
    variant === 'primary'
      ? ms.punchPrimary
      : variant === 'secondary'
        ? ms.punchSecondary
        : ms.punchOutline;
  const labelTint =
    variant === 'primary'
      ? ms.punchLabelOnPrimary
      : variant === 'outline'
        ? ms.punchLabelDanger
        : ms.punchLabelWarm;
  const subTint =
    variant === 'primary'
      ? ms.punchSubOnPrimary
      : variant === 'outline'
        ? ms.punchSubDanger
        : ms.punchSubWarm;

  const iconColor =
    variant === 'primary'
      ? '#ffffff'
      : variant === 'outline'
        ? colors.danger
        : scheme === 'dark'
          ? '#fb923c'
          : '#c2410c';

  const chevronColor =
    variant === 'primary'
      ? 'rgba(255,255,255,0.72)'
      : variant === 'outline'
        ? colors.danger
        : scheme === 'dark'
          ? '#fdba74'
          : '#ea580c';

  const isCompact = compact === true;
  const iconSize = isCompact ? 22 : 26;
  const iconWrapMerged = [
    ms.punchIconWrap,
    isCompact && ms.punchIconWrapCompact,
    variant === 'primary'
      ? ms.punchIconWrapPrimary
      : variant === 'secondary'
        ? ms.punchIconWrapSecondary
        : ms.punchIconWrapOutline,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...Platform.select({
        android: {
          android_ripple: {
            color:
              variant === 'primary'
                ? 'rgba(255,255,255,0.22)'
                : variant === 'outline'
                  ? 'rgba(220,38,38,0.14)'
                  : 'rgba(251,191,36,0.2)',
            borderless: false,
          },
        },
        default: {},
      })}
      style={({ pressed }) => [
        ms.punchBtn,
        isCompact && ms.punchBtnCompact,
        isCompact && ms.punchBtnFillRow,
        container,
        disabled && ms.punchDisabled,
        pressed && !disabled && ms.punchPressed,
      ]}>
      <View style={[ms.punchBtnInner, isCompact && ms.punchBtnInnerCompact]}>
        <View style={iconWrapMerged}>
          <MaterialCommunityIcons name={punchMciIcon(iconKey)} size={iconSize} color={iconColor} />
        </View>
        <View style={ms.punchTextCol}>
          <Text
            style={[ms.punchTitle, isCompact && ms.punchTitleCompact, labelTint]}
            numberOfLines={isCompact ? 2 : 1}>
            {label}
          </Text>
          <Text
            style={[ms.punchSub, isCompact && ms.punchSubCompact, subTint]}
            numberOfLines={isCompact ? 2 : 2}
            ellipsizeMode="tail">
            {sublabel}
          </Text>
        </View>
        {isCompact ? null : (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={chevronColor}
            style={ms.punchChevron}
          />
        )}
      </View>
    </Pressable>
  );
}

function AttendanceStatusSkeleton({ ms }: { ms: ReturnType<typeof buildAttendanceStyles> }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);
  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.38, 0.72],
    }),
  };

  return (
    <View>
      <View style={ms.skCard}>
        <View style={[ms.skRow, ms.skRowLast]}>
          <Animated.View style={[ms.skIcon, ms.skPulseBase, pulseStyle]} />
          <View style={ms.flexOneMinZero}>
            <Animated.View style={[ms.skLine, ms.skBarW42, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW78, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skLineShort, ms.skPulseBase, pulseStyle]} />
          </View>
        </View>
      </View>

      <View style={ms.skCard}>
        <View style={[ms.skRow, ms.skRowLast]}>
          <Animated.View style={[ms.skIcon, ms.skPulseBase, pulseStyle]} />
          <View style={ms.flexOneMinZero}>
            <Animated.View style={[ms.skLine, ms.skBarW38, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW52, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW48, ms.skPulseBase, pulseStyle]} />
          </View>
        </View>
      </View>

      <View style={ms.skSectionSpacer} />
      <View style={ms.skMethodRow}>
        <Animated.View style={[ms.skMethodChip, ms.skPulseBase, pulseStyle]} />
        <Animated.View style={[ms.skMethodChip, ms.skPulseBase, pulseStyle]} />
        <Animated.View style={[ms.skMethodChip, ms.skPulseBase, pulseStyle]} />
        <Animated.View style={[ms.skMethodChip, ms.skPulseBase, pulseStyle]} />
      </View>

      <View style={ms.skSectionSpacer} />
      <View style={ms.skCard}>
        <Animated.View style={[ms.skPunch, ms.skPulseBase, pulseStyle]} />
        <Animated.View style={[ms.skPunch, ms.skPunchLast, ms.skPulseBase, pulseStyle]} />
      </View>

      <View style={[ms.skCard, ms.timelineSectionTop]}>
        <View style={[ms.skRow, ms.skRowLast]}>
          <Animated.View style={[ms.skIcon, ms.skPulseBase, pulseStyle]} />
          <View style={ms.flexOneMinZero}>
            <Animated.View style={[ms.skLine, ms.skBarW36, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW88, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW72, ms.skPulseBase, pulseStyle]} />
            <Animated.View style={[ms.skLine, ms.skBarW64, ms.skPulseBase, pulseStyle]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function AttendanceScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ms = useMemo(
    () => buildAttendanceStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();
  const companyId = selectedCompany?.id ?? null;

  const [method, setMethod] = useState<AttendanceMethod>('manual');
  const { statusData, loading, refreshing, errorMessage, load } =
    useCurrentAttendanceStatus(companyId);

  useEffect(() => {
    if (statusData == null) {
      return;
    }
    const list = statusData.allowed_methods;
    if (list == null || list.length === 0) {
      return;
    }
    if (!list.includes(method)) {
      const next = METHOD_IDS.find(id => list.includes(id));
      if (next != null) {
        setMethod(next);
      }
    }
  }, [statusData, method]);

  useFocusEffect(
    useCallback(() => {
      load('full').catch(() => { });
    }, [load]),
  );

  const [actionBusy, setActionBusy] = useState(false);
  const [pendingEndpoint, setPendingEndpoint] = useState<AttendanceMutationEndpoint | null>(null);

  const methodBlocksApi =
    method === 'qr' || !isAttendanceMethodAllowed(statusData, method);

  const punchDisabled =
    loading ||
    refreshing ||
    companyId == null ||
    errorMessage != null ||
    methodBlocksApi ||
    actionBusy;

  const runAttendanceMutation = useCallback(
    async (endpoint: AttendanceMutationEndpoint): Promise<{ ok: boolean }> => {
      if (companyId == null) {
        return { ok: false };
      }
      if (method === 'qr') {
        presentError({
          title: t('attendance.punch.errorTitle'),
          message: t('attendance.errors.qrNotSupported'),
        });
        return { ok: false };
      }
      if (!isAttendanceMethodAllowed(statusData, method)) {
        presentError({
          title: t('attendance.punch.errorTitle'),
          message: t('attendance.errors.methodNotAllowed'),
        });
        return { ok: false };
      }

      let payload: AttendancePunchPayload = {
        attendance_method: method as ApiAttendanceMethod,
        attendance_mode: 'manual',
      };

      if (method === 'gps') {
        const loc = await ensureLocationForVerify();
        if (!loc.ok) {
          presentError({
            title: t('attendance.punch.errorTitle'),
            message:
              loc.kind === 'permission'
                ? t('attendance.errors.locationPermission')
                : t('attendance.errors.locationFailed'),
          });
          return { ok: false };
        }
        payload = {
          ...payload,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }

      setActionBusy(true);
      try {
        let res: PunchActionResponse;
        if (endpoint === 'in') {
          res = await postPunchIn(companyId, payload);
        } else if (endpoint === 'out') {
          res = await postPunchOut(companyId, payload);
        } else if (endpoint === 'break-in') {
          res = await postBreakIn(companyId, payload);
        } else {
          res = await postBreakOut(companyId, payload);
        }
        if (!res.success) {
          presentError({
            title: t('attendance.punch.errorTitle'),
            message: res.message?.trim() || t('attendance.errors.punchGeneric'),
          });
          return { ok: false };
        }
        presentSuccess({
          title: t('attendance.punch.successTitle'),
          message: res.message?.trim() || t('attendance.punch.successMessage'),
        });
        await load('refresh');
        return { ok: true };
      } catch (e) {
        presentError({
          title: t('attendance.punch.errorTitle'),
          message: readApiError(e),
        });
        return { ok: false };
      } finally {
        setActionBusy(false);
      }
    },
    [companyId, load, method, presentError, presentSuccess, statusData, t],
  );

  const visiblePunchRows = useMemo((): PunchRowSpec[] => {
    const allowed = new Set(statusData?.allowed_actions ?? []);
    return PREFERRED_PUNCH_ACTION_ORDER.filter(
      action => allowed.has(action) && canShowAction(statusData, action),
    )
      .map(action => {
        const cfg = ACTION_BUTTON_CONFIG[action];
        return cfg ? { action, ...cfg } : null;
      })
      .filter((row): row is PunchRowSpec => row != null);
  }, [statusData]);

  const todaySummaryDisplay = useMemo(() => {
    if (statusData?.today_summary == null) {
      return null;
    }
    const ts = statusData.today_summary;
    const workedMin = resolveWorkedMinutes(ts);
    const consumedMin = resolveBreakConsumedMinutes(ts);
    const expectedMin = resolveExpectedWorkMinutesFromShift(statusData.shift);
    const allowedMin = statusData.shift?.allowed_break_minutes;

    const w = workedMin != null ? Math.max(0, Math.floor(Number(workedMin))) : null;
    const e = expectedMin != null ? Math.max(0, Math.floor(Number(expectedMin))) : null;
    const c = consumedMin != null ? Math.max(0, Math.floor(Number(consumedMin))) : null;
    const a =
      allowedMin != null && Number.isFinite(Number(allowedMin))
        ? Math.max(0, Math.floor(Number(allowedMin)))
        : null;

    const workRatio = formatMinutesRatio(workedMin, expectedMin);
    const breakRatio = formatMinutesRatio(consumedMin, allowedMin);

    const workDeltaBody = w != null && e != null ? formatSignedMinutesDelta(w - e) : '';
    const workDeltaText = workDeltaBody ? ` (${workDeltaBody})` : null;
    const workDeltaStyle =
      workDeltaBody !== '' && workDeltaBody.startsWith('-')
        ? ms.summaryValueBad
        : workDeltaBody !== ''
          ? ms.summaryValueGood
          : ms.summaryValueNeutral;

    const breakDeltaBody = c != null && a != null ? formatSignedMinutesDelta(a - c) : '';
    const breakDeltaText = breakDeltaBody ? ` (${breakDeltaBody})` : null;
    const breakDeltaStyle =
      breakDeltaBody !== '' && breakDeltaBody.startsWith('-')
        ? ms.summaryValueBad
        : breakDeltaBody !== ''
          ? ms.summaryValueGood
          : ms.summaryValueNeutral;

    return {
      workRatioText: workRatio,
      workDeltaText,
      workDeltaStyle,
      breakRatioText: breakRatio,
      breakDeltaText,
      breakDeltaStyle,
    };
  }, [statusData, ms]);

  const attendanceDayDateLine = useMemo(() => {
    const di = statusData?.day_info;
    const dn = capitalizeDayName(di?.day_name);
    const dd = formatDateDDMMYY(di?.date);
    if (dn && dd) {
      return `${dn} · ${dd}`;
    }
    if (dn) {
      return dn;
    }
    if (dd) {
      return dd;
    }
    return '-';
  }, [statusData?.day_info?.day_name, statusData?.day_info?.date]);

  const handleConfirmSwipe = useCallback(async () => {
    if (pendingEndpoint == null) {
      return { ok: false };
    }
    return runAttendanceMutation(pendingEndpoint);
  }, [pendingEndpoint, runAttendanceMutation]);

  const statusAccent = useMemo(
    () => getStatusColor(statusData?.status, colors),
    [statusData?.status, colors],
  );

  const showStatusSkeleton =
    companyId != null && ((loading && !statusData) || refreshing);

  return (
    <SafeAreaView style={ms.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={ms.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              load('refresh').catch(() => { });
            }}
            enabled={companyId != null}
            tintColor={colors.primary}
          />
        }>
        <View style={ms.headerRow}>
          <View style={ms.headerTextBlock}>
            <Text style={ms.title}>{t('attendance.title')}</Text>
            <Text style={ms.lead}>{t('attendance.lead')}</Text>
          </View>
          {companyId != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('attendance.refresh')}
              onPress={() => {
                load('refresh').catch(() => { });
              }}
              disabled={showStatusSkeleton}
              style={({ pressed }) => [
                ms.refreshBtn,
                showStatusSkeleton && ms.refreshBtnDisabled,
                pressed && !showStatusSkeleton && ms.refreshBtnPressed,
              ]}>
              <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {companyId == null ? (
          <View style={ms.card}>
            <Text style={ms.mutedLine}>{t('attendance.errors.noCompany')}</Text>
          </View>
        ) : null}

        {errorMessage != null && companyId != null ? (
          <View style={ms.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.danger} />
            <Text style={ms.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {errorMessage != null && companyId != null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              load('full').catch(() => { });
            }}
            style={({ pressed }) => [ms.retryLink, pressed && { opacity: 0.85 }]}>
            <Text style={ms.retryLinkText}>{t('attendance.retry')}</Text>
          </Pressable>
        ) : null}

        {showStatusSkeleton ? <AttendanceStatusSkeleton ms={ms} /> : null}

        {statusData != null && companyId != null && !showStatusSkeleton ? (
          <>
            <View style={ms.statusHeroCard}>
              <View style={[ms.statusHeroAccent, { backgroundColor: statusAccent }]} />
              <View style={ms.statusHeroInner}>
                <View style={ms.statusHeroRow}>
                  <View style={[ms.statusHeroIconDisk, { borderColor: statusAccent }]}>
                    <MaterialCommunityIcons
                      name={statusHeroIconName(statusData.status)}
                      size={28}
                      color={statusAccent}
                    />
                  </View>
                  <View style={ms.statusHeroTextCol}>
                    <Text style={ms.statusHeroEyebrow}>{t('attendance.cards.status')}</Text>
                    <Text style={ms.statusHeroTitle} numberOfLines={2}>
                      {getStatusLabel(statusData.status, t)}
                    </Text>
                    <View style={ms.statusHeroDateRow}>
                      <MaterialCommunityIcons
                        name="calendar-blank-outline"
                        size={18}
                        color={colors.textMuted}
                      />
                      <Text style={ms.statusHeroDate} numberOfLines={1}>
                        {attendanceDayDateLine}
                      </Text>
                    </View>
                  </View>
                </View>
                {statusData.status === 'ON_BREAK' ? <OnBreakPulseBanner ms={ms} t={t} /> : null}
                {statusData.status === 'HOLIDAY' ? (
                  <Text style={ms.statusHeroMessage} numberOfLines={3}>
                    {statusData.day_info?.holiday_name?.trim()
                      ? t('attendance.messages.holidayNamed', {
                        name: statusData.day_info.holiday_name.trim(),
                      })
                      : t('attendance.messages.holiday')}
                  </Text>
                ) : null}
                {statusData.status === 'WEEKEND' ? (
                  <Text style={ms.statusHeroMessage} numberOfLines={2}>
                    {t('attendance.messages.weekend')}
                  </Text>
                ) : null}
                {statusData.status === 'COMPLETED' ? (
                  <Text style={ms.statusHeroMessage} numberOfLines={2}>
                    {t('attendance.messages.completed')}
                  </Text>
                ) : null}
                <View style={ms.statusHeroChipRow}>
                  {statusData.day_info?.is_holiday ? (
                    <View style={[ms.chip, ms.chipHoliday]}>
                      <Text style={[ms.chipText, ms.chipHolidayText]}>
                        {t('attendance.chips.holiday')}
                      </Text>
                    </View>
                  ) : null}
                  {statusData.day_info?.is_weekend ? (
                    <View style={ms.chip}>
                      <Text style={ms.chipText}>{t('attendance.chips.weekend')}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {todaySummaryDisplay != null ? (
              <View style={ms.card}>
                <View style={ms.cardHeader}>
                  <View style={ms.cardHeaderIcon}>
                    <MaterialCommunityIcons name="chart-box-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[ms.cardTitle, ms.cardTitleInHeader]}>
                    {t('attendance.summaryCard.title')}
                  </Text>
                </View>
                <View style={ms.infoRow}>
                  <Text style={ms.infoLabel}>{t('attendance.summaryCard.work')}</Text>
                  <Text style={ms.summaryValueNeutral}>
                    {todaySummaryDisplay.workRatioText}
                    {todaySummaryDisplay.workDeltaText ? (
                      <Text style={todaySummaryDisplay.workDeltaStyle}>
                        {todaySummaryDisplay.workDeltaText}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View
                  style={[
                    ms.infoRow,
                    !(
                      typeof statusData.today_summary?.total_breaks === 'number' &&
                      statusData.today_summary.total_breaks > 0
                    )
                      ? ms.infoRowLast
                      : null,
                  ]}>
                  <Text style={ms.infoLabel}>{t('attendance.summaryCard.break')}</Text>
                  <Text style={ms.summaryValueNeutral}>
                    {todaySummaryDisplay.breakRatioText}
                    {todaySummaryDisplay.breakDeltaText ? (
                      <Text style={todaySummaryDisplay.breakDeltaStyle}>
                        {todaySummaryDisplay.breakDeltaText}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                {typeof statusData.today_summary?.total_breaks === 'number' &&
                  statusData.today_summary.total_breaks > 0 ? (
                  <View style={[ms.infoRow, ms.infoRowLast]}>
                    <Text style={ms.infoLabel}>{t('attendance.summaryCard.breakCount')}</Text>
                    <Text style={ms.infoValue}>{String(statusData.today_summary.total_breaks)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {visiblePunchRows.length > 0 ? (
              <>
                <Text style={ms.sectionLabel}>{t('attendance.cards.method')}</Text>
                <View style={ms.methodGrid}>
                  {METHOD_IDS.map(id => {
                    const allowed = isAttendanceMethodAllowed(statusData, id);
                    const selected = method === id;
                    const label = t(`attendance.methods.${id}.label`);
                    const hint = t(`attendance.methods.${id}.hint`);
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: !allowed }}
                        accessibilityLabel={`${label}. ${hint}`}
                        disabled={!allowed}
                        onPress={() => setMethod(id)}
                        style={({ pressed }) => [
                          ms.methodChip,
                          selected && ms.methodChipSelected,
                          !allowed && ms.methodChipDisabled,
                          pressed && allowed && ms.methodChipPressed,
                        ]}>
                        <View
                          style={[
                            ms.methodChipIconWrap,
                            selected && ms.methodChipIconWrapSelected,
                          ]}>
                          <MaterialCommunityIcons
                            name={methodChipIconName(id)}
                            size={22}
                            color={
                              !allowed
                                ? colors.textMuted
                                : selected
                                  ? colors.primary
                                  : colors.textMuted
                            }
                          />
                        </View>
                        <View style={ms.methodChipTextCol}>
                          <Text
                            style={[ms.methodChipLabel, selected && ms.methodChipLabelSelected]}
                            numberOfLines={1}>
                            {label}
                          </Text>
                          <Text style={ms.methodChipHint} numberOfLines={2}>
                            {hint}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={ms.sectionLabel}>{t('attendance.cards.actions')}</Text>
            <View style={ms.punchStackWrap}>
              <View style={ms.punchStack}>
                {visiblePunchRows.length === 0 ? (
                  <Text style={ms.mutedLine}>{t('attendance.actions.none')}</Text>
                ) : (
                  visiblePunchRows.map(row => (
                    <View key={row.action} style={ms.punchGridCell}>
                      <PunchButton
                        label={t(`attendance.punch.${row.i18nKey}.label`)}
                        sublabel={t(`attendance.punch.${row.i18nKey}.sublabel`)}
                        variant={row.variant}
                        iconKey={row.i18nKey}
                        compact
                        disabled={punchDisabled}
                        onPress={() => setPendingEndpoint(row.endpoint)}
                        ms={ms}
                        scheme={resolvedScheme}
                        colors={colors}
                      />
                    </View>
                  ))
                )}
              </View>
              {actionBusy ? (
                <View style={ms.punchBusyOverlay} pointerEvents="auto">
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : null}
            </View>

            {statusData.today_activities != null && statusData.today_activities.length > 0 ? (
              <View style={[ms.card, ms.timelineSectionTop]}>
                <View style={ms.cardHeader}>
                  <View style={ms.cardHeaderIcon}>
                    <MaterialCommunityIcons
                      name="timeline-text-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[ms.cardTitle, ms.cardTitleInHeader]}>
                    {t('attendance.cards.timeline')}
                  </Text>
                </View>
                <TimelineActivityRows
                  activities={statusData.today_activities}
                  ms={ms}
                  colors={colors}
                  t={t}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <AttendanceSwipeConfirmModal
        visible={pendingEndpoint != null}
        endpoint={pendingEndpoint}
        onDismiss={() => setPendingEndpoint(null)}
        onConfirmSwipe={handleConfirmSwipe}
      />
      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
