import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { attendanceApi } from '@src/api/attendanceApi';
import {
  BulkApproveModal,
  type BulkApproveTarget,
} from '@src/components/modals/BulkApproveModal';
import {
  ConfirmAlert,
  useConfirmAlert,
} from '@src/components/modals/ConfirmAlert';
import { DatePicker } from '@src/components/modals/DatePicker';
import {
  MarkAttendanceModal,
  type MarkAttendanceTarget,
} from '@src/components/modals/MarkAttendanceModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useAttendanceList } from '@src/hooks/useAttendanceList';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  AttendanceDayRecord,
  AttendanceDayStatus,
  EmployeeAttendanceRow,
} from '@src/types/attendanceList';
import type {
  BulkApprovePayload,
  LeaveConfigEntry,
  MarkAttendancePayload,
  MarkAttendanceStatus,
} from '@src/types/markAttendance';
import {
  addDaysIso,
  dayStatusVisual,
  formatDateWithWeekday,
  formatTimeShort,
  formatWorkedMinutes,
  labeledValueLabel,
  punchHasTime,
  punchMethodIcon,
  resolveProfilePictureUrl,
  todayIso,
} from '@src/utils/attendanceListDisplay';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'AttendanceManagement'>;

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

const DAY_STATUS_FILTERS: Array<AttendanceDayStatus | null> = [
  null, 'unmarked', 'present', 'absent', 'leave', 'half_day',
];

const STATUS_ACTIONS: MarkAttendanceStatus[] = ['present', 'half_day', 'absent', 'leave'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    if (a && b) {
      return `${a}${b}`.toUpperCase();
    }
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function dayStatusLabel(t: TFunction, status: AttendanceDayStatus): string {
  return t(`home.attendanceManagement.dayStatus.${status}`);
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    stackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 46,
      maxHeight: 46,
    },
    stackHeaderTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 2,
    },
    fixedHeader: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 6,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      marginBottom: 6,
      minHeight: 38,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 8 : 5,
      fontSize: 14,
      color: colors.text,
    },
    searchClearBtn: { marginLeft: 4, padding: 4 },
    filterSection: { marginBottom: 6 },
    datePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
      minHeight: 40,
    },
    dateNavBtn: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
    datePickerPress: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      minHeight: 40,
    },
    dateDisplayText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 18,
    },
    chipTextActive: { color: colors.primary },
    chipScroll: { marginBottom: 4 },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: 6,
    },
    statusChipActive: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    },
    statusChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    countsRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
    countChip: {
      flex: 1,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    countChipLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted },
    countChipValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 1 },
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    selectAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    selectAllLabel: { fontSize: 12, fontWeight: '600', color: colors.primary },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: scheme === 'dark' ? 0.2 : 0.06,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    cardSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { fontSize: 13, fontWeight: '700', color: '#fff' },
    cardMain: { flex: 1, minWidth: 0 },
    name: { fontSize: 14, fontWeight: '700', color: colors.text },
    subline: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

    dayInfoSection: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    dayInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    unmarkedBadge: { borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' },
    unmarkedBadgeText: { color: '#64748b' },
    verifiedBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 5,
      backgroundColor: scheme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    },
    verifiedBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    pendingBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 5,
      backgroundColor: scheme === 'dark' ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5',
    },
    pendingBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: scheme === 'dark' ? '#fb923c' : '#c2410c',
    },
    punchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    punchText: { fontSize: 11, color: colors.text, fontWeight: '500' },
    dayMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    shiftText: { fontSize: 10, color: colors.textMuted },
    workedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    workedText: { fontSize: 11, fontWeight: '600', color: colors.text },

    actionsSection: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnActive: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
    },
    actionBtnText: { fontSize: 11, fontWeight: '700', color: colors.text },
    actionBtnTextActive: { color: colors.primary },

    flagsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    flagBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    flagBtnOn: {
      borderColor: scheme === 'dark' ? '#fbbf24' : '#d97706',
      backgroundColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.15)' : '#fffbeb',
    },
    flagBtnText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    flagBtnTextOn: { color: scheme === 'dark' ? '#fbbf24' : '#d97706' },

    floatingBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        android: { elevation: 8 },
      }),
    },
    floatingCount: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
    floatingBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    floatingBtnSecondary: {
      backgroundColor: colors.secondaryButton,
    },
    floatingBtnLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
    floatingBtnLabelSecondary: { color: colors.text },
    floatingCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondaryButton,
      alignItems: 'center',
      justifyContent: 'center',
    },

    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
    error: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
    footerBox: { paddingVertical: 12 },
    skeleton: {
      height: 100,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
      marginBottom: 8,
      opacity: 0.6,
    },
  });
}

type EmployeeCardProps = {
  item: EmployeeAttendanceRow;
  selectedDate: string;
  styles: ReturnType<typeof buildStyles>;
  scheme: 'light' | 'dark';
  t: TFunction;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onStatusAction: (employee: EmployeeAttendanceRow, status: MarkAttendanceStatus) => void;
  onFlagToggle: (employee: EmployeeAttendanceRow, flag: 'overtime' | 'deductible', record: AttendanceDayRecord) => void;
};

function EmployeeCard({
  item, selectedDate, styles, scheme, t, selected, onToggleSelect, onStatusAction, onFlagToggle,
}: EmployeeCardProps) {
  const photoUrl = resolveProfilePictureUrl(item.profile_picture);
  const record: AttendanceDayRecord | null = useMemo(() => {
    const matches = (item.attendances ?? []).filter(a => a.attendance_date === selectedDate);
    return matches[0] ?? null;
  }, [item.attendances, selectedDate]);

  const visual = record ? dayStatusVisual(record.day_status, scheme) : null;
  const showPunches = record && (record.day_status === 'present' || record.day_status === 'half_day');
  const showFlags = record && (record.day_status === 'present' || record.day_status === 'half_day');

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.cardTopRow}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: selected }}
          onPress={() => onToggleSelect(item.employee_id)}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.cardMain}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.subline} numberOfLines={1}>
            {[item.employee_code, labeledValueLabel(item.designation)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Switch
          value={selected}
          onValueChange={() => onToggleSelect(item.employee_id)}
          trackColor={{ false: styles.muted.color, true: styles.chipTextActive.color }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.dayInfoSection}>
        <View style={styles.dayInfoRow}>
          {record && visual ? (
            <View style={[styles.statusBadge, { borderColor: visual.borderColor, backgroundColor: visual.backgroundColor }]}>
              <Text style={[styles.statusBadgeText, { color: visual.textColor }]}>
                {dayStatusLabel(t, record.day_status)}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.unmarkedBadge]}>
              <Text style={[styles.statusBadgeText, styles.unmarkedBadgeText]}>
                {dayStatusLabel(t, 'unmarked')}
              </Text>
            </View>
          )}
          {record ? (
            record.is_verified ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>{t('home.attendanceManagement.verified')}</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{t('home.attendanceManagement.pending')}</Text>
              </View>
            )
          ) : null}
        </View>

        {record?.day_status === 'half_day' && record.half_day_session ? (
          <Text style={styles.dayMeta}>
            {record.half_day_session === 'first_half'
              ? t('home.attendanceManagement.halfDay.firstHalf')
              : t('home.attendanceManagement.halfDay.secondHalf')}
          </Text>
        ) : null}

        {record?.day_status === 'leave' ? (
          <Text style={styles.dayMeta}>
            {record.leave_type === 'paid'
              ? `${t('home.attendanceManagement.leave.paid')}${record.leave_sub_type ? ` · ${record.leave_sub_type}` : ''}`
              : t('home.attendanceManagement.leave.unpaid')}
          </Text>
        ) : null}

        {showPunches ? (
          <View>
            {punchHasTime(record.punch_in) ? (
              <View style={styles.punchRow}>
                <MaterialCommunityIcons
                  name={punchMethodIcon(record.punch_in!.method) as IconProps['name']}
                  size={12}
                  color={visual!.textColor}
                />
                <Text style={styles.punchText}>
                  {t('home.attendanceManagement.punchIn')}: {formatTimeShort(record.punch_in!.time)}
                </Text>
              </View>
            ) : null}
            {punchHasTime(record.punch_out) ? (
              <View style={styles.punchRow}>
                <MaterialCommunityIcons
                  name={punchMethodIcon(record.punch_out!.method) as IconProps['name']}
                  size={12}
                  color={visual!.textColor}
                />
                <Text style={styles.punchText}>
                  {t('home.attendanceManagement.punchOut')}: {formatTimeShort(record.punch_out!.time)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.workedRow}>
          <MaterialCommunityIcons name="clock-outline" size={12} color={styles.workedText.color} />
          <Text style={styles.workedText}>
            {t('home.attendanceManagement.worked')}: {formatWorkedMinutes(item.calculations?.worked_minutes ?? 0)}
          </Text>
          {item.shift ? (
            <Text style={styles.shiftText}>
              {'  '}·{'  '}{t('home.attendanceManagement.shift', { start: item.shift.start_time, end: item.shift.end_time })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsSection}>
        <View style={styles.actionsRow}>
          {STATUS_ACTIONS.map(s => {
            const isActive = record?.day_status === s;
            return (
              <Pressable
                key={s}
                accessibilityRole="button"
                onPress={() => onStatusAction(item, s)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  isActive && styles.actionBtnActive,
                  pressed && { opacity: 0.85 },
                ]}>
                <Text style={[styles.actionBtnText, isActive && styles.actionBtnTextActive]}>
                  {t(`home.attendanceManagement.mark.statuses.${s}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {showFlags && record ? (
          <View style={styles.flagsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onFlagToggle(item, 'overtime', record)}
              style={({ pressed }) => [
                styles.flagBtn,
                record.is_overtime && styles.flagBtnOn,
                pressed && { opacity: 0.85 },
              ]}>
              <MaterialCommunityIcons
                name="clock-fast"
                size={12}
                color={record.is_overtime ? (scheme === 'dark' ? '#fbbf24' : '#d97706') : styles.flagBtnText.color}
              />
              <Text style={[styles.flagBtnText, record.is_overtime && styles.flagBtnTextOn]}>
                {t('home.attendanceManagement.overtime')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onFlagToggle(item, 'deductible', record)}
              style={({ pressed }) => [
                styles.flagBtn,
                record.is_deductible && styles.flagBtnOn,
                pressed && { opacity: 0.85 },
              ]}>
              <MaterialCommunityIcons
                name="cash-minus"
                size={12}
                color={record.is_deductible ? (scheme === 'dark' ? '#fbbf24' : '#d97706') : styles.flagBtnText.color}
              />
              <Text style={[styles.flagBtnText, record.is_deductible && styles.flagBtnTextOn]}>
                {t('home.attendanceManagement.deductible')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CountsRow({
  counts, styles, t, scheme,
}: {
  counts: NonNullable<ReturnType<typeof useAttendanceList>['counts']>;
  styles: ReturnType<typeof buildStyles>;
  t: TFunction;
  scheme: 'light' | 'dark';
}) {
  const items: Array<{ key: AttendanceDayStatus; value: number }> = [
    { key: 'unmarked', value: counts.unmarked },
    { key: 'present', value: counts.present },
    { key: 'absent', value: counts.absent },
    { key: 'leave', value: counts.leave },
    { key: 'half_day', value: counts.half_day },
  ];

  return (
    <View style={styles.countsRow}>
      {items.map(({ key, value }) => {
        const v = dayStatusVisual(key, scheme);
        return (
          <View
            key={key}
            style={[styles.countChip, { borderColor: v.borderColor, backgroundColor: v.backgroundColor }]}>
            <Text style={styles.countChipLabel}>{dayStatusLabel(t, key)}</Text>
            <Text style={[styles.countChipValue, { color: v.textColor }]}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AttendanceManagementScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const searchInputRef = useRef<TextInput>(null);
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();
  const { props: confirmAlertProps, present: presentConfirm } = useConfirmAlert();

  const today = useMemo(() => todayIso(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayStatusFilter, setDayStatusFilter] = useState<AttendanceDayStatus | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const [markTarget, setMarkTarget] = useState<MarkAttendanceTarget | null>(null);
  const [markVisible, setMarkVisible] = useState(false);
  const [markSubmitting, setMarkSubmitting] = useState(false);

  const [bulkTarget, setBulkTarget] = useState<BulkApproveTarget | null>(null);
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [leaveConfigs, setLeaveConfigs] = useState<LeaveConfigEntry[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (companyId == null) {
      return;
    }
    let cancelled = false;
    attendanceApi.fetchLeaveConfigs(companyId).then(res => {
      if (cancelled) {
        return;
      }
      if (res.success && res.data) {
        setLeaveConfigs(res.data);
      }
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [companyId]);

  const onApiError = useCallback(
    (message: string) => {
      presentError({ title: t('home.attendanceManagement.errorTitle'), message });
    },
    [presentError, t],
  );

  const { employees, counts, loading, loadingMore, refreshing, error, refresh, loadMore, retry } =
    useAttendanceList({
      companyId,
      fromDate: selectedDate,
      toDate: selectedDate,
      dayStatus: dayStatusFilter,
      search: debouncedSearch,
      limit: PAGE_SIZE,
      onError: onApiError,
    });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDate, dayStatusFilter, debouncedSearch]);

  const canGoNext = selectedDate < today;
  const hasSelection = selectedIds.size > 0;
  const allSelected = employees.length > 0 && employees.every(e => selectedIds.has(e.employee_id));

  const selectedDateCaption = useMemo(
    () => formatDateWithWeekday(selectedDate, i18n.language),
    [i18n.language, selectedDate],
  );

  const onSearchChange = useCallback((text: string) => {
    setSearch(text);
    searchInputRef.current?.focus();
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    searchInputRef.current?.focus();
  }, []);

  const shiftDate = useCallback(
    (delta: number) => {
      setSelectedDate(prev => {
        const next = addDaysIso(prev, delta);
        if (delta > 0 && next > today) {
          return prev;
        }
        return next;
      });
    },
    [today],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.employee_id)));
    }
  }, [allSelected, employees]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openMarkModal = useCallback(
    (employee: EmployeeAttendanceRow, preSelectedStatus: MarkAttendanceStatus) => {
      const record = (employee.attendances ?? []).find(a => a.attendance_date === selectedDate) ?? null;
      setMarkTarget({
        employeeId: employee.employee_id,
        employeeName: employee.name,
        date: selectedDate,
        preSelectedStatus,
        existingRecord: record,
        shift: employee.shift ?? null,
      });
      setMarkVisible(true);
    },
    [selectedDate],
  );

  const closeMarkModal = useCallback(() => {
    if (markSubmitting) {
      return;
    }
    setMarkVisible(false);
  }, [markSubmitting]);

  const handleMarkSubmit = useCallback(
    async (payload: MarkAttendancePayload) => {
      if (companyId == null) {
        return;
      }
      setMarkSubmitting(true);
      try {
        const res = await attendanceApi.markAttendance(companyId, payload);
        if (!res.success) {
          presentError({ title: t('home.attendanceManagement.mark.errorTitle'), message: res.message });
          return;
        }
        setMarkVisible(false);
        presentSuccess({
          title: t('home.attendanceManagement.mark.successTitle'),
          message: res.message || t('home.attendanceManagement.mark.successMessage'),
        });
        refresh();
      } catch (e) {
        presentError({ title: t('home.attendanceManagement.mark.errorTitle'), message: readApiError(e) });
      } finally {
        setMarkSubmitting(false);
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const handleFlagToggle = useCallback(
    (employee: EmployeeAttendanceRow, flag: 'overtime' | 'deductible', record: AttendanceDayRecord) => {
      if (companyId == null) {
        return;
      }
      const newValue = flag === 'overtime' ? !record.is_overtime : !record.is_deductible;
      const tk = 'home.attendanceManagement.flagConfirm';
      const titleKey = flag === 'overtime'
        ? (newValue ? `${tk}.enableOvertimeTitle` : `${tk}.disableOvertimeTitle`)
        : (newValue ? `${tk}.enableDeductibleTitle` : `${tk}.disableDeductibleTitle`);
      const msgKey = flag === 'overtime'
        ? (newValue ? `${tk}.enableOvertimeMessage` : `${tk}.disableOvertimeMessage`)
        : (newValue ? `${tk}.enableDeductibleMessage` : `${tk}.disableDeductibleMessage`);

      presentConfirm({
        title: t(titleKey),
        message: t(msgKey),
        showTitle: true,
        showMessage: true,
        buttons: [
          { text: t(`${tk}.cancel`), variant: 'secondary' },
          {
            text: t(`${tk}.confirm`),
            variant: 'primary',
            onPress: async () => {
              try {
                const payload: MarkAttendancePayload = {
                  employee_id: employee.employee_id,
                  date: record.attendance_date,
                  type: 'attendance',
                  status: record.day_status as MarkAttendanceStatus,
                  start_time: record.punch_in?.time ?? null,
                  end_time: record.punch_out?.time ?? null,
                  is_overtime: flag === 'overtime' ? newValue : false,
                  is_deductible: flag === 'deductible' ? newValue : false,
                  half_day_type: record.half_day_session ?? null,
                  leave_type: record.leave_type ?? null,
                  leave_type_value: record.leave_sub_type ?? null,
                  notes: record.remark,
                };
                const res = await attendanceApi.markAttendance(companyId, payload);
                if (!res.success) {
                  presentError({ title: t('home.attendanceManagement.errorTitle'), message: res.message });
                  return;
                }
                refresh();
              } catch (e) {
                presentError({ title: t('home.attendanceManagement.errorTitle'), message: readApiError(e) });
              }
            },
          },
        ],
      });
    },
    [companyId, presentConfirm, presentError, refresh, t],
  );

  const openBulkModal = useCallback(
    (mode: 'selected' | 'all') => {
      if (mode === 'all') {
        setBulkTarget({ employeeIds: 'all', date: selectedDate, employeeCount: counts?.total_employees ?? 0 });
      } else {
        setBulkTarget({ employeeIds: Array.from(selectedIds), date: selectedDate, employeeCount: selectedIds.size });
      }
      setBulkVisible(true);
    },
    [counts?.total_employees, selectedDate, selectedIds],
  );

  const closeBulkModal = useCallback(() => {
    if (bulkSubmitting) {
      return;
    }
    setBulkVisible(false);
  }, [bulkSubmitting]);

  const handleBulkSubmit = useCallback(
    async (payload: BulkApprovePayload) => {
      if (companyId == null) {
        return;
      }
      setBulkSubmitting(true);
      try {
        const res = await attendanceApi.bulkApprove(companyId, payload);
        if (!res.success) {
          presentError({ title: t('home.attendanceManagement.bulk.errorTitle'), message: res.message });
          return;
        }
        setBulkVisible(false);
        setSelectedIds(new Set());
        presentSuccess({
          title: t('home.attendanceManagement.bulk.successTitle'),
          message: res.message || t('home.attendanceManagement.bulk.successMessage'),
        });
        refresh();
      } catch (e) {
        presentError({ title: t('home.attendanceManagement.bulk.errorTitle'), message: readApiError(e) });
      } finally {
        setBulkSubmitting(false);
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: EmployeeAttendanceRow }) => (
      <EmployeeCard
        item={item}
        selectedDate={selectedDate}
        styles={styles}
        scheme={resolvedScheme}
        t={t}
        selected={selectedIds.has(item.employee_id)}
        onToggleSelect={toggleSelect}
        onStatusAction={openMarkModal}
        onFlagToggle={handleFlagToggle}
      />
    ),
    [handleFlagToggle, openMarkModal, resolvedScheme, selectedDate, selectedIds, styles, t, toggleSelect],
  );

  const fixedHeaderContent = useMemo(
    () => (
      <View style={styles.fixedHeader}>
        <View style={styles.datePickerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.attendanceManagement.prevDay')}
            onPress={() => shiftDate(-1)}
            style={({ pressed }) => [styles.dateNavBtn, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.attendanceManagement.openDatePicker', { date: selectedDateCaption })}
            onPress={() => setDatePickerVisible(true)}
            style={({ pressed }) => [styles.datePickerPress, pressed && { opacity: 0.85 }]}>
            <Text style={styles.dateDisplayText} numberOfLines={2}>{selectedDateCaption}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.attendanceManagement.nextDay')}
            onPress={() => shiftDate(1)}
            disabled={!canGoNext}
            style={({ pressed }) => [
              styles.dateNavBtn,
              !canGoNext && { opacity: 0.35 },
              pressed && canGoNext && { opacity: 0.7 },
            ]}>
            <MaterialCommunityIcons
              name="chevron-right"
              size={28}
              color={canGoNext ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.textMuted}
            style={styles.searchIcon}
            accessibilityElementsHidden
          />
          <TextInput
            ref={searchInputRef}
            value={search}
            onChangeText={onSearchChange}
            placeholder={t('home.attendanceManagement.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.attendanceManagement.clearSearch')}
              onPress={clearSearch}
              hitSlop={8}
              style={({ pressed }) => [styles.searchClearBtn, pressed && { opacity: 0.7 }]}>
              <MaterialCommunityIcons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {DAY_STATUS_FILTERS.map(status => {
            const active = dayStatusFilter === status;
            const label = status == null
              ? t('home.attendanceManagement.dayStatus.all')
              : dayStatusLabel(t, status);
            return (
              <Pressable
                key={status ?? 'all'}
                accessibilityRole="button"
                onPress={() => setDayStatusFilter(status)}
                style={({ pressed }) => [
                  styles.statusChip,
                  active && styles.statusChipActive,
                  pressed && { opacity: 0.9 },
                ]}>
                <Text style={[styles.statusChipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!loading && counts ? (
          <CountsRow counts={counts} styles={styles} t={t} scheme={resolvedScheme} />
        ) : null}

        {hasSelection ? (
          <View style={styles.selectAllRow}>
            <Pressable
              accessibilityRole="button"
              onPress={toggleSelectAll}
              style={({ pressed }) => [styles.selectAllBtn, pressed && { opacity: 0.85 }]}>
              <MaterialCommunityIcons
                name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.selectAllLabel}>
                {allSelected
                  ? t('home.attendanceManagement.deselectAll')
                  : t('home.attendanceManagement.selectAll')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      allSelected, canGoNext, clearSearch, colors.primary, colors.textMuted,
      counts, dayStatusFilter, hasSelection, loading, onSearchChange,
      resolvedScheme, search, selectedDateCaption, shiftDate, styles, t, toggleSelectAll,
    ],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerBox}>
          <View style={styles.skeleton} />
        </View>
      );
    }
    return null;
  }, [loadingMore, styles]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </>
      );
    }
    if (employees.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            {debouncedSearch || dayStatusFilter
              ? t('home.attendanceManagement.emptyFiltered')
              : t('home.attendanceManagement.empty')}
          </Text>
        </View>
      );
    }
    return null;
  }, [dayStatusFilter, debouncedSearch, employees.length, loading, styles, t]);

  if (companyId == null) {
    return (
      <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.attendanceManagement.back')}
          />
          <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
            {t('home.attendanceManagement.title')}
          </Text>
        </View>
        <View style={[styles.centerBox, styles.fill]}>
          <Text style={styles.muted}>{t('home.attendanceManagement.noCompany')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && employees.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.attendanceManagement.back')}
          />
          <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
            {t('home.attendanceManagement.title')}
          </Text>
        </View>
        <View style={[styles.centerBox, styles.fill]}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.retryLabel}>{t('home.attendanceManagement.retry')}</Text>
          </Pressable>
        </View>
        <StatusAlert {...statusAlertProps} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.attendanceManagement.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('home.attendanceManagement.title')}
        </Text>
      </View>

      {fixedHeaderContent}

      <FlatList
        style={styles.fill}
        data={loading ? [] : employees}
        keyExtractor={item => String(item.employee_id)}
        renderItem={renderItem}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />

      {hasSelection ? (
        <View style={styles.floatingBar}>
          <Pressable
            accessibilityRole="button"
            onPress={clearSelection}
            style={styles.floatingCloseBtn}>
            <MaterialCommunityIcons name="close" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.floatingCount}>
            {t('home.attendanceManagement.selectedCount', { count: selectedIds.size })}
          </Text>
          {allSelected ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openBulkModal('all')}
              style={({ pressed }) => [styles.floatingBtn, styles.floatingBtnSecondary, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.floatingBtnLabel, styles.floatingBtnLabelSecondary]}>
                {t('home.attendanceManagement.bulkAll')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => openBulkModal('selected')}
            style={({ pressed }) => [styles.floatingBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.floatingBtnLabel}>
              {t('home.attendanceManagement.bulkContinue')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <StatusAlert {...statusAlertProps} />
      <ConfirmAlert {...confirmAlertProps} />
      <DatePicker
        visible={datePickerVisible}
        value={selectedDate}
        maxDate={today}
        title={t('home.attendanceManagement.selectDate')}
        locale={i18n.language}
        onDismiss={() => setDatePickerVisible(false)}
        onConfirm={setSelectedDate}
      />
      <MarkAttendanceModal
        visible={markVisible}
        target={markTarget}
        submitting={markSubmitting}
        leaveConfigs={leaveConfigs}
        onDismiss={closeMarkModal}
        onSubmit={handleMarkSubmit}
      />
      <BulkApproveModal
        visible={bulkVisible}
        target={bulkTarget}
        submitting={bulkSubmitting}
        leaveConfigs={leaveConfigs}
        onDismiss={closeBulkModal}
        onSubmit={handleBulkSubmit}
      />
    </SafeAreaView>
  );
}
