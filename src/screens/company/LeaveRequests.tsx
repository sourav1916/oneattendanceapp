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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { attendanceApi } from '@src/api/attendanceApi';
import { leaveApi } from '@src/api/leaveApi';
import { ApproveLeaveModal } from '@src/components/modals/ApproveLeaveModal';
import {
  BulkLeaveActionModal,
  type BulkLeaveTarget,
} from '@src/components/modals/BulkLeaveActionModal';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { CreateManagementLeaveModal } from '@src/components/modals/CreateManagementLeaveModal';
import { DateRangePicker } from '@src/components/modals/DateRangePicker';
import { EmpLeaveDetailModal } from '@src/components/modals/EmpLeaveDetailModal';
import { RejectLeaveModal } from '@src/components/modals/RejectLeaveModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmpLeaves } from '@src/hooks/useEmpLeaves';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { EmpLeaveStatus, EmployeeLeaveRow } from '@src/types/employeeLeave';
import type {
  ApproveEditLeavePayload,
  CreateManagementLeavePayload,
} from '@src/types/leaveManagement';
import type { LeaveConfigEntry } from '@src/types/markAttendance';
import { resolveProfilePictureUrl } from '@src/utils/attendanceListDisplay';
import { formatLedgerShortDate } from '@src/utils/ledgerFormat';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveRequests'>;

const SEARCH_DEBOUNCE_MS = 350;
const FLOATING_BAR_EXTRA_PADDING = 80;
const CONFIRM_T = 'home.leaveRequests.actions.confirm.';
const CREATE_T = 'home.leaveManagement.createModal.';
const STATUS_FILTERS: Array<EmpLeaveStatus | null> = [
  null, 'pending', 'approved', 'rejected',
];

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type StatusColor = { bg: string; text: string; border: string };

function statusColors(status: EmpLeaveStatus, scheme: 'light' | 'dark'): StatusColor {
  switch (status) {
    case 'pending':
      return scheme === 'dark'
        ? { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.4)' }
        : { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
    case 'approved':
      return scheme === 'dark'
        ? { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.4)' }
        : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
    case 'rejected':
      return scheme === 'dark'
        ? { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.4)' }
        : { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
    case 'cancelled':
      return scheme === 'dark'
        ? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.4)' }
        : { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
  }
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
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
    headerCreateBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    headerCreateBtnPressed: { opacity: 0.88 },
    filtersWrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      backgroundColor: colors.background,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      marginBottom: 8,
      minHeight: 40,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 8 : 5,
      fontSize: 14,
      color: colors.text,
    },
    searchClearBtn: { marginLeft: 4, padding: 4 },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    filterChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minHeight: 40,
    },
    filterChipActive: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.18)' : '#eff6ff',
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    filterChipTextActive: { color: colors.primary },
    clearBtn: { padding: 4 },
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
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
    },
    statusChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    statusChipTextActive: { color: colors.primary },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    leaveCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: scheme === 'dark' ? 0.15 : 0.04,
          shadowRadius: 2,
        },
        android: { elevation: 1 },
      }),
    },
    leaveCardPressed: { opacity: 0.88 },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleCol: { flex: 1, minWidth: 0 },
    employeeName: { fontSize: 14, fontWeight: '700', color: colors.text },
    employeeCode: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    leaveStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    leaveStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    leaveTypeText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
    leaveDateText: { fontSize: 11, color: colors.textMuted },
    cardChevron: { marginLeft: 4 },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    selectBtn: {
      padding: 4,
      marginRight: 2,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    actionBtnApprove: {
      borderColor: '#bbf7d0',
      backgroundColor: scheme === 'dark' ? 'rgba(34,197,94,0.12)' : '#f0fdf4',
    },
    actionBtnReject: {
      borderColor: '#fecaca',
      backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.12)' : '#fef2f2',
    },
    actionBtnText: { fontSize: 11, fontWeight: '700', color: colors.text },
    actionBtnTextApprove: { color: '#15803d' },
    actionBtnTextReject: { color: '#dc2626' },
    leaveCardSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.08)' : '#f8fbff',
    },
    floatingBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        android: { elevation: 8 },
      }),
    },
    floatingCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondaryButton,
    },
    floatingCount: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    floatingBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    floatingBtnSecondary: {
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    floatingBtnLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
    floatingBtnLabelSecondary: { color: colors.text },
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
    error: { fontSize: 14, color: '#dc2626', textAlign: 'center', marginBottom: 12 },
    retryBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
    skeleton: {
      height: 120,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
      marginBottom: 8,
      opacity: 0.6,
    },
    totalBadge: {
      alignSelf: 'flex-start',
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: scheme === 'dark' ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
    },
    totalBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    loadingOverlay: { position: 'absolute', top: 120, alignSelf: 'center' },
    chipScrollContent: { paddingRight: 8 },
  });
}

type RowStyles = ReturnType<typeof buildStyles>;

type LeaveRowCardProps = {
  item: EmployeeLeaveRow;
  styles: RowStyles;
  scheme: 'light' | 'dark';
  t: (key: string, opts?: Record<string, unknown>) => string;
  selected: boolean;
  onPress: () => void;
  onToggleSelect: () => void;
  onQuickApprove: () => void;
  onReject: () => void;
};

const LeaveRowCard = React.memo(function LeaveRowCard({
  item,
  styles,
  scheme,
  t,
  selected,
  onPress,
  onToggleSelect,
  onQuickApprove,
  onReject,
}: LeaveRowCardProps) {
  const sc = statusColors(item.status, scheme);
  const avatarUri = resolveProfilePictureUrl(item.profile_picture);

  const dateLabel =
    item.start_date === item.end_date
      ? formatShortDate(item.start_date)
      : `${formatShortDate(item.start_date)} – ${formatShortDate(item.end_date)}`;

  const leaveTypeLabel = item.leave_code
    ? `${item.leave_name} (${item.leave_code})`
    : item.leave_name;

  const isPending = item.status === 'pending';

  return (
    <View
      style={[
        styles.leaveCard,
        selected && styles.leaveCardSelected,
      ]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.leaveCardPressed]}>
        <View style={styles.cardTopRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <MaterialCommunityIcons name="account" size={20} color="#94a3b8" />
            </View>
          )}
          <View style={styles.cardTitleCol}>
            <Text style={styles.employeeName} numberOfLines={1}>{item.employee_name}</Text>
            <Text style={styles.employeeCode} numberOfLines={1}>{item.employee_code}</Text>
          </View>
          <View style={[styles.leaveStatusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.leaveStatusText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardSubRow}>
          <Text style={styles.leaveTypeText} numberOfLines={1}>{leaveTypeLabel}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color="#94a3b8"
            style={styles.cardChevron}
          />
        </View>
        <Text style={styles.leaveDateText} numberOfLines={1}>
          {dateLabel}
          {' · '}
          {t('home.leaveRequest.daysLabel', { count: item.total_days })}
        </Text>
      </Pressable>

      {isPending ? (
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={onToggleSelect}
            style={styles.selectBtn}>
            <MaterialCommunityIcons
              name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={selected ? '#2563eb' : '#94a3b8'}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onQuickApprove}
            style={[styles.actionBtn, styles.actionBtnApprove]}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#15803d" />
            <Text style={[styles.actionBtnText, styles.actionBtnTextApprove]}>
              {t('home.leaveRequests.actions.quickApprove')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onReject}
            style={[styles.actionBtn, styles.actionBtnReject]}>
            <MaterialCommunityIcons name="close-circle-outline" size={14} color="#dc2626" />
            <Text style={[styles.actionBtnText, styles.actionBtnTextReject]}>
              {t('home.leaveRequests.actions.reject')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export function LeaveRequestsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
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

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmpLeaveStatus | null>(null);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [dateRangePickerVisible, setDateRangePickerVisible] = useState(false);
  const [detailLeave, setDetailLeave] = useState<EmployeeLeaveRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLeave, setActionLeave] = useState<EmployeeLeaveRow | null>(null);
  const [approveVisible, setApproveVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<BulkLeaveTarget | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [leaveConfigs, setLeaveConfigs] = useState<LeaveConfigEntry[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const pendingCreatePayloadRef = useRef<CreateManagementLeavePayload | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, fromDate, toDate]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, statusFilter, fromDate, toDate, page]);

  const handleDateRangeConfirm = useCallback((from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setDateRangePickerVisible(false);
  }, []);

  const clearDateRange = useCallback(() => {
    setFromDate(null);
    setToDate(null);
  }, []);

  const handleDateRangeClear = useCallback(() => {
    clearDateRange();
    setDateRangePickerVisible(false);
  }, [clearDateRange]);

  const dateRangeLabel = useMemo(() => {
    if (fromDate != null && toDate != null) {
      return `${formatLedgerShortDate(fromDate)} – ${formatLedgerShortDate(toDate)}`;
    }
    return t('home.leaveRequests.dateRange');
  }, [fromDate, toDate, t]);

  const hasDateRange = fromDate != null || toDate != null;

  const {
    leaves,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  } = useEmpLeaves({
    companyId,
    page,
    search: debouncedSearch,
    status: statusFilter,
    startDate: fromDate ?? '',
    endDate: toDate ?? '',
  });

  const statusLabel = useCallback(
    (status: EmpLeaveStatus | null) => {
      if (status == null) {
        return t('home.leaveRequest.filterAll');
      }
      switch (status) {
        case 'pending':
          return t('home.leaveRequest.filterPending');
        case 'approved':
          return t('home.leaveRequest.filterApproved');
        case 'rejected':
          return t('home.leaveRequest.filterRejected');
        case 'cancelled':
          return t('home.leaveRequest.filterCancelled');
      }
    },
    [t],
  );

  const canGoPrev = (meta?.page ?? 1) > 1;
  const canGoNext = meta != null && meta.page < meta.total_pages;

  const hasSelection = selectedIds.size > 0;

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      hasSelection && {
        paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM + FLOATING_BAR_EXTRA_PADDING,
      },
    ],
    [hasSelection, styles.listContent],
  );

  const openDetail = useCallback((item: EmployeeLeaveRow) => {
    setDetailLeave(item);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailLeave(null);
  }, []);

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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

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
        title: t(`${CREATE_T}errorTitle`),
        message: readApiError(e),
      });
    } finally {
      setLoadingConfigs(false);
    }
  }, [companyId, presentError, t]);

  const openCreateModal = useCallback(() => {
    if (companyId == null) {
      presentError({
        title: t(`${CREATE_T}errorTitle`),
        message: t(`${CREATE_T}noCompany`),
      });
      return;
    }
    setCreateModalVisible(true);
    loadLeaveConfigs().catch(() => {});
  }, [companyId, loadLeaveConfigs, presentError, t]);

  const submitCreateLeave = useCallback(
    async (payload: CreateManagementLeavePayload) => {
      if (companyId == null) {
        return;
      }
      setCreateSubmitting(true);
      try {
        const res = await leaveApi.createManagementLeave(companyId, payload);
        if (!res.success) {
          throw new Error(res.message?.trim() || t(`${CREATE_T}errorTitle`));
        }
        setCreateModalVisible(false);
        presentSuccess({
          title: t(`${CREATE_T}successTitle`),
          message: res.message?.trim() || t(`${CREATE_T}successTitle`),
        });
        refresh();
      } catch (e) {
        presentError({
          title: t(`${CREATE_T}errorTitle`),
          message: readApiError(e),
        });
      } finally {
        setCreateSubmitting(false);
        pendingCreatePayloadRef.current = null;
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const handleCreateSubmit = useCallback(
    (payload: CreateManagementLeavePayload, employeeName: string) => {
      pendingCreatePayloadRef.current = payload;
      presentConfirm({
        title: t(`${CREATE_T}confirmTitle`),
        message: t(`${CREATE_T}confirmMessage`, { name: employeeName }),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}confirm`),
            variant: 'primary',
            onPress: () => {
              const pending = pendingCreatePayloadRef.current;
              if (pending) {
                submitCreateLeave(pending).catch(() => {});
              }
            },
          },
        ],
      });
    },
    [presentConfirm, submitCreateLeave, t],
  );

  const afterActionSuccess = useCallback(
    (message: string, titleKey: string) => {
      setApproveVisible(false);
      setRejectVisible(false);
      setBulkVisible(false);
      setActionLeave(null);
      setDetailLeave(null);
      setSelectedIds(new Set());
      presentSuccess({
        title: t(titleKey),
        message,
      });
      refresh();
    },
    [presentSuccess, refresh, t],
  );

  const handleActionError = useCallback(
    (err: unknown, fallback?: string) => {
      const message = err instanceof Error && err.message
        ? err.message
        : readApiError(err);
      presentError({
        title: t('home.leaveRequests.actions.errorTitle'),
        message: fallback ?? message,
      });
    },
    [presentError, t],
  );

  const runApprove = useCallback(
    async (payload: ApproveEditLeavePayload) => {
      if (companyId == null) {
        return;
      }
      const target = actionLeave ?? leaves.find(row => row.id === payload.id) ?? null;
      if (target != null && target.status !== 'pending') {
        presentError({
          title: t('home.leaveRequests.actions.errorTitle'),
          message: t('home.leaveRequests.actions.approveModal.notPending'),
        });
        return;
      }
      setActionSubmitting(true);
      try {
        const res = await leaveApi.approveEdit(companyId, payload);
        if (!res.success) {
          presentError({
            title: t('home.leaveRequests.actions.errorTitle'),
            message: res.message,
          });
          return;
        }
        afterActionSuccess(
          res.message,
          'home.leaveRequests.actions.approveSuccessTitle',
        );
      } catch (e) {
        handleActionError(e);
      } finally {
        setActionSubmitting(false);
      }
    },
    [actionLeave, afterActionSuccess, companyId, handleActionError, leaves, presentError, t],
  );

  const runReject = useCallback(
    async (leave: EmployeeLeaveRow, remarks: string) => {
      if (companyId == null) {
        return;
      }
      setActionSubmitting(true);
      try {
        const res = await leaveApi.rejectLeave(companyId, {
          id: leave.id,
          remarks: remarks || null,
        });
        if (!res.success) {
          presentError({
            title: t('home.leaveRequests.actions.errorTitle'),
            message: res.message,
          });
          return;
        }
        afterActionSuccess(
          res.message,
          'home.leaveRequests.actions.rejectSuccessTitle',
        );
      } catch (e) {
        handleActionError(e);
      } finally {
        setActionSubmitting(false);
      }
    },
    [afterActionSuccess, companyId, handleActionError, presentError, t],
  );

  const openApproveModal = useCallback((leave: EmployeeLeaveRow) => {
    if (leave.status !== 'pending') {
      return;
    }
    setActionLeave(leave);
    setApproveVisible(true);
  }, []);

  const openRejectModal = useCallback((leave: EmployeeLeaveRow) => {
    setActionLeave(leave);
    setRejectVisible(true);
  }, []);

  const confirmQuickApprove = useCallback(
    (leave: EmployeeLeaveRow) => {
      if (leave.status !== 'pending') {
        return;
      }
      presentConfirm({
        title: t(`${CONFIRM_T}quickApproveTitle`),
        message: t(`${CONFIRM_T}quickApproveMessage`, { name: leave.employee_name }),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}confirm`),
            variant: 'primary',
            onPress: () => {
              runApprove({ id: leave.id }).catch(() => { });
            },
          },
        ],
      });
    },
    [presentConfirm, runApprove, t],
  );

  const confirmOpenRejectModal = useCallback(
    (leave: EmployeeLeaveRow) => {
      presentConfirm({
        title: t(`${CONFIRM_T}rejectTitle`),
        message: t(`${CONFIRM_T}rejectMessage`, { name: leave.employee_name }),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}continue`),
            variant: 'danger',
            onPress: () => openRejectModal(leave),
          },
        ],
      });
    },
    [openRejectModal, presentConfirm, t],
  );

  const confirmOpenBulkModal = useCallback(
    (mode: 'selected' | 'all') => {
      const count = mode === 'all' ? (meta?.total ?? 0) : selectedIds.size;
      presentConfirm({
        title: t(`${CONFIRM_T}bulkOpenTitle`),
        message:
          mode === 'all'
            ? t(`${CONFIRM_T}bulkOpenAllMessage`)
            : t(`${CONFIRM_T}bulkOpenSelectedMessage`, { count }),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}continue`),
            variant: 'primary',
            onPress: () => {
              if (mode === 'all') {
                setBulkTarget({ ids: 'all', count });
              } else {
                setBulkTarget({ ids: Array.from(selectedIds), count });
              }
              setBulkVisible(true);
            },
          },
        ],
      });
    },
    [meta?.total, presentConfirm, selectedIds, t],
  );

  const confirmApproveSubmit = useCallback(
    (payload: ApproveEditLeavePayload) => {
      presentConfirm({
        title: t(`${CONFIRM_T}submitApproveTitle`),
        message: t(`${CONFIRM_T}submitApproveMessage`),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}confirm`),
            variant: 'primary',
            onPress: () => {
              runApprove(payload).catch(() => { });
            },
          },
        ],
      });
    },
    [presentConfirm, runApprove, t],
  );

  const confirmRejectSubmit = useCallback(
    (leave: EmployeeLeaveRow, remarks: string) => {
      presentConfirm({
        title: t(`${CONFIRM_T}submitRejectTitle`),
        message: t(`${CONFIRM_T}submitRejectMessage`),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}confirm`),
            variant: 'danger',
            onPress: () => {
              runReject(leave, remarks).catch(() => { });
            },
          },
        ],
      });
    },
    [presentConfirm, runReject, t],
  );

  const handleBulkSubmit = useCallback(
    async (action: 'approve' | 'reject', remarks: string) => {
      if (companyId == null || bulkTarget == null) {
        return;
      }
      setActionSubmitting(true);
      try {
        const res = await leaveApi.bulkApproveReject(companyId, {
          ids: bulkTarget.ids,
          action,
          remarks: remarks || null,
        });
        if (!res.success) {
          presentError({
            title: t('home.leaveRequests.actions.errorTitle'),
            message: res.message,
          });
          return;
        }
        afterActionSuccess(
          res.message,
          'home.leaveRequests.actions.bulkSuccessTitle',
        );
      } catch (e) {
        handleActionError(e);
      } finally {
        setActionSubmitting(false);
      }
    },
    [
      afterActionSuccess,
      bulkTarget,
      companyId,
      handleActionError,
      presentError,
      t,
    ],
  );

  const confirmBulkSubmit = useCallback(
    (action: 'approve' | 'reject', remarks: string) => {
      const count = bulkTarget?.count ?? 0;
      presentConfirm({
        title: t(`${CONFIRM_T}submitBulkTitle`),
        message: t(
          action === 'approve'
            ? `${CONFIRM_T}submitBulkApproveMessage`
            : `${CONFIRM_T}submitBulkRejectMessage`,
          { count },
        ),
        buttons: [
          { text: t(`${CONFIRM_T}cancel`), variant: 'secondary' },
          {
            text: t(`${CONFIRM_T}confirm`),
            variant: action === 'reject' ? 'danger' : 'primary',
            onPress: () => {
              handleBulkSubmit(action, remarks).catch(() => { });
            },
          },
        ],
      });
    },
    [bulkTarget?.count, handleBulkSubmit, presentConfirm, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: EmployeeLeaveRow }) => (
      <LeaveRowCard
        item={item}
        styles={styles}
        scheme={resolvedScheme}
        t={t}
        selected={selectedIds.has(item.id)}
        onPress={() => openDetail(item)}
        onToggleSelect={() => toggleSelect(item.id)}
        onQuickApprove={() => confirmQuickApprove(item)}
        onReject={() => confirmOpenRejectModal(item)}
      />
    ),
    [
      styles,
      resolvedScheme,
      t,
      selectedIds,
      openDetail,
      toggleSelect,
      confirmQuickApprove,
      confirmOpenRejectModal,
    ],
  );

  const keyExtractor = useCallback((item: EmployeeLeaveRow) => String(item.id), []);

  const listHeader = useMemo(() => {
    if (meta && meta.total > 0) {
      return (
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            {t('home.leaveRequests.totalCount', { count: meta.total })}
          </Text>
        </View>
      );
    }
    return null;
  }, [meta, styles, t]);

  const listEmpty = useMemo(() => {
    if (loading) {
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
          <Text style={styles.muted}>{t('home.leaveRequests.noCompany')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error}</Text>
          {!accessDenied ? (
            <Pressable
              accessibilityRole="button"
              style={styles.retryBtn}
              onPress={retry}>
              <Text style={styles.retryLabel}>{t('home.leaveRequests.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <Text style={styles.muted}>
          {debouncedSearch || statusFilter || fromDate || toDate
            ? t('home.leaveRequests.emptyFiltered')
            : t('home.leaveRequests.empty')}
        </Text>
      </View>
    );
  }, [
    loading,
    companyId,
    error,
    accessDenied,
    debouncedSearch,
    statusFilter,
    fromDate,
    toDate,
    styles,
    t,
    retry,
  ]);

  const listFooter = useMemo(() => {
    if (!meta || meta.total_pages <= 1) {
      return null;
    }
    return (
      <View style={styles.paginationRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.leaveRequests.prevPage')}
          disabled={!canGoPrev}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          style={[styles.paginationBtn, !canGoPrev && styles.paginationBtnDisabled]}>
          <Text style={styles.paginationBtnText}>{t('home.leaveRequests.prevPage')}</Text>
        </Pressable>
        <Text style={styles.paginationInfo}>
          {t('home.leaveRequests.pageInfo', {
            page: meta.page,
            total: meta.total_pages,
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.leaveRequests.nextPage')}
          disabled={!canGoNext}
          onPress={() => setPage(p => p + 1)}
          style={[styles.paginationBtn, !canGoNext && styles.paginationBtnDisabled]}>
          <Text style={styles.paginationBtnText}>{t('home.leaveRequests.nextPage')}</Text>
        </Pressable>
      </View>
    );
  }, [meta, canGoPrev, canGoNext, styles, t]);

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.leaveRequests.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header">
          {t('home.leaveRequests.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.leaveRequests.createLeave')}
          onPress={openCreateModal}
          style={({ pressed }) => [
            styles.headerCreateBtn,
            pressed && styles.headerCreateBtnPressed,
          ]}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.filtersWrap}>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.leaveRequests.searchPlaceholder')}
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

        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDateRangePickerVisible(true)}
            style={({ pressed }) => [
              styles.filterChip,
              fromDate != null && toDate != null && styles.filterChipActive,
              pressed && { opacity: 0.92 },
            ]}>
            <MaterialCommunityIcons
              name="calendar-range"
              size={18}
              color={
                fromDate != null && toDate != null ? colors.primary : colors.textMuted
              }
            />
            <Text
              style={[
                styles.filterChipText,
                fromDate != null && toDate != null && styles.filterChipTextActive,
              ]}
              numberOfLines={1}>
              {dateRangeLabel}
            </Text>
          </Pressable>
          {hasDateRange ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.leaveRequests.clearDate')}
              onPress={clearDateRange}
              style={styles.clearBtn}>
              <MaterialCommunityIcons
                name="calendar-remove"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipScrollContent}>
          {STATUS_FILTERS.map(status => {
            const active = statusFilter === status;
            return (
              <Pressable
                key={status ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setStatusFilter(status)}
                style={[styles.statusChip, active && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                  {statusLabel(status)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={loading && leaves.length === 0 ? [] : leaves}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={listContentStyle}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {loading && leaves.length > 0 ? (
        <ActivityIndicator style={styles.loadingOverlay} color={colors.primary} />
      ) : null}

      <DateRangePicker
        visible={dateRangePickerVisible}
        fromDate={fromDate}
        toDate={toDate}
        title={t('home.leaveRequests.dateRange')}
        locale={i18n.language}
        onDismiss={() => setDateRangePickerVisible(false)}
        onConfirm={handleDateRangeConfirm}
        onClear={handleDateRangeClear}
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
            {t('home.leaveRequests.actions.selectedCount', { count: selectedIds.size })}
          </Text>
          {statusFilter === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmOpenBulkModal('all')}
              style={({ pressed }) => [
                styles.floatingBtn,
                styles.floatingBtnSecondary,
                pressed && { opacity: 0.9 },
              ]}>
              <Text style={[styles.floatingBtnLabel, styles.floatingBtnLabelSecondary]}>
                {t('home.leaveRequests.actions.bulkAllPending')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => confirmOpenBulkModal('selected')}
            style={({ pressed }) => [styles.floatingBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.floatingBtnLabel}>
              {t('home.leaveRequests.actions.bulkAction')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <EmpLeaveDetailModal
        visible={detailLeave != null}
        leave={detailLeave}
        onDismiss={closeDetail}
        actionSubmitting={actionSubmitting}
        onEdit={
          detailLeave?.status === 'pending'
            ? () => openApproveModal(detailLeave)
            : undefined
        }
        onApprove={
          detailLeave?.status === 'pending'
            ? () => confirmQuickApprove(detailLeave)
            : undefined
        }
        onReject={
          detailLeave?.status === 'pending'
            ? () => confirmOpenRejectModal(detailLeave)
            : undefined
        }
      />

      <ApproveLeaveModal
        visible={approveVisible}
        leave={actionLeave}
        submitting={actionSubmitting}
        locale={i18n.language}
        onDismiss={() => {
          if (!actionSubmitting) {
            setApproveVisible(false);
            setActionLeave(null);
          }
        }}
        onSubmit={confirmApproveSubmit}
      />

      <RejectLeaveModal
        visible={rejectVisible}
        leave={actionLeave}
        submitting={actionSubmitting}
        onDismiss={() => {
          if (!actionSubmitting) {
            setRejectVisible(false);
            setActionLeave(null);
          }
        }}
        onSubmit={remarks => {
          if (actionLeave) {
            confirmRejectSubmit(actionLeave, remarks);
          }
        }}
      />

      <BulkLeaveActionModal
        visible={bulkVisible}
        target={bulkTarget}
        submitting={actionSubmitting}
        onDismiss={() => {
          if (!actionSubmitting) {
            setBulkVisible(false);
          }
        }}
        onSubmit={confirmBulkSubmit}
      />

      <CreateManagementLeaveModal
        visible={createModalVisible}
        companyId={companyId}
        leaveConfigs={leaveConfigs}
        loadingConfigs={loadingConfigs}
        submitting={createSubmitting}
        locale={i18n.language}
        onDismiss={() => {
          if (!createSubmitting) {
            setCreateModalVisible(false);
          }
        }}
        onSubmit={handleCreateSubmit}
      />

      <ConfirmAlert {...confirmProps} />
      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
