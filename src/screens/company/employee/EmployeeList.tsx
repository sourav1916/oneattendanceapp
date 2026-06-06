import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { formatTime12h, TimePicker, useTimePicker } from '@src/components/modals/TimePicker';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmployeeManagement } from '@src/hooks/useEmployeeManagement';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  ConstantOption,
  EmployeeEditFormData,
  EmployeeListItem,
  EmployeeListMeta,
  ModalType,
  PermissionPackage,
} from '@src/types/employeeManagement';
import { API_ENDPOINT } from '@src/utils/config';

type Props = NativeStackScreenProps<HomeStackParamList, 'EmployeeList'>;

const SKELETON_ROWS = 6;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;
const DROPDOWN_SHEET_MAX = Dimensions.get('window').height * 0.55;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function formatJoiningDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return iso.trim();
  }
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y!.slice(2)}`;
}

function resolveProfilePictureUrl(path: string | null): string | null {
  if (path == null || path.trim() === '') {
    return null;
  }
  const p = path.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function formatLabel(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (
    typeof value === 'object' &&
    'label' in (value as Record<string, unknown>)
  ) {
    const label = (value as { label?: string }).label;
    if (label) {
      return label;
    }
  }
  const str = typeof value === 'string' ? value : String(value);
  if (!str) {
    return '';
  }
  return str
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatLabelValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (
    typeof value === 'object' &&
    'value' in (value as Record<string, unknown>)
  ) {
    return (value as { value?: string }).value ?? '';
  }
  return typeof value === 'string' ? value : String(value);
}

function formatShiftSpan(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) {
    return null;
  }
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

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

function formatStatCount(
  value: number | undefined,
): { text: string; isDash: boolean } {
  if (value === undefined || !Number.isFinite(value)) {
    return { text: '—', isDash: true };
  }
  return { text: String(value), isDash: false };
}

function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) {
    return '—';
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseDurationToMinutes(hhMm: string): number {
  const parts = hhMm.split(':');
  const h = parseInt(parts[0] ?? '0', 10) || 0;
  const m = parseInt(parts[1] ?? '0', 10) || 0;
  return h * 60 + m;
}

function buildFormDataFromEmployee(emp: EmployeeListItem): EmployeeEditFormData {
  return {
    designation: formatLabelValue(emp.designation),
    employment_type: formatLabelValue(emp.employment_type),
    salary_type: formatLabelValue(emp.salary_type),
    permission_package_id: emp.permission_package_id ?? null,
    attendance_methods: emp.attendance_methods.map(m => m.method),
    auto_approve: emp.attendance_methods.some(m => m.is_auto),
    shift_start: emp.shift_start ?? '09:00',
    shift_end: emp.shift_end ?? '18:00',
    break_minutes: formatDuration(emp.break_minutes),
    grace_minutes: formatDuration(emp.grace_minutes),
    weekends: emp.weekends
      .map(w => (typeof w.day === 'string' ? w.day.toLowerCase() : ''))
      .filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
      minHeight: 52,
      maxHeight: 52,
    },
    stackHeaderTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 2,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      fontSize: 16,
      color: colors.text,
    },
    clearBtn: { padding: 6 },

    // Stats row
    statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statCard: {
      flex: 1,
      minWidth: 0,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: scheme === 'dark' ? 0.25 : 0.07,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    statCardTotal: {
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.18)' : '#eff6ff',
      borderColor: scheme === 'dark' ? 'rgba(96,165,250,0.45)' : '#bfdbfe',
    },
    statCardActive: {
      backgroundColor: scheme === 'dark' ? 'rgba(34,197,94,0.14)' : '#f0fdf4',
      borderColor: scheme === 'dark' ? 'rgba(74,222,128,0.4)' : '#bbf7d0',
    },
    statCardInactive: {
      backgroundColor: scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textAlign: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
      minHeight: 26,
      textAlign: 'center',
    },
    statValueTotal: { color: colors.primary },
    statValueActive: { color: scheme === 'dark' ? '#4ade80' : '#15803d' },
    statValueInactive: { color: scheme === 'dark' ? '#fbbf24' : '#b45309' },
    statValueDash: { color: colors.textMuted, fontWeight: '600' },
    statValueSkelWrap: {
      minHeight: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statSkelBar: {
      height: 22,
      width: 36,
      borderRadius: 6,
      backgroundColor:
        scheme === 'dark'
          ? 'rgba(255,255,255,0.14)'
          : 'rgba(15,23,42,0.1)',
    },

    // Center states
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    muted: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    error: {
      fontSize: 15,
      color: colors.danger,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '600', fontSize: 16 },

    // Employee card (list view)
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: scheme === 'dark' ? 0.2 : 0.06,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondaryButton,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarInitials: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    cardMain: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    subline: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    sublineMuted: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'capitalize',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      alignItems: 'center',
    },
    metaLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    metaMuted: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
    shiftLine: { marginTop: 8, fontSize: 13, color: colors.textMuted },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
      gap: 6,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtnDanger: {
      backgroundColor: scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      borderColor: scheme === 'dark' ? 'rgba(248,113,113,0.3)' : '#fecaca',
    },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
    actionBtnTextDanger: { color: colors.danger },

    // Footer
    footerBox: { paddingVertical: 16, alignItems: 'center' },

    // Skeleton
    skCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    skRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    skCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
    },
    skBar: {
      height: 14,
      borderRadius: 7,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
      marginBottom: 8,
    },
    skBarShort: {
      height: 12,
      borderRadius: 6,
      width: '55%',
      backgroundColor: scheme === 'dark' ? '#1e293b' : colors.border,
    },
    skMeta: {
      marginTop: 12,
      height: 12,
      borderRadius: 6,
      width: '70%',
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
    },

    // Bottom sheet modal styles
    modalSafe: { flex: 1, backgroundColor: colors.overlay },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SHEET_MAX_HEIGHT,
      flexDirection: 'column',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 12 },
      }),
    },
    sheetForm: { height: SHEET_MAX_HEIGHT },
    sheetScroll: { flex: 1, minHeight: 0 },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sheetCloseBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.secondaryButton,
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    sheetFooter: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 24 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    sheetFooterBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryButton,
    },
    sheetFooterBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sheetFooterBtnDisabled: { opacity: 0.55 },
    sheetFooterBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    sheetFooterBtnTextPrimary: { color: '#fff', fontWeight: '700' },

    // View modal
    viewHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      marginBottom: 16,
      borderRadius: 16,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.14)' : '#eff6ff',
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
    },
    viewSection: { marginBottom: 14 },
    viewSectionCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
      overflow: 'hidden',
    },
    viewSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    viewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    viewRowLast: { borderBottomWidth: 0, paddingBottom: 12 },
    viewLabel: { fontSize: 14, color: colors.textMuted, flex: 1 },
    viewValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1.2,
      textAlign: 'right',
    },
    viewProfileName: { fontSize: 18, fontWeight: '700', color: colors.text },
    viewProfileDesignation: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.18)' : '#eff6ff',
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.4)' : '#bfdbfe',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: scheme === 'dark' ? '#93c5fd' : colors.primary,
    },

    // Edit form
    formSectionCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 14,
    },
    formSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    formGroup: { marginBottom: 14 },
    formGroupLast: { marginBottom: 0 },
    formLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    dropdownText: { flex: 1, fontSize: 15, color: colors.text },
    dropdownPlaceholder: { color: colors.textMuted },
    methodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    methodChipActive: {
      borderColor: colors.primary,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    },
    methodChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    methodChipTextActive: { color: colors.primary },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    switchLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
    timeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    timeField: { flex: 1 },
    timeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    timeBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    durationInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    formError: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 4,
      fontWeight: '500',
    },
    optionsLoadingText: {
      marginTop: 12,
      textAlign: 'center',
    },
    statusPillMarginTop: {
      marginTop: 6,
    },
    chipWrapMarginTop: {
      marginTop: 8,
    },
    skBarWide: {
      width: '62%',
    },

    // Dropdown modal
    dropdownModalSafe: { flex: 1, backgroundColor: colors.overlay },
    dropdownSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: DROPDOWN_SHEET_MAX,
      height: DROPDOWN_SHEET_MAX,
      flexDirection: 'column',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 12 },
      }),
    },
    dropdownList: { flex: 1, minHeight: 0 },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownOptionActive: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    dropdownOptionText: { flex: 1, fontSize: 16, color: colors.text },
    dropdownOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    dropdownCheck: { marginLeft: 8 },
  });
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------
function EmployeeStatsSkeleton({
  styles,
  t,
}: {
  styles: ReturnType<typeof buildStyles>;
  t: TFunction;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.38,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);
  const items = [
    { key: 'total' as const, card: styles.statCardTotal },
    { key: 'active' as const, card: styles.statCardActive },
    { key: 'inactive' as const, card: styles.statCardInactive },
  ];
  return (
    <View style={styles.statRow}>
      {items.map(({ key, card }) => (
        <View key={key} style={[styles.statCard, card]}>
          <Text style={styles.statLabel}>
            {t(`home.employeeList.stats.${key}`)}
          </Text>
          <View style={styles.statValueSkelWrap}>
            <Animated.View style={{ opacity: pulse }}>
              <View style={styles.statSkelBar} />
            </Animated.View>
          </View>
        </View>
      ))}
    </View>
  );
}

function EmployeeStatsRow({
  meta,
  styles,
  t,
}: {
  meta: EmployeeListMeta;
  styles: ReturnType<typeof buildStyles>;
  t: TFunction;
}) {
  const active = formatStatCount(meta.active);
  const inactive = formatStatCount(meta.inactive);
  return (
    <View style={styles.statRow}>
      <View
        style={[styles.statCard, styles.statCardTotal]}
        accessibilityLabel={`${t('home.employeeList.stats.total')}: ${meta.total}`}>
        <Text style={styles.statLabel}>
          {t('home.employeeList.stats.total')}
        </Text>
        <Text style={[styles.statValue, styles.statValueTotal]}>
          {String(meta.total)}
        </Text>
      </View>
      <View
        style={[styles.statCard, styles.statCardActive]}
        accessibilityLabel={`${t('home.employeeList.stats.active')}: ${active.text}`}>
        <Text style={styles.statLabel}>
          {t('home.employeeList.stats.active')}
        </Text>
        <Text
          style={[
            styles.statValue,
            styles.statValueActive,
            active.isDash && styles.statValueDash,
          ]}>
          {active.text}
        </Text>
      </View>
      <View
        style={[styles.statCard, styles.statCardInactive]}
        accessibilityLabel={`${t('home.employeeList.stats.inactive')}: ${inactive.text}`}>
        <Text style={styles.statLabel}>
          {t('home.employeeList.stats.inactive')}
        </Text>
        <Text
          style={[
            styles.statValue,
            styles.statValueInactive,
            inactive.isDash && styles.statValueDash,
          ]}>
          {inactive.text}
        </Text>
      </View>
    </View>
  );
}

function EmployeeListSkeleton({
  styles,
  count = SKELETON_ROWS,
}: {
  styles: ReturnType<typeof buildStyles>;
  count?: number;
}) {
  const pulse = useRef(new Animated.Value(0.38)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
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
    <Animated.View style={{ opacity: pulse }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skCard}>
          <View style={styles.skRow}>
            <View style={styles.skCircle} />
            <View style={styles.fill}>
              <View style={[styles.skBar, styles.skBarWide]} />
              <View style={[styles.skBar, styles.skBarShort]} />
            </View>
          </View>
          <View style={styles.skMeta} />
        </View>
      ))}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// AvatarView
// ---------------------------------------------------------------------------
function AvatarView({
  uri,
  name,
  size,
  styles,
}: {
  uri: string | null;
  name: string;
  size: number;
  styles: ReturnType<typeof buildStyles>;
}) {
  const avatarStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, avatarStyle]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder, avatarStyle]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DropdownPicker modal
// ---------------------------------------------------------------------------
type DropdownPickerProps = {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
};

function DropdownPicker({
  visible,
  title,
  options,
  selected,
  onSelect,
  onDismiss,
  styles,
  colors,
}: DropdownPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView
        style={styles.dropdownModalSafe}
        edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.dropdownSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button">
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <FlatList
              style={styles.dropdownList}
              data={options}
              keyExtractor={item => item.value}
              bounces={false}
              renderItem={({ item }) => {
                const active = item.value === selected;
                return (
                  <Pressable
                    style={[
                      styles.dropdownOption,
                      active && styles.dropdownOptionActive,
                    ]}
                    onPress={() => {
                      onSelect(item.value);
                      onDismiss();
                    }}>
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        active && styles.dropdownOptionTextActive,
                      ]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={colors.primary}
                        style={styles.dropdownCheck}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ViewDetailsModal
// ---------------------------------------------------------------------------
type ViewDetailsModalProps = {
  visible: boolean;
  employee: EmployeeListItem | null;
  onDismiss: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

function ViewDetailsModal({
  visible,
  employee,
  onDismiss,
  styles,
  colors,
  t,
}: ViewDetailsModalProps) {
  if (!employee) {
    return null;
  }
  const uri = resolveProfilePictureUrl(employee.profile_picture);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView
        style={styles.modalSafe}
        edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.sheet, styles.sheetForm]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t('home.employeeList.viewModal.title')}
              </Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel={t('home.employeeList.viewModal.close')}>
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetBody}
              bounces={false}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              <View style={styles.viewHero}>
                <AvatarView
                  uri={uri}
                  name={employee.name}
                  size={56}
                  styles={styles}
                />
                <View style={styles.cardMain}>
                  <Text style={styles.viewProfileName}>
                    {employee.name}
                  </Text>
                  <Text style={styles.viewProfileDesignation}>
                    {formatLabel(employee.designation)}
                  </Text>
                  <View style={[styles.statusPill, styles.statusPillMarginTop]}>
                    <Text style={styles.statusPillText}>
                      {formatLabel(employee.status)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>
                  {t('home.employeeList.viewModal.infoSection')}
                </Text>
                <View style={styles.viewSectionCard}>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.code')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.employee_code || '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.email')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.email || '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.phone')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.phone || '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.employmentType')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {formatLabel(employee.employment_type) || '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.salaryType')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {formatLabel(employee.salary_type) || '—'}
                    </Text>
                  </View>
                  <View style={[styles.viewRow, styles.viewRowLast]}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.joiningDate')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.joining_date
                        ? formatJoiningDate(employee.joining_date)
                        : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>
                  {t('home.employeeList.viewModal.scheduleSection')}
                </Text>
                <View style={styles.viewSectionCard}>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.shiftStart')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.shift_start
                        ? formatTime12h(employee.shift_start)
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.shiftEnd')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.shift_end
                        ? formatTime12h(employee.shift_end)
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.breakMinutes')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {formatDuration(employee.break_minutes)}
                    </Text>
                  </View>
                  <View style={[styles.viewRow, styles.viewRowLast]}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.graceMinutes')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {formatDuration(employee.grace_minutes)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>
                  {t('home.employeeList.viewModal.securitySection')}
                </Text>
                <View style={styles.viewSectionCard}>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.permissionPackage')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.package_name || '—'}
                    </Text>
                  </View>
                  <View style={[styles.viewRow, styles.viewRowLast]}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.permissions')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {t('home.employeeList.viewModal.permissionCount', {
                        count: employee.permissions.length,
                      })}
                    </Text>
                  </View>
                  {employee.permissions.length > 0 ? (
                    <View style={[styles.chipWrap, styles.chipWrapMarginTop]}>
                      {employee.permissions.map((p, index) => (
                        <View key={`${p.permission_id}-${index}`} style={styles.chip}>
                          <Text style={styles.chipText}>{p.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>
                  {t('home.employeeList.viewModal.attendanceSection')}
                </Text>
                <View style={styles.viewSectionCard}>
                  <View style={[styles.viewRow, styles.viewRowLast]}>
                    <Text style={styles.viewLabel}>
                      {t('home.employeeList.viewModal.autoApprove')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {employee.attendance_methods.some(m => m.is_auto)
                        ? t('home.employeeList.viewModal.yes')
                        : t('home.employeeList.viewModal.no')}
                    </Text>
                  </View>
                  {employee.attendance_methods.length > 0 ? (
                    <View style={[styles.chipWrap, styles.chipWrapMarginTop]}>
                      {employee.attendance_methods.map((m, index) => (
                        <View key={`${m.id}-${index}`} style={styles.chip}>
                          <Text style={styles.chipText}>
                            {formatLabel(m.method)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.viewSection}>
                <Text style={styles.viewSectionTitle}>
                  {t('home.employeeList.viewModal.weekendsSection')}
                </Text>
                <View style={styles.viewSectionCard}>
                  {employee.weekends.length > 0 ? (
                    <View style={styles.chipWrap}>
                      {employee.weekends.map((w, index) => {
                        const dayValue =
                          typeof w.day === 'string' ? w.day.toLowerCase() : '';
                        return (
                          <View key={`${w.day ?? 'weekend'}-${index}`} style={styles.chip}>
                            <Text style={styles.chipText}>
                              {dayValue
                                ? t(
                                  `home.employeeList.days.${dayValue}` as never,
                                ) || formatLabel(w.day)
                                : '—'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.muted}>—</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EditEmployeeModal
// ---------------------------------------------------------------------------
type EditEmployeeModalProps = {
  visible: boolean;
  employee: EmployeeListItem | null;
  constants: {
    designations: ConstantOption[];
    employment_types: ConstantOption[];
    salary_types: ConstantOption[];
    attendance_methods: { id: string; name: string; available: boolean }[];
  } | null;
  permissionPackages: PermissionPackage[];
  onSave: (data: EmployeeEditFormData) => void;
  onDismiss: () => void;
  saving: boolean;
  optionsLoading: boolean;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

function EditEmployeeModal({
  visible,
  employee,
  constants,
  permissionPackages,
  onSave,
  onDismiss,
  saving,
  optionsLoading,
  styles,
  colors,
  t,
}: EditEmployeeModalProps) {
  const [form, setForm] = useState<EmployeeEditFormData | null>(null);
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const shiftStartPicker = useTimePicker({
    initialValue: form?.shift_start ?? '09:00',
    onConfirm: (time: string) =>
      setForm(f => (f ? { ...f, shift_start: time } : f)),
  });
  const shiftEndPicker = useTimePicker({
    initialValue: form?.shift_end ?? '18:00',
    onConfirm: (time: string) =>
      setForm(f => (f ? { ...f, shift_end: time } : f)),
  });

  useEffect(() => {
    if (visible && employee) {
      const data = buildFormDataFromEmployee(employee);
      setForm(data);
      shiftStartPicker.setValue(data.shift_start);
      shiftEndPicker.setValue(data.shift_end);
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, employee]);

  const handleSave = useCallback(() => {
    if (!form) {
      return;
    }
    if (form.attendance_methods.length === 0) {
      setFormError(
        t('home.employeeList.editModal.errors.attendanceRequired'),
      );
      return;
    }
    setFormError(null);
    onSave(form);
  }, [form, onSave, t]);

  const toggleMethod = useCallback((method: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const methods = f.attendance_methods.includes(method)
        ? f.attendance_methods.filter(m => m !== method)
        : [...f.attendance_methods, method];
      return { ...f, attendance_methods: methods };
    });
    setFormError(null);
  }, []);

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const weekends = f.weekends.includes(day)
        ? f.weekends.filter(d => d !== day)
        : [...f.weekends, day];
      return { ...f, weekends };
    });
  }, []);

  const dropdownOptions = useMemo(() => {
    if (!constants) {
      return [];
    }
    switch (dropdownField) {
      case 'designation':
        return constants.designations;
      case 'employment_type':
        return constants.employment_types;
      case 'salary_type':
        return constants.salary_types;
      case 'permission_package':
        return permissionPackages.map(p => ({
          value: String(p.id),
          label: p.name,
        }));
      default:
        return [];
    }
  }, [constants, dropdownField, permissionPackages]);

  const dropdownTitle = useMemo(() => {
    switch (dropdownField) {
      case 'designation':
        return t('home.employeeList.editModal.designation');
      case 'employment_type':
        return t('home.employeeList.editModal.employmentType');
      case 'salary_type':
        return t('home.employeeList.editModal.salaryType');
      case 'permission_package':
        return t('home.employeeList.editModal.permissionPackage');
      default:
        return '';
    }
  }, [dropdownField, t]);

  const dropdownSelected = useMemo(() => {
    if (!form) {
      return '';
    }
    switch (dropdownField) {
      case 'designation':
        return form.designation;
      case 'employment_type':
        return form.employment_type;
      case 'salary_type':
        return form.salary_type;
      case 'permission_package':
        return form.permission_package_id != null
          ? String(form.permission_package_id)
          : '';
      default:
        return '';
    }
  }, [form, dropdownField]);

  const handleDropdownSelect = useCallback(
    (value: string) => {
      setForm(f => {
        if (!f) {
          return f;
        }
        switch (dropdownField) {
          case 'designation':
            return { ...f, designation: value };
          case 'employment_type':
            return { ...f, employment_type: value };
          case 'salary_type':
            return { ...f, salary_type: value };
          case 'permission_package':
            return {
              ...f,
              permission_package_id: parseInt(value, 10) || null,
            };
          default:
            return f;
        }
      });
    },
    [dropdownField],
  );

  const getDropdownDisplayText = useCallback(
    (field: string): string => {
      if (!form || !constants) {
        return '';
      }
      let options: { value: string; label: string }[] = [];
      let currentVal = '';
      switch (field) {
        case 'designation':
          options = constants.designations;
          currentVal = form.designation;
          break;
        case 'employment_type':
          options = constants.employment_types;
          currentVal = form.employment_type;
          break;
        case 'salary_type':
          options = constants.salary_types;
          currentVal = form.salary_type;
          break;
        case 'permission_package':
          options = permissionPackages.map(p => ({
            value: String(p.id),
            label: p.name,
          }));
          currentVal =
            form.permission_package_id != null
              ? String(form.permission_package_id)
              : '';
          break;
      }
      const found = options.find(o => o.value === currentVal);
      return found?.label ?? (currentVal ? formatLabel(currentVal) : '');
    },
    [form, constants, permissionPackages],
  );

  if (!form) {
    return null;
  }

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onDismiss}>
        <SafeAreaView
          style={styles.modalSafe}
          edges={TAB_SCREEN_SAFE_AREA_EDGES}>
          <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={[styles.sheet, styles.sheetForm]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {t('home.employeeList.editModal.title')}
                </Text>
                <Pressable
                  style={styles.sheetCloseBtn}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.employeeList.editModal.close')}>
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetBody}
                bounces={false}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {optionsLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.muted, styles.optionsLoadingText]}>
                      {t('home.employeeList.editModal.loadingOptions')}
                    </Text>
                  </View>
                ) : null}
                {!optionsLoading && constants ? (
                  <>
                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.infoSection')}
                      </Text>
                      {/* Designation */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.designation')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('designation')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('designation') &&
                              styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('designation') ||
                              t('home.employeeList.editModal.selectDesignation')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      {/* Permission Package */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.permissionPackage')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('permission_package')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('permission_package') &&
                              styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('permission_package') ||
                              t('home.employeeList.editModal.selectPackage')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      {/* Employment Type */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.employmentType')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('employment_type')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('employment_type') &&
                              styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('employment_type') ||
                              t('home.employeeList.editModal.selectEmploymentType')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      {/* Salary Type */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.salaryType')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('salary_type')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('salary_type') &&
                              styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('salary_type') ||
                              t('home.employeeList.editModal.selectSalaryType')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.attendanceSection')}
                      </Text>
                      {/* Attendance Methods */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.attendanceMethods')}
                        </Text>
                        <View style={styles.methodChipWrap}>
                          {(constants?.attendance_methods ?? []).map(method => {
                            const active = form.attendance_methods.includes(
                              method.id,
                            );
                            return (
                              <Pressable
                                key={method.id}
                                style={[
                                  styles.methodChip,
                                  active && styles.methodChipActive,
                                ]}
                                onPress={() => toggleMethod(method.id)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}>
                                <Text
                                  style={[
                                    styles.methodChipText,
                                    active && styles.methodChipTextActive,
                                  ]}>
                                  {method.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {formError ? (
                          <Text style={styles.formError}>{formError}</Text>
                        ) : null}
                      </View>

                      {/* Auto Approve */}
                      <View style={[styles.formGroup, styles.switchRow]}>
                        <Text style={styles.switchLabel}>
                          {t('home.employeeList.editModal.autoApprove')}
                        </Text>
                        <Switch
                          value={form.auto_approve}
                          onValueChange={v =>
                            setForm(f => (f ? { ...f, auto_approve: v } : f))
                          }
                          trackColor={{
                            false: colors.border,
                            true: colors.primary,
                          }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.scheduleSection')}
                      </Text>
                      {/* Shift Times */}
                      <View style={styles.formGroup}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.shiftStart')}
                            </Text>
                            <Pressable
                              style={styles.timeBtn}
                              onPress={shiftStartPicker.present}>
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={18}
                                color={colors.primary}
                              />
                              <Text style={styles.timeBtnText}>
                                {formatTime12h(form.shift_start)}
                              </Text>
                            </Pressable>
                          </View>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.shiftEnd')}
                            </Text>
                            <Pressable
                              style={styles.timeBtn}
                              onPress={shiftEndPicker.present}>
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={18}
                                color={colors.primary}
                              />
                              <Text style={styles.timeBtnText}>
                                {formatTime12h(form.shift_end)}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      {/* Break / Grace */}
                      <View style={styles.formGroup}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.breakMinutes')}
                            </Text>
                            <TextInput
                              style={styles.durationInput}
                              value={form.break_minutes}
                              onChangeText={v =>
                                setForm(f => (f ? { ...f, break_minutes: v } : f))
                              }
                              placeholder="00:30"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.graceMinutes')}
                            </Text>
                            <TextInput
                              style={styles.durationInput}
                              value={form.grace_minutes}
                              onChangeText={v =>
                                setForm(f => (f ? { ...f, grace_minutes: v } : f))
                              }
                              placeholder="00:15"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.editModal.weekends')}
                      </Text>
                      {/* Weekends */}
                      <View style={[styles.formGroup, styles.formGroupLast]}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.weekends')}
                        </Text>
                        <View style={styles.methodChipWrap}>
                          {ALL_WEEKDAYS.map(day => {
                            const active = form.weekends.includes(day);
                            return (
                              <Pressable
                                key={day}
                                style={[
                                  styles.methodChip,
                                  active && styles.methodChipActive,
                                ]}
                                onPress={() => toggleWeekend(day)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}>
                                <Text
                                  style={[
                                    styles.methodChipText,
                                    active && styles.methodChipTextActive,
                                  ]}>
                                  {t(`home.employeeList.days.${day}` as never)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  </>
                ) : null}
              </ScrollView>

              {/* Footer */}
              <View style={styles.sheetFooter}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetFooterBtn,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={onDismiss}
                  accessibilityRole="button">
                  <Text style={styles.sheetFooterBtnText}>
                    {t('home.employeeList.editModal.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetFooterBtn,
                    styles.sheetFooterBtnPrimary,
                    (saving || optionsLoading || !constants) &&
                    styles.sheetFooterBtnDisabled,
                    pressed && !saving && { opacity: 0.88 },
                  ]}
                  onPress={handleSave}
                  disabled={saving || optionsLoading || !constants}
                  accessibilityRole="button">
                  <Text style={styles.sheetFooterBtnTextPrimary}>
                    {saving
                      ? t('home.employeeList.editModal.saving')
                      : t('home.employeeList.editModal.save')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Time pickers */}
      <TimePicker {...shiftStartPicker.pickerProps} />
      <TimePicker {...shiftEndPicker.pickerProps} />

      {/* Dropdown picker */}
      <DropdownPicker
        visible={dropdownField != null}
        title={dropdownTitle}
        options={dropdownOptions}
        selected={dropdownSelected}
        onSelect={handleDropdownSelect}
        onDismiss={() => setDropdownField(null)}
        styles={styles}
        colors={colors}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Employee Row (list view)
// ---------------------------------------------------------------------------
type RowProps = {
  item: EmployeeListItem;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  joinedLabel: string;
  onOpenProfile: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: TFunction;
};

const EmployeeRow = React.memo(function EmployeeRow({
  item,
  styles,
  colors,
  joinedLabel,
  onOpenProfile,
  onView,
  onEdit,
  onDelete,
  t,
}: RowProps) {
  const uri = resolveProfilePictureUrl(item.profile_picture);
  const shift = formatShiftSpan(item.shift_start, item.shift_end);

  return (
    <Pressable
      onPress={onOpenProfile}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} profile`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}>
      <View style={styles.cardTop}>
        <AvatarView uri={uri} name={item.name} size={48} styles={styles} />
        <View style={styles.cardMain}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.subline} numberOfLines={2}>
            {[item.employee_code, item.email].filter(Boolean).join(' · ')}
          </Text>
          {item.phone ? (
            <Text style={styles.sublineMuted} numberOfLines={1}>
              {item.phone}
            </Text>
          ) : null}
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {formatLabel(item.status)}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>
          {formatLabel(item.designation)}
        </Text>
        {item.package_name ? (
          <Text style={styles.metaMuted} numberOfLines={1}>
            {' · '}
            {item.package_name}
          </Text>
        ) : null}
      </View>
      <Text style={styles.shiftLine}>
        {formatLabel(item.employment_type)}
        {shift ? ` · ${shift}` : ''}
        {item.joining_date
          ? ` · ${joinedLabel}: ${formatJoiningDate(item.joining_date)}`
          : ''}
      </Text>
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={t('home.employeeList.actions.viewDetails')}>
          <MaterialCommunityIcons
            name="eye-outline"
            size={15}
            color={colors.primary}
          />
          <Text style={styles.actionBtnText}>
            {t('home.employeeList.actions.viewDetails')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('home.employeeList.actions.edit')}>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={15}
            color={colors.primary}
          />
          <Text style={styles.actionBtnText}>
            {t('home.employeeList.actions.edit')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnDanger,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t('home.employeeList.actions.delete')}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={15}
            color={colors.danger}
          />
          <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
            {t('home.employeeList.actions.delete')}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function EmployeeListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;

  const {
    props: statusProps,
    presentSuccess,
    presentError,
  } = useStatusAlert();
  const { props: confirmProps, present: presentConfirm } = useConfirmAlert();

  const [modalType, setModalType] = useState<ModalType>('NONE');
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeListItem | null>(null);

  const {
    employees,
    meta,
    constants,
    permissionPackages,
    formOptionsLoading,
    loadFormOptions,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    loadMore,
    retry,
    updateEmployee,
    deleteEmployee,
    mutating,
  } = useEmployeeManagement({
    companyId,
    onError: useCallback(
      (msg: string) =>
        presentError({
          title: t('home.employeeList.apiError'),
          message: msg,
        }),
      [presentError, t],
    ),
    onSuccess: useCallback(
      (msg: string) =>
        presentSuccess({
          title: t('home.employeeList.editModal.successTitle'),
          message: msg,
        }),
      [presentSuccess, t],
    ),
  });

  // Actions
  const openView = useCallback((emp: EmployeeListItem) => {
    setSelectedEmployee(emp);
    setModalType('VIEW');
  }, []);

  const openProfile = useCallback(
    (emp: EmployeeListItem) => {
      navigation.navigate('EmployeeProfile', { employeeId: emp.id });
    },
    [navigation],
  );

  const openEdit = useCallback(
    (emp: EmployeeListItem) => {
      setSelectedEmployee(emp);
      setModalType('EDIT');
      loadFormOptions(true).catch(() => { });
    },
    [loadFormOptions],
  );

  const openDelete = useCallback(
    (emp: EmployeeListItem) => {
      presentConfirm({
        title: t('home.employeeList.deleteModal.title'),
        message: t('home.employeeList.deleteModal.message', {
          name: emp.name,
        }),
        buttons: [
          {
            text: t('home.employeeList.deleteModal.cancel'),
            variant: 'secondary',
          },
          {
            text: t('home.employeeList.deleteModal.confirm'),
            variant: 'danger',
            closeOnPress: false,
            onPress: () => {
              deleteEmployee(emp.id).then(ok => {
                if (ok) {
                  presentSuccess({
                    title: t('home.employeeList.deleteModal.successTitle'),
                    message: t(
                      'home.employeeList.deleteModal.successMessage',
                      { name: emp.name },
                    ),
                  });
                }
              }).catch(() => { });
            },
          },
        ],
      });
    },
    [deleteEmployee, presentConfirm, presentSuccess, t],
  );

  const closeModal = useCallback(() => {
    setModalType('NONE');
    setSelectedEmployee(null);
  }, []);

  const handleEditSave = useCallback(
    async (form: EmployeeEditFormData) => {
      if (!selectedEmployee) {
        return;
      }
      const ok = await updateEmployee({
        employee_id: selectedEmployee.id,
        designation: form.designation,
        employment_type: form.employment_type,
        salary_type: form.salary_type,
        permission_package_id: form.permission_package_id ?? undefined,
        attendance_methods: form.attendance_methods,
        auto_approve: form.auto_approve,
        shift_start: form.shift_start,
        shift_end: form.shift_end,
        break_minutes: parseDurationToMinutes(form.break_minutes),
        grace_minutes: parseDurationToMinutes(form.grace_minutes),
        weekends: form.weekends,
      });
      if (ok) {
        closeModal();
      }
    },
    [selectedEmployee, updateEmployee, closeModal],
  );

  // List view render
  const renderListItem = useCallback(
    ({ item }: { item: EmployeeListItem }) => (
      <EmployeeRow
        item={item}
        styles={styles}
        colors={colors}
        joinedLabel={t('home.employeeList.joined')}
        onOpenProfile={() => openProfile(item)}
        onView={() => openView(item)}
        onEdit={() => openEdit(item)}
        onDelete={() => openDelete(item)}
        t={t}
      />
    ),
    [styles, colors, t, openProfile, openView, openEdit, openDelete],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.textMuted}
            style={styles.searchIcon}
            accessibilityElementsHidden
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.employeeList.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => setSearch('')}
              accessibilityRole="button">
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        {loading ? (
          <EmployeeStatsSkeleton styles={styles} t={t} />
        ) : meta ? (
          <EmployeeStatsRow meta={meta} styles={styles} t={t} />
        ) : null}
        {loading ? <EmployeeListSkeleton styles={styles} /> : null}
      </View>
    ),
    [colors.textMuted, loading, meta, search, setSearch, styles, t],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerBox}>
          <EmployeeListSkeleton styles={styles} count={3} />
        </View>
      );
    }
    return null;
  }, [loadingMore, styles]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return null;
    }
    if (employees.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{t('home.employeeList.empty')}</Text>
        </View>
      );
    }
    return null;
  }, [employees.length, loading, styles, t]);

  const onEndReached = useCallback(() => {
    loadMore();
  }, [loadMore]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // No company
  if (companyId == null) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.employeeList.back')}
          />
          <Text
            style={styles.stackHeaderTitle}
            numberOfLines={1}
            accessibilityRole="header">
            {t('home.employeeList.title')}
          </Text>
        </View>
        <View style={[styles.centerBox, styles.fill]}>
          <Text style={styles.muted}>
            {t('home.employeeList.noCompany')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && employees.length === 0 && !loading) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.employeeList.back')}
          />
          <Text
            style={styles.stackHeaderTitle}
            numberOfLines={1}
            accessibilityRole="header">
            {t('home.employeeList.title')}
          </Text>
        </View>
        <View style={[styles.centerBox, styles.fill]}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => retry()}
            style={({ pressed }) => [
              styles.retryBtn,
              pressed && { opacity: 0.9 },
            ]}>
            <Text style={styles.retryLabel}>
              {t('home.employeeList.retry')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.employeeList.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header">
          {t('home.employeeList.title')}
        </Text>
      </View>

      <FlatList
        style={styles.fill}
        data={loading ? [] : employees}
        keyExtractor={item => String(item.id)}
        renderItem={renderListItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />

      {/* View Details Modal */}
      <ViewDetailsModal
        visible={modalType === 'VIEW'}
        employee={selectedEmployee}
        onDismiss={closeModal}
        styles={styles}
        colors={colors}
        t={t}
      />

      {/* Edit Employee Modal */}
      <EditEmployeeModal
        visible={modalType === 'EDIT'}
        employee={selectedEmployee}
        constants={constants}
        permissionPackages={permissionPackages}
        onSave={handleEditSave}
        onDismiss={closeModal}
        saving={mutating}
        optionsLoading={formOptionsLoading}
        styles={styles}
        colors={colors}
        t={t}
      />

      {/* Alerts */}
      <StatusAlert {...statusProps} />
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
