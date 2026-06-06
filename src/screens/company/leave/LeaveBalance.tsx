import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { attendanceApi } from '@src/api/attendanceApi';
import { leaveApi } from '@src/api/leaveApi';
import { AssignLeaveBalanceModal } from '@src/components/modals/AssignLeaveBalanceModal';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { UpdateLeaveBalanceModal } from '@src/components/modals/UpdateLeaveBalanceModal';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmpLeaveBalances } from '@src/hooks/useEmpLeaveBalances';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  EmpLeaveBalanceEmployee,
  EmpLeaveBalanceType,
  LeaveBalanceMutationItem,
} from '@src/types/empLeaveBalance';
import type { LeaveConfigEntry } from '@src/types/markAttendance';
import { resolveProfilePictureUrl } from '@src/utils/attendanceListDisplay';
import { coerceLeaveDays, formatLeaveDays } from '@src/utils/formatLeaveDays';
import { readApiError } from '@src/utils/readApiError';

const ACTION_T = 'home.leaveBalances.actions.';

type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveBalance'>;

const SEARCH_DEBOUNCE_MS = 400;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 10;
const MAX_YEAR = CURRENT_YEAR + 1;

const LEAVE_ACCENT_COLORS = [
  { accent: '#6366f1', soft: '#eef2ff', border: '#c7d2fe' },
  { accent: '#8b5cf6', soft: '#f5f3ff', border: '#ddd6fe' },
  { accent: '#0ea5e9', soft: '#f0f9ff', border: '#bae6fd' },
  { accent: '#10b981', soft: '#ecfdf5', border: '#a7f3d0' },
  { accent: '#f59e0b', soft: '#fffbeb', border: '#fde68a' },
  { accent: '#ec4899', soft: '#fdf2f8', border: '#fbcfe8' },
] as const;

type LeaveAccent = {
  accent: string;
  soft: string;
  border: string;
};

function getLeaveAccent(index: number, scheme: 'light' | 'dark'): LeaveAccent {
  const base = LEAVE_ACCENT_COLORS[index % LEAVE_ACCENT_COLORS.length];
  if (scheme === 'light') {
    return base;
  }
  return {
    accent: base.accent,
    soft: `${base.accent}22`,
    border: `${base.accent}44`,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const screenBg = isDark ? colors.background : '#f0f4ff';
  const cardBg = isDark ? colors.background : '#ffffff';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: screenBg },
    stackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 52,
      maxHeight: 52,
    },
    stackHeaderTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    headerAssignBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    headerAssignBtnPressed: { opacity: 0.88 },
    headerAssignBtnDisabled: { opacity: 0.4 },
    filtersWrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      backgroundColor: screenBg,
    },
    yearCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: isDark ? '#1e3a5f' : '#4f46e5',
      ...Platform.select({
        ios: {
          shadowColor: '#4f46e5',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.25,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    yearNavBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    yearNavBtnDisabled: { opacity: 0.35 },
    yearCenter: { alignItems: 'center' },
    yearLabel: { fontSize: 18, fontWeight: '800', color: '#fff' },
    yearSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
    yearHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fff7ed',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#fed7aa',
    },
    yearHintText: { flex: 1, fontSize: 12, color: isDark ? '#fcd34d' : '#b45309', lineHeight: 17 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e0e7ff',
      paddingHorizontal: 12,
      marginBottom: 8,
      minHeight: 44,
      ...Platform.select({
        ios: {
          shadowColor: '#6366f1',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.1 : 0.06,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 8 : 5,
      fontSize: 14,
      color: colors.text,
    },
    searchClearBtn: { marginLeft: 4, padding: 4 },
    totalBadge: {
      alignSelf: 'flex-start',
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(99,102,241,0.35)' : '#c7d2fe',
    },
    totalBadgeText: { fontSize: 12, fontWeight: '700', color: isDark ? '#a5b4fc' : '#4338ca' },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    employeeCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e0e7ff',
      marginBottom: 14,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#6366f1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.15 : 0.08,
          shadowRadius: 10,
        },
        android: { elevation: 3 },
      }),
    },
    employeeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : '#e2e8f0',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: '#818cf8',
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: '#818cf8',
      backgroundColor: isDark ? '#312e81' : '#eef2ff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 15, fontWeight: '800', color: isDark ? '#c7d2fe' : '#4338ca' },
    employeeMain: { flex: 1, minWidth: 0 },
    employeeAssignBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : '#eef2ff',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(129,140,248,0.4)' : '#c7d2fe',
    },
    employeeAssignBtnPressed: { opacity: 0.88 },
    employeeName: { fontSize: 15, fontWeight: '800', color: colors.text },
    employeeCode: {
      fontSize: 11,
      color: isDark ? '#a5b4fc' : '#6366f1',
      marginTop: 2,
      fontWeight: '600',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    contactText: { flex: 1, fontSize: 11, color: colors.textMuted },
    leavesWrap: { padding: 12 },
    leaveCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 10,
    },
    leaveCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    leaveIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveTitleCol: { flex: 1, minWidth: 0 },
    leaveName: { fontSize: 14, fontWeight: '700', color: colors.text },
    leaveCodePill: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    leaveCodeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    leaveActions: { flexDirection: 'row', gap: 4 },
    rowActionBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    rowActionBtnDisabled: { opacity: 0.35 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badgePaid: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5',
    },
    badgeHalf: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(14,165,233,0.2)' : '#e0f2fe',
    },
    badgeTextPaid: { fontSize: 10, fontWeight: '700', color: isDark ? '#6ee7b7' : '#047857' },
    badgeTextHalf: { fontSize: 10, fontWeight: '700', color: isDark ? '#7dd3fc' : '#0369a1' },
    statsRow: { flexDirection: 'row', gap: 8 },
    statBox: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      minWidth: 0,
    },
    statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    statValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
    statAllocated: {
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#dbeafe',
    },
    statAllocatedLabel: { color: isDark ? '#93c5fd' : '#1d4ed8' },
    statAllocatedValue: { color: isDark ? '#bfdbfe' : '#1e40af' },
    statUsed: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7',
    },
    statUsedLabel: { color: isDark ? '#fcd34d' : '#b45309' },
    statUsedValue: { color: isDark ? '#fde68a' : '#92400e' },
    statRemaining: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#d1fae5',
    },
    statRemainingLabel: { color: isDark ? '#6ee7b7' : '#047857' },
    statRemainingValue: { color: isDark ? '#a7f3d0' : '#065f46' },
    statRemainingNegative: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#fee2e2',
    },
    statRemainingNegativeLabel: { color: isDark ? '#fca5a5' : '#b91c1c' },
    statRemainingNegativeValue: { color: isDark ? '#fecaca' : '#991b1b' },
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    paginationBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    paginationBtnDisabled: { opacity: 0.35 },
    paginationBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    paginationInfo: { fontSize: 12, color: colors.textMuted },
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    error: { fontSize: 14, color: colors.danger, textAlign: 'center', marginBottom: 12 },
    retryBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
    skeleton: {
      height: 140,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
      marginBottom: 10,
      opacity: 0.6,
    },
    loadingOverlay: { position: 'absolute', top: 120, alignSelf: 'center' },
  });
}

type RowStyles = ReturnType<typeof buildStyles>;

type LeaveTypeRowProps = {
  leave: EmpLeaveBalanceType;
  index: number;
  styles: RowStyles;
  colors: AppThemeColors;
  scheme: 'light' | 'dark';
  t: (key: string) => string;
  canMutate: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const LeaveTypeRow = React.memo(function LeaveTypeRow({
  leave,
  index,
  styles,
  colors,
  scheme,
  t,
  canMutate,
  onEdit,
  onDelete,
}: LeaveTypeRowProps) {
  const remainingNegative = coerceLeaveDays(leave.remaining) < 0;
  const canDelete = coerceLeaveDays(leave.used) <= 0;
  const accent = getLeaveAccent(index, scheme);
  const leaveCode = leave.type?.trim() || (leave as { code?: string }).code?.trim() || '';

  return (
    <View
      style={[
        styles.leaveCard,
        { backgroundColor: accent.soft, borderColor: accent.border },
      ]}>
      <View style={styles.leaveCardTop}>
        <View style={[styles.leaveIconWrap, { backgroundColor: `${accent.accent}22` }]}>
          <MaterialCommunityIcons name="calendar-check" size={20} color={accent.accent} />
        </View>
        <View style={styles.leaveTitleCol}>
          <Text style={styles.leaveName} numberOfLines={2}>{leave.name}</Text>
          {leaveCode ? (
            <View style={[styles.leaveCodePill, { backgroundColor: `${accent.accent}18` }]}>
              <Text style={[styles.leaveCodeText, { color: accent.accent }]}>{leaveCode}</Text>
            </View>
          ) : null}
        </View>
        {canMutate ? (
          <View style={styles.leaveActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.leaveBalances.editBalance')}
              onPress={onEdit}
              style={styles.rowActionBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={accent.accent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.leaveBalances.deleteBalance')}
              disabled={!canDelete}
              onPress={onDelete}
              style={[styles.rowActionBtn, !canDelete && styles.rowActionBtnDisabled]}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={16}
                color={canDelete ? colors.danger : colors.textMuted}
              />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        {leave.is_paid ? (
          <View style={styles.badgePaid}>
            <Text style={styles.badgeTextPaid}>{t('home.leaveBalances.paid')}</Text>
          </View>
        ) : null}
        {leave.allow_half_day ? (
          <View style={styles.badgeHalf}>
            <Text style={styles.badgeTextHalf}>{t('home.leaveBalances.halfDay')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, styles.statAllocated]}>
          <Text style={[styles.statLabel, styles.statAllocatedLabel]}>
            {t('home.leaveBalances.allocated')}
          </Text>
          <Text style={[styles.statValue, styles.statAllocatedValue]}>
            {formatLeaveDays(leave.total_allocated)}
          </Text>
        </View>
        <View style={[styles.statBox, styles.statUsed]}>
          <Text style={[styles.statLabel, styles.statUsedLabel]}>
            {t('home.leaveBalances.used')}
          </Text>
          <Text style={[styles.statValue, styles.statUsedValue]}>
            {formatLeaveDays(leave.used)}
          </Text>
        </View>
        <View
          style={[
            styles.statBox,
            remainingNegative ? styles.statRemainingNegative : styles.statRemaining,
          ]}>
          <Text
            style={[
              styles.statLabel,
              remainingNegative
                ? styles.statRemainingNegativeLabel
                : styles.statRemainingLabel,
            ]}>
            {t('home.leaveBalances.remaining')}
          </Text>
          <Text
            style={[
              styles.statValue,
              remainingNegative
                ? styles.statRemainingNegativeValue
                : styles.statRemainingValue,
            ]}>
            {formatLeaveDays(leave.remaining)}
          </Text>
        </View>
      </View>
    </View>
  );
});

type EmployeeBalanceCardProps = {
  item: EmpLeaveBalanceEmployee;
  styles: RowStyles;
  colors: AppThemeColors;
  scheme: 'light' | 'dark';
  t: (key: string) => string;
  canMutate: boolean;
  onAssign: (employee: EmpLeaveBalanceEmployee) => void;
  onEditLeave: (employee: EmpLeaveBalanceEmployee, leave: EmpLeaveBalanceType) => void;
  onDeleteLeave: (employee: EmpLeaveBalanceEmployee, leave: EmpLeaveBalanceType) => void;
};

const EmployeeBalanceCard = React.memo(function EmployeeBalanceCard({
  item,
  styles,
  colors,
  scheme,
  t,
  canMutate,
  onAssign,
  onEditLeave,
  onDeleteLeave,
}: EmployeeBalanceCardProps) {
  const avatarUri = resolveProfilePictureUrl(item.profile_picture);
  const email = item.email?.trim() ?? '';
  const mobile = item.mobile?.trim() ?? '';

  return (
    <View style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{getInitials(item.employee_name)}</Text>
          </View>
        )}
        <View style={styles.employeeMain}>
          <Text style={styles.employeeName} numberOfLines={1}>{item.employee_name}</Text>
          <Text style={styles.employeeCode} numberOfLines={1}>{item.employee_code}</Text>
          {email ? (
            <View style={styles.contactRow}>
              <MaterialCommunityIcons name="email-outline" size={12} color={colors.textMuted} />
              <Text style={styles.contactText} numberOfLines={1}>{email}</Text>
            </View>
          ) : null}
          {mobile ? (
            <View style={styles.contactRow}>
              <MaterialCommunityIcons name="phone-outline" size={12} color={colors.textMuted} />
              <Text style={styles.contactText} numberOfLines={1}>{mobile}</Text>
            </View>
          ) : null}
        </View>
        {canMutate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.leaveBalances.addBalance')}
            onPress={() => onAssign(item)}
            style={({ pressed }) => [
              styles.employeeAssignBtn,
              pressed && styles.employeeAssignBtnPressed,
            ]}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.leavesWrap}>
        {item.leaves.map((leave, index) => (
          <LeaveTypeRow
            key={leave.leave_config_id}
            leave={leave}
            index={index}
            styles={styles}
            colors={colors}
            scheme={scheme}
            t={t}
            canMutate={canMutate}
            onEdit={() => onEditLeave(item, leave)}
            onDelete={() => onDeleteLeave(item, leave)}
          />
        ))}
      </View>
    </View>
  );
});

type AssignPreselectedEmployee = {
  id: number;
  name: string;
  employeeCode: string;
};

export function LeaveBalanceScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();
  const { props: confirmProps, present: presentConfirm } = useConfirmAlert();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignPreselectedEmployee, setAssignPreselectedEmployee] =
    useState<AssignPreselectedEmployee | null>(null);
  const [assignExcludeConfigIds, setAssignExcludeConfigIds] = useState<number[]>([]);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateEmployee, setUpdateEmployee] = useState<EmpLeaveBalanceEmployee | null>(null);
  const [updateLeave, setUpdateLeave] = useState<EmpLeaveBalanceType | null>(null);
  const [leaveConfigs, setLeaveConfigs] = useState<LeaveConfigEntry[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const pendingAssignRef = useRef<{
    employeeId: number;
    leaves: LeaveBalanceMutationItem[];
    employeeName: string;
  } | null>(null);
  const pendingUpdateRef = useRef<{
    employeeId: number;
    leaves: LeaveBalanceMutationItem[];
    employeeName: string;
    leaveName: string;
  } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, year]);

  const {
    employees,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  } = useEmpLeaveBalances({
    companyId,
    year,
    page,
    search: debouncedSearch,
  });

  const canGoPrev = (meta?.page ?? 1) > 1;
  const canGoNext = meta != null && meta.page < meta.total_pages;
  const canMutate = year === CURRENT_YEAR && companyId != null && !accessDenied;

  const loadLeaveConfigs = useCallback(async () => {
    if (companyId == null) {
      setLeaveConfigs([]);
      return;
    }
    setLoadingConfigs(true);
    try {
      const res = await attendanceApi.fetchLeaveConfigs(companyId);
      setLeaveConfigs(res.data ?? []);
    } catch (e) {
      setLeaveConfigs([]);
      presentError({
        title: t(`${ACTION_T}errorTitle`),
        message: readApiError(e),
      });
    } finally {
      setLoadingConfigs(false);
    }
  }, [companyId, presentError, t]);

  const openAssignModal = useCallback(
    (employee?: EmpLeaveBalanceEmployee) => {
      if (companyId == null) {
        presentError({
          title: t(`${ACTION_T}errorTitle`),
          message: t('home.leaveBalances.noCompany'),
        });
        return;
      }
      if (year !== CURRENT_YEAR) {
        return;
      }
      if (employee) {
        setAssignPreselectedEmployee({
          id: employee.employee_id,
          name: employee.employee_name,
          employeeCode: employee.employee_code,
        });
        setAssignExcludeConfigIds(employee.leaves.map(l => l.leave_config_id));
      } else {
        setAssignPreselectedEmployee(null);
        setAssignExcludeConfigIds([]);
      }
      setAssignModalVisible(true);
      loadLeaveConfigs().catch(() => {});
    },
    [companyId, loadLeaveConfigs, presentError, t, year],
  );

  const closeAssignModal = useCallback(() => {
    if (!assignSubmitting) {
      setAssignModalVisible(false);
      setAssignPreselectedEmployee(null);
      setAssignExcludeConfigIds([]);
    }
  }, [assignSubmitting]);

  const submitAssign = useCallback(
    async (employeeId: number, leaves: LeaveBalanceMutationItem[]) => {
      if (companyId == null) {
        return;
      }
      setAssignSubmitting(true);
      try {
        const res = await leaveApi.assignBalance(companyId, { employee_id: employeeId, leaves });
        if (!res.success) {
          throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
        }
        setAssignModalVisible(false);
        setAssignPreselectedEmployee(null);
        setAssignExcludeConfigIds([]);
        presentSuccess({
          title: t(`${ACTION_T}assignSuccessTitle`),
          message: res.message?.trim() || t(`${ACTION_T}assignSuccessTitle`),
        });
        refresh();
      } catch (e) {
        presentError({
          title: t(`${ACTION_T}errorTitle`),
          message: readApiError(e),
        });
      } finally {
        setAssignSubmitting(false);
        pendingAssignRef.current = null;
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const handleAssignSubmit = useCallback(
    (employeeId: number, leaves: LeaveBalanceMutationItem[], employeeName: string) => {
      pendingAssignRef.current = { employeeId, leaves, employeeName };
      presentConfirm({
        title: t(`${ACTION_T}confirmAssignTitle`),
        message: t(`${ACTION_T}confirmAssignMessage`, { name: employeeName }),
        buttons: [
          { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
          {
            text: t(`${ACTION_T}confirm`),
            variant: 'primary',
            onPress: () => {
              const pending = pendingAssignRef.current;
              if (pending) {
                submitAssign(pending.employeeId, pending.leaves).catch(() => {});
              }
            },
          },
        ],
      });
    },
    [presentConfirm, submitAssign, t],
  );

  const openUpdateModal = useCallback(
    (employee: EmpLeaveBalanceEmployee, leave: EmpLeaveBalanceType) => {
      setUpdateEmployee(employee);
      setUpdateLeave(leave);
      setUpdateModalVisible(true);
    },
    [],
  );

  const closeUpdateModal = useCallback(() => {
    if (!updateSubmitting) {
      setUpdateModalVisible(false);
      setUpdateEmployee(null);
      setUpdateLeave(null);
    }
  }, [updateSubmitting]);

  const submitUpdate = useCallback(
    async (employeeId: number, leaves: LeaveBalanceMutationItem[]) => {
      if (companyId == null) {
        return;
      }
      setUpdateSubmitting(true);
      try {
        const res = await leaveApi.updateBalance(companyId, { employee_id: employeeId, leaves });
        if (!res.success) {
          throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
        }
        setUpdateModalVisible(false);
        setUpdateEmployee(null);
        setUpdateLeave(null);
        presentSuccess({
          title: t(`${ACTION_T}updateSuccessTitle`),
          message: res.message?.trim() || t(`${ACTION_T}updateSuccessTitle`),
        });
        refresh();
      } catch (e) {
        presentError({
          title: t(`${ACTION_T}errorTitle`),
          message: readApiError(e),
        });
      } finally {
        setUpdateSubmitting(false);
        pendingUpdateRef.current = null;
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const handleUpdateSubmit = useCallback(
    (totalAllocated: number) => {
      if (!updateEmployee || !updateLeave) {
        return;
      }
      const payload = {
        employeeId: updateEmployee.employee_id,
        leaves: [{ leave_config_id: updateLeave.leave_config_id, total_allocated: totalAllocated }],
        employeeName: updateEmployee.employee_name,
        leaveName: updateLeave.name,
      };
      pendingUpdateRef.current = payload;
      presentConfirm({
        title: t(`${ACTION_T}confirmUpdateTitle`),
        message: t(`${ACTION_T}confirmUpdateMessage`, {
          name: updateEmployee.employee_name,
          leave: updateLeave.name,
        }),
        buttons: [
          { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
          {
            text: t(`${ACTION_T}confirm`),
            variant: 'primary',
            onPress: () => {
              const pending = pendingUpdateRef.current;
              if (pending) {
                submitUpdate(pending.employeeId, pending.leaves).catch(() => {});
              }
            },
          },
        ],
      });
    },
    [presentConfirm, submitUpdate, t, updateEmployee, updateLeave],
  );

  const submitDelete = useCallback(
    async (employeeId: number, leaveConfigId: number) => {
      if (companyId == null) {
        return;
      }
      setDeleteSubmitting(true);
      try {
        const res = await leaveApi.deleteBalance(companyId, {
          employee_id: employeeId,
          leave_config_id: leaveConfigId,
        });
        if (!res.success) {
          throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
        }
        presentSuccess({
          title: t(`${ACTION_T}deleteSuccessTitle`),
          message: res.message?.trim() || t(`${ACTION_T}deleteSuccessTitle`),
        });
        refresh();
      } catch (e) {
        presentError({
          title: t(`${ACTION_T}errorTitle`),
          message: readApiError(e),
        });
      } finally {
        setDeleteSubmitting(false);
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const handleDeleteLeave = useCallback(
    (employee: EmpLeaveBalanceEmployee, leave: EmpLeaveBalanceType) => {
      if (coerceLeaveDays(leave.used) > 0) {
        return;
      }
      presentConfirm({
        title: t(`${ACTION_T}confirmDeleteTitle`),
        message: t(`${ACTION_T}confirmDeleteMessage`, {
          name: employee.employee_name,
          leave: leave.name,
        }),
        buttons: [
          { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
          {
            text: t(`${ACTION_T}confirm`),
            variant: 'danger',
            onPress: () => {
              submitDelete(employee.employee_id, leave.leave_config_id).catch(() => {});
            },
          },
        ],
      });
    },
    [presentConfirm, submitDelete, t],
  );

  const goPrevYear = useCallback(() => {
    setYear(prev => Math.max(MIN_YEAR, prev - 1));
  }, []);

  const goNextYear = useCallback(() => {
    setYear(prev => Math.min(MAX_YEAR, prev + 1));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: EmpLeaveBalanceEmployee }) => (
      <EmployeeBalanceCard
        item={item}
        styles={styles}
        colors={colors}
        scheme={resolvedScheme}
        t={t}
        canMutate={canMutate}
        onAssign={openAssignModal}
        onEditLeave={openUpdateModal}
        onDeleteLeave={handleDeleteLeave}
      />
    ),
    [canMutate, colors, handleDeleteLeave, openAssignModal, openUpdateModal, resolvedScheme, styles, t],
  );

  const keyExtractor = useCallback(
    (item: EmpLeaveBalanceEmployee) => String(item.employee_id),
    [],
  );

  const listHeader = useMemo(() => {
    if (meta?.total != null) {
      return (
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            {t('home.leaveBalances.totalEmployees', { count: meta.total })}
          </Text>
        </View>
      );
    }
    return null;
  }, [meta?.total, styles, t]);

  const listFooter = useMemo(() => {
    if (meta == null || meta.total_pages <= 1) {
      return null;
    }
    return (
      <View style={styles.paginationRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoPrev}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          style={[styles.paginationBtn, !canGoPrev && styles.paginationBtnDisabled]}>
          <Text style={styles.paginationBtnText}>{t('home.leaveBalances.prevPage')}</Text>
        </Pressable>
        <Text style={styles.paginationInfo}>
          {t('home.leaveBalances.pageInfo', {
            page: meta.page,
            total: meta.total_pages,
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoNext}
          onPress={() => setPage(p => p + 1)}
          style={[styles.paginationBtn, !canGoNext && styles.paginationBtnDisabled]}>
          <Text style={styles.paginationBtnText}>{t('home.leaveBalances.nextPage')}</Text>
        </Pressable>
      </View>
    );
  }, [canGoNext, canGoPrev, meta, styles, t]);

  const listEmpty = useMemo(() => {
    if (loading && employees.length === 0) {
      return (
        <View>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      );
    }
    if (companyId == null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{t('home.leaveBalances.noCompany')}</Text>
        </View>
      );
    }
    if (accessDenied) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{t('home.leaveBalances.accessDenied')}</Text>
        </View>
      );
    }
    if (error != null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>{t('home.leaveBalances.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <MaterialCommunityIcons name="scale-balance" size={40} color={colors.textMuted} />
        <Text style={styles.muted}>
          {debouncedSearch
            ? t('home.leaveBalances.emptyFiltered')
            : t('home.leaveBalances.empty', { year })}
        </Text>
      </View>
    );
  }, [
    accessDenied,
    colors.textMuted,
    companyId,
    debouncedSearch,
    employees.length,
    error,
    loading,
    retry,
    styles,
    t,
    year,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.leaveBalances.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header">
          {t('home.leaveBalances.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.leaveBalances.assignBalance')}
          disabled={!canMutate}
          onPress={() => openAssignModal()}
          style={({ pressed }) => [
            styles.headerAssignBtn,
            !canMutate && styles.headerAssignBtnDisabled,
            pressed && canMutate && styles.headerAssignBtnPressed,
          ]}>
          <MaterialCommunityIcons name="account-plus-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.filtersWrap}>
        <View style={styles.yearCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.leaveBalances.prevYear')}
            disabled={year <= MIN_YEAR}
            onPress={goPrevYear}
            style={[styles.yearNavBtn, year <= MIN_YEAR && styles.yearNavBtnDisabled]}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.yearCenter}>
            <Text style={styles.yearLabel} accessibilityRole="text">
              {t('home.leaveBalances.yearLabel', { year })}
            </Text>
            <Text style={styles.yearSub}>{t('home.leaveBalances.title')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.leaveBalances.nextYear')}
            disabled={year >= MAX_YEAR}
            onPress={goNextYear}
            style={[styles.yearNavBtn, year >= MAX_YEAR && styles.yearNavBtnDisabled]}>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
          </Pressable>
        </View>

        {year !== CURRENT_YEAR ? (
          <View style={styles.yearHint}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
            <Text style={styles.yearHintText}>
              {t('home.leaveBalances.currentYearOnly', { year: CURRENT_YEAR })}
            </Text>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.leaveBalances.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.leaveRequest.clearSearch')}
              onPress={() => setSearch('')}
              style={styles.searchClearBtn}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={loading && employees.length === 0 ? [] : employees}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {loading && employees.length > 0 ? (
        <ActivityIndicator style={styles.loadingOverlay} color={colors.primary} />
      ) : null}

      <AssignLeaveBalanceModal
        visible={assignModalVisible}
        companyId={companyId}
        preselectedEmployee={assignPreselectedEmployee}
        leaveConfigs={leaveConfigs}
        loadingConfigs={loadingConfigs}
        excludeConfigIds={assignExcludeConfigIds}
        submitting={assignSubmitting}
        onDismiss={closeAssignModal}
        onSubmit={handleAssignSubmit}
      />

      <UpdateLeaveBalanceModal
        visible={updateModalVisible}
        employee={updateEmployee}
        leave={updateLeave}
        submitting={updateSubmitting || deleteSubmitting}
        onDismiss={closeUpdateModal}
        onSubmit={handleUpdateSubmit}
      />

      <ConfirmAlert {...confirmProps} />
      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
