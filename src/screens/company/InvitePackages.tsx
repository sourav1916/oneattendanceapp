import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import {
  formatTime12h,
  TimePicker,
  useTimePicker,
} from '@src/components/modals/TimePicker';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useInvitePackages } from '@src/hooks/useInvitePackages';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { PermissionPackage } from '@src/types/employeeManagement';
import type {
  InvitePackageFormData,
  InvitePackageItem,
} from '@src/types/invitePackage';
import { buildInvitePackageCreatePayload } from '@src/utils/invitePackagePayload';
import type { InvitePackageFormConstants } from '@src/utils/mapGlobalConstants';

type Props = NativeStackScreenProps<HomeStackParamList, 'InvitePackages'>;

type ModalType = 'NONE' | 'VIEW' | 'CREATE' | 'EDIT';

const SKELETON_ROWS = 6;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const EMPTY_FORM: InvitePackageFormData = {
  code: '',
  name: '',
  designation: '',
  employment_type: '',
  salary_type: '',
  permission_package_id: null,
  shift_start: '09:00',
  shift_end: '18:00',
  break_minutes: '00:30',
  grace_minutes: '00:15',
  weekends: [],
  attendance_methods: [],
  auto_approve: false,
  remarks: '',
};

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

function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) {
    return '—';
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}


function stripSeconds(hhmmss: string | null, fallback: string): string {
  if (!hhmmss) {
    return fallback;
  }
  const m = hhmmss.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1]! : fallback;
}

function buildFormDataFromPackage(pkg: InvitePackageItem): InvitePackageFormData {
  return {
    code: pkg.code,
    name: pkg.name,
    designation: pkg.designation?.value ?? '',
    employment_type: pkg.employment_type?.value ?? '',
    salary_type: pkg.salary_type?.value ?? '',
    permission_package_id: pkg.permission_package_id,
    shift_start: stripSeconds(pkg.shift_start, '09:00'),
    shift_end: stripSeconds(pkg.shift_end, '18:00'),
    break_minutes: formatDuration(pkg.break_minutes),
    grace_minutes: formatDuration(pkg.grace_minutes),
    weekends: (pkg.weekends ?? []).map(w => w.toLowerCase()),
    attendance_methods: [...(pkg.attendance_methods ?? [])],
    auto_approve: pkg.auto_approve,
    remarks: pkg.remarks ?? '',
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    createBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
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

    // Package card (list view)
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
    },
    statusPillActive: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(34,197,94,0.14)' : '#f0fdf4',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(74,222,128,0.4)' : '#bbf7d0',
    },
    statusPillInactive: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    statusTextActive: {
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    statusTextInactive: {
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
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
    skBar: {
      height: 14,
      borderRadius: 7,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
      marginBottom: 8,
    },
    skBarWide: { width: '62%' },
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
    sheetForm: {
      height: SHEET_MAX_HEIGHT,
    },
    sheetScroll: {
      flex: 1,
      minHeight: 0,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sheetCloseBtn: { padding: 6 },
    sheetBody: { paddingHorizontal: 20, paddingVertical: 16 },
    sheetFooter: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },

    // View modal
    viewHero: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    viewHeroTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    viewHeroMain: { flex: 1, minWidth: 0 },
    viewHeroCode: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.4,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    viewHeroName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 26,
    },
    viewSectionCard: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    viewSectionCardSchedule: {
      borderColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
      backgroundColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.08)' : '#fffbeb',
    },
    viewSectionCardAttendance: {
      borderColor:
        scheme === 'dark' ? 'rgba(74,222,128,0.35)' : '#bbf7d0',
      backgroundColor:
        scheme === 'dark' ? 'rgba(34,197,94,0.08)' : '#f0fdf4',
    },
    viewSectionCardWeekends: {
      borderColor:
        scheme === 'dark' ? 'rgba(167,139,250,0.35)' : '#ddd6fe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(139,92,246,0.1)' : '#f5f3ff',
    },
    viewSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    viewSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    viewSectionTitleSchedule: {
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    viewSectionTitleAttendance: {
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    viewSectionTitleWeekends: {
      color: scheme === 'dark' ? '#a78bfa' : '#6d28d9',
    },
    viewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
    },
    viewLabel: { fontSize: 14, color: colors.textMuted, flex: 1 },
    viewValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    viewValuePositive: {
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    viewValueNegative: {
      color: scheme === 'dark' ? '#f87171' : '#b91c1c',
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipPrimary: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
      borderColor: scheme === 'dark' ? 'rgba(96,165,250,0.4)' : '#bfdbfe',
    },
    chipPrimaryText: {
      color: colors.primary,
    },
    chipSchedule: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
    },
    chipScheduleText: {
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    chipWeekend: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(139,92,246,0.12)' : '#f5f3ff',
      borderColor: scheme === 'dark' ? 'rgba(167,139,250,0.35)' : '#ddd6fe',
    },
    chipWeekendText: {
      color: scheme === 'dark' ? '#a78bfa' : '#6d28d9',
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    chipWrapMarginTop: { marginTop: 8 },
    statusPillMarginTop: { marginTop: 6 },

    // Edit form
    formGroup: { marginBottom: 16 },
    formLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    formInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    dropdownText: { flex: 1, fontSize: 15, color: colors.text },
    dropdownPlaceholder: { color: colors.textMuted },
    methodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
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
    methodChipDisabled: { opacity: 0.45 },
    methodChipTextDisabled: { color: colors.textMuted },
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
      backgroundColor: colors.background,
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
      backgroundColor: colors.background,
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: { color: colors.text, fontWeight: '600', fontSize: 16 },
    formError: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 4,
      fontWeight: '500',
    },
    remarksInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
      minHeight: 80,
      textAlignVertical: 'top',
    },

    // Dropdown modal
    dropdownModalSafe: { flex: 1, backgroundColor: colors.overlay },
    dropdownSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '60%',
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
// Skeleton
// ---------------------------------------------------------------------------
function PackageListSkeleton({
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
        edges={['top', 'left', 'right', 'bottom']}>
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
// ViewPackageModal
// ---------------------------------------------------------------------------
type ViewPackageModalProps = {
  visible: boolean;
  pkg: InvitePackageItem | null;
  onDismiss: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

function ViewPackageModal({
  visible,
  pkg,
  onDismiss,
  styles,
  colors,
  t,
}: ViewPackageModalProps) {
  const { resolvedScheme: scheme } = useAppTheme();

  if (!pkg) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView
        style={styles.modalSafe}
        edges={['top', 'left', 'right', 'bottom']}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t('home.invitePackages.viewModal.title')}
              </Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel={t('home.invitePackages.viewModal.close')}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetBody}
              bounces={false}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              <View style={styles.viewHero}>
                <View style={styles.viewHeroTop}>
                  <View style={styles.viewHeroMain}>
                    <Text style={styles.viewHeroCode}>
                      {pkg.code || '—'}
                    </Text>
                    <Text style={styles.viewHeroName}>{pkg.name || '—'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      pkg.is_active
                        ? styles.statusPillActive
                        : styles.statusPillInactive,
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        pkg.is_active
                          ? styles.statusTextActive
                          : styles.statusTextInactive,
                      ]}>
                      {pkg.is_active
                        ? t('home.invitePackages.active')
                        : t('home.invitePackages.inactive')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.viewSectionCard}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.viewSectionTitle}>
                    {t('home.invitePackages.viewModal.infoSection')}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.designation')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(pkg.designation) || '—'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.employmentType')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(pkg.employment_type) || '—'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.salaryType')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(pkg.salary_type) || '—'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.permissionPackage')}
                  </Text>
                  <Text style={[styles.viewValue, styles.viewValuePositive]}>
                    {pkg.permission_package_name || '—'}
                  </Text>
                </View>
                {pkg.remarks ? (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.invitePackages.viewModal.remarks')}
                    </Text>
                    <Text style={styles.viewValue}>{pkg.remarks}</Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardSchedule,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={18}
                    color={scheme === 'dark' ? '#fbbf24' : '#b45309'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleSchedule,
                    ]}>
                    {t('home.invitePackages.viewModal.scheduleSection')}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.shiftStart')}
                  </Text>
                  <Text style={[styles.viewValue, styles.viewValuePositive]}>
                    {pkg.shift_start ? formatTime12h(pkg.shift_start) : '—'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.shiftEnd')}
                  </Text>
                  <Text style={[styles.viewValue, styles.viewValuePositive]}>
                    {pkg.shift_end ? formatTime12h(pkg.shift_end) : '—'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.breakMinutes')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDuration(pkg.break_minutes)}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.graceMinutes')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDuration(pkg.grace_minutes)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardAttendance,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-check"
                    size={18}
                    color={scheme === 'dark' ? '#4ade80' : '#15803d'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleAttendance,
                    ]}>
                    {t('home.invitePackages.viewModal.attendanceSection')}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.invitePackages.viewModal.autoApprove')}
                  </Text>
                  <Text
                    style={[
                      styles.viewValue,
                      pkg.auto_approve
                        ? styles.viewValuePositive
                        : styles.viewValueNegative,
                    ]}>
                    {pkg.auto_approve
                      ? t('home.invitePackages.viewModal.yes')
                      : t('home.invitePackages.viewModal.no')}
                  </Text>
                </View>
                {pkg.attendance_methods.length > 0 ? (
                  <View style={[styles.chipWrap, styles.chipWrapMarginTop]}>
                    {pkg.attendance_methods.map(m => (
                      <View
                        key={m}
                        style={[styles.chip, styles.chipSchedule]}>
                        <Text
                          style={[styles.chipText, styles.chipScheduleText]}>
                          {formatLabel(m)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>—</Text>
                )}
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardWeekends,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-weekend"
                    size={18}
                    color={scheme === 'dark' ? '#a78bfa' : '#6d28d9'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleWeekends,
                    ]}>
                    {t('home.invitePackages.viewModal.weekendsSection')}
                  </Text>
                </View>
                {pkg.weekends.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {pkg.weekends.map(day => (
                      <View key={day} style={[styles.chip, styles.chipWeekend]}>
                        <Text style={[styles.chipText, styles.chipWeekendText]}>
                          {t(
                            `home.invitePackages.days.${day.toLowerCase()}` as never,
                          ) || formatLabel(day)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>—</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PackageFormModal (Create / Edit)
// ---------------------------------------------------------------------------
type PackageFormModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  pkg: InvitePackageItem | null;
  constants: InvitePackageFormConstants | null;
  formOptionsLoading: boolean;
  permissionPackages: PermissionPackage[];
  onSave: (data: InvitePackageFormData) => void;
  onDismiss: () => void;
  saving: boolean;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

function PackageFormModal({
  visible,
  mode,
  pkg,
  constants,
  formOptionsLoading,
  permissionPackages,
  onSave,
  onDismiss,
  saving,
  styles,
  colors,
  t,
}: PackageFormModalProps) {
  const [form, setForm] = useState<InvitePackageFormData | null>(null);
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

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

  useLayoutEffect(() => {
    if (visible) {
      const data =
        mode === 'edit' && pkg
          ? buildFormDataFromPackage(pkg)
          : { ...EMPTY_FORM };
      setForm(data);
      shiftStartPicker.setValue(data.shift_start);
      shiftEndPicker.setValue(data.shift_end);
      setErrors({});
      setDropdownField(null);
    } else {
      setForm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, pkg]);

  const validate = useCallback((): boolean => {
    if (!form) {
      return false;
    }
    const errs: { code?: string; name?: string } = {};
    if (!form.code.trim()) {
      errs.code = t('home.invitePackages.formModal.errors.codeRequired');
    }
    if (!form.name.trim()) {
      errs.name = t('home.invitePackages.formModal.errors.nameRequired');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, t]);

  const handleSave = useCallback(() => {
    if (!form || !validate()) {
      return;
    }
    onSave(form);
  }, [form, onSave, validate]);

  const toggleMethod = useCallback((method: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const methods = Array.isArray(f.attendance_methods)
        ? f.attendance_methods
        : [];
      return {
        ...f,
        attendance_methods: methods.includes(method)
          ? methods.filter(m => m !== method)
          : [...methods, method],
      };
    });
  }, []);

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const weekends = Array.isArray(f.weekends) ? f.weekends : [];
      return {
        ...f,
        weekends: weekends.includes(day)
          ? weekends.filter(d => d !== day)
          : [...weekends, day],
      };
    });
  }, []);

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
            return { ...f, permission_package_id: parseInt(value, 10) || null };
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
          options = Array.isArray(constants.designations)
            ? constants.designations
            : [];
          currentVal = form.designation;
          break;
        case 'employment_type':
          options = Array.isArray(constants.employment_types)
            ? constants.employment_types
            : [];
          currentVal = form.employment_type;
          break;
        case 'salary_type':
          options = Array.isArray(constants.salary_types)
            ? constants.salary_types
            : [];
          currentVal = form.salary_type;
          break;
        case 'permission_package':
          options = (Array.isArray(permissionPackages)
            ? permissionPackages
            : []
          ).map(p => ({
            value: String(p.id),
            label: p.name,
          }));
          currentVal =
            form.permission_package_id != null
              ? String(form.permission_package_id)
              : '';
          break;
        default:
          return '';
      }
      const found = options.find(o => o.value === currentVal);
      return found?.label ?? (currentVal ? formatLabel(currentVal) : '');
    },
    [form, constants, permissionPackages],
  );

  const dropdownOptions = useMemo((): { value: string; label: string }[] => {
    if (!constants || !dropdownField) {
      return [];
    }
    switch (dropdownField) {
      case 'designation':
        return Array.isArray(constants.designations)
          ? constants.designations
          : [];
      case 'employment_type':
        return Array.isArray(constants.employment_types)
          ? constants.employment_types
          : [];
      case 'salary_type':
        return Array.isArray(constants.salary_types)
          ? constants.salary_types
          : [];
      case 'permission_package':
        return (Array.isArray(permissionPackages)
          ? permissionPackages
          : []
        ).map(p => ({
          value: String(p.id),
          label: p.name,
        }));
      default:
        return [];
    }
  }, [constants, dropdownField, permissionPackages]);

  const dropdownTitle = useMemo((): string => {
    switch (dropdownField) {
      case 'designation':
        return t('home.invitePackages.formModal.designation');
      case 'employment_type':
        return t('home.invitePackages.formModal.employmentType');
      case 'salary_type':
        return t('home.invitePackages.formModal.salaryType');
      case 'permission_package':
        return t('home.invitePackages.formModal.permissionPackage');
      default:
        return '';
    }
  }, [dropdownField, t]);

  const dropdownSelected = useMemo((): string => {
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

  const attendanceMethods = useMemo(() => {
    if (!constants) {
      return [];
    }
    return Array.isArray(constants.attendance_methods)
      ? constants.attendance_methods
      : [];
  }, [constants]);

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
          edges={['top', 'left', 'right', 'bottom']}>
          <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={[styles.sheet, styles.sheetForm]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {mode === 'create'
                    ? t('home.invitePackages.formModal.createTitle')
                    : t('home.invitePackages.formModal.editTitle')}
                </Text>
                <Pressable
                  style={styles.sheetCloseBtn}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.invitePackages.formModal.close')}>
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
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
                {formOptionsLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.muted}>
                      {t('home.invitePackages.formModal.loadingConstants')}
                    </Text>
                  </View>
                ) : (
                  <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.code')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.code}
                    onChangeText={v => {
                      setForm(f => (f ? { ...f, code: v } : f));
                      if (errors.code) {
                        setErrors(e => ({ ...e, code: undefined }));
                      }
                    }}
                    placeholder={t(
                      'home.invitePackages.formModal.codePlaceholder',
                    )}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {errors.code ? (
                    <Text style={styles.formError}>{errors.code}</Text>
                  ) : null}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.name')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.name}
                    onChangeText={v => {
                      setForm(f => (f ? { ...f, name: v } : f));
                      if (errors.name) {
                        setErrors(e => ({ ...e, name: undefined }));
                      }
                    }}
                    placeholder={t(
                      'home.invitePackages.formModal.namePlaceholder',
                    )}
                    placeholderTextColor={colors.textMuted}
                    autoCorrect={false}
                  />
                  {errors.name ? (
                    <Text style={styles.formError}>{errors.name}</Text>
                  ) : null}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.designation')}
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
                        t('home.invitePackages.formModal.selectDesignation')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.employmentType')}
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
                        t('home.invitePackages.formModal.selectEmploymentType')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.salaryType')}
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
                        t('home.invitePackages.formModal.selectSalaryType')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.permissionPackage')}
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
                        t('home.invitePackages.formModal.selectPackage')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.remarks')}
                  </Text>
                  <TextInput
                    style={styles.remarksInput}
                    value={form.remarks}
                    onChangeText={v =>
                      setForm(f => (f ? { ...f, remarks: v } : f))
                    }
                    placeholder={t(
                      'home.invitePackages.formModal.remarksPlaceholder',
                    )}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.attendanceMethods')}
                  </Text>
                  <View style={styles.methodChipWrap}>
                    {attendanceMethods.map(method => {
                      const methods = Array.isArray(form.attendance_methods)
                        ? form.attendance_methods
                        : [];
                      const active = methods.includes(method.id);
                      const disabled = !method.available;
                      return (
                        <Pressable
                          key={method.id}
                          style={[
                            styles.methodChip,
                            active && styles.methodChipActive,
                            disabled && styles.methodChipDisabled,
                          ]}
                          onPress={() => {
                            if (!disabled) {
                              toggleMethod(method.id);
                            }
                          }}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: active,
                            disabled,
                          }}>
                          <Text
                            style={[
                              styles.methodChipText,
                              active && styles.methodChipTextActive,
                              disabled && styles.methodChipTextDisabled,
                            ]}>
                            {method.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.formGroup, styles.switchRow]}>
                  <Text style={styles.switchLabel}>
                    {t('home.invitePackages.formModal.autoApprove')}
                  </Text>
                  <Switch
                    value={form.auto_approve}
                    onValueChange={v =>
                      setForm(f => (f ? { ...f, auto_approve: v } : f))
                    }
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.formLabel}>
                        {t('home.invitePackages.formModal.shiftStart')}
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
                        {t('home.invitePackages.formModal.shiftEnd')}
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

                <View style={styles.formGroup}>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.formLabel}>
                        {t('home.invitePackages.formModal.breakMinutes')}
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
                        {t('home.invitePackages.formModal.graceMinutes')}
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

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {t('home.invitePackages.formModal.weekends')}
                  </Text>
                  <View style={styles.methodChipWrap}>
                    {ALL_WEEKDAYS.map(day => {
                      const weekends = Array.isArray(form.weekends)
                        ? form.weekends
                        : [];
                      const active = weekends.includes(day);
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
                            {t(`home.invitePackages.days.${day}` as never)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                  </>
                )}
              </ScrollView>

              <View style={styles.sheetFooter}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={onDismiss}
                  accessibilityRole="button">
                  <Text style={styles.cancelBtnText}>
                    {t('home.invitePackages.formModal.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveBtn,
                    saving && styles.saveBtnDisabled,
                    pressed && !saving && { opacity: 0.88 },
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                  accessibilityRole="button">
                  <Text style={styles.saveBtnText}>
                    {saving
                      ? t('home.invitePackages.formModal.saving')
                      : mode === 'create'
                        ? t('home.invitePackages.formModal.create')
                        : t('home.invitePackages.formModal.save')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <TimePicker {...shiftStartPicker.pickerProps} />
      <TimePicker {...shiftEndPicker.pickerProps} />

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
// Package Row (list view)
// ---------------------------------------------------------------------------
type RowProps = {
  item: InvitePackageItem;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  t: TFunction;
};

const PackageRow = React.memo(function PackageRow({
  item,
  styles,
  colors,
  onView,
  onEdit,
  onToggle,
  onDelete,
  t,
}: RowProps) {
  const shiftSpan =
    item.shift_start && item.shift_end
      ? `${formatTime12h(item.shift_start)}–${formatTime12h(item.shift_end)}`
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {item.code}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            item.is_active
              ? styles.statusPillActive
              : styles.statusPillInactive,
          ]}>
          <Text
            style={[
              styles.statusPillText,
              item.is_active
                ? styles.statusTextActive
                : styles.statusTextInactive,
            ]}>
            {item.is_active
              ? t('home.invitePackages.active')
              : t('home.invitePackages.inactive')}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        {item.designation ? (
          <Text style={styles.metaLabel}>
            {formatLabel(item.designation)}
          </Text>
        ) : null}
        {item.employment_type ? (
          <Text style={styles.metaMuted} numberOfLines={1}>
            {item.designation ? ' · ' : ''}
            {formatLabel(item.employment_type)}
          </Text>
        ) : null}
        {item.salary_type ? (
          <Text style={styles.metaMuted} numberOfLines={1}>
            {item.designation || item.employment_type ? ' · ' : ''}
            {formatLabel(item.salary_type)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.shiftLine}>
        {shiftSpan
          ? `${t('home.invitePackages.shift')}: ${shiftSpan}`
          : ''}
        {item.weekends.length > 0
          ? `${shiftSpan ? ' · ' : ''}${t('home.invitePackages.weekends', { count: item.weekends.length })}`
          : ''}
        {item.attendance_methods.length > 0
          ? `${shiftSpan || item.weekends.length > 0 ? ' · ' : ''}${t('home.invitePackages.methods', { count: item.attendance_methods.length })}`
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
          accessibilityLabel={t('home.invitePackages.actions.view')}>
          <MaterialCommunityIcons
            name="eye-outline"
            size={15}
            color={colors.primary}
          />
          <Text style={styles.actionBtnText}>
            {t('home.invitePackages.actions.view')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('home.invitePackages.actions.edit')}>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={15}
            color={colors.primary}
          />
          <Text style={styles.actionBtnText}>
            {t('home.invitePackages.actions.edit')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={
            item.is_active
              ? t('home.invitePackages.actions.deactivate')
              : t('home.invitePackages.actions.activate')
          }>
          <MaterialCommunityIcons
            name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
            size={15}
            color={colors.primary}
          />
          <Text style={styles.actionBtnText}>
            {item.is_active
              ? t('home.invitePackages.actions.deactivate')
              : t('home.invitePackages.actions.activate')}
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
          accessibilityLabel={t('home.invitePackages.actions.delete')}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={15}
            color={colors.danger}
          />
          <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
            {t('home.invitePackages.actions.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function InvitePackagesScreen({ navigation }: Props) {
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
  const {
    props: confirmProps,
    present: presentConfirm,
    dismiss: dismissConfirm,
  } = useConfirmAlert();

  const [modalType, setModalType] = useState<ModalType>('NONE');
  const [selectedPackage, setSelectedPackage] =
    useState<InvitePackageItem | null>(null);

  const onError = useCallback(
    (msg: string) =>
      presentError({ title: t('home.invitePackages.apiError'), message: msg }),
    [presentError, t],
  );

  const onSuccess = useCallback(
    (msg: string) => presentSuccess({ title: msg, message: '' }),
    [presentSuccess],
  );

  const {
    packages,
    constants,
    constantsLoading,
    loadFormConstants,
    loadFormPermissionPackages,
    permissionPackages,
    permissionPackagesLoading,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    loadMore,
    retry,
    createPackage,
    updatePackage,
    deletePackage,
    toggleActive,
    mutating,
  } = useInvitePackages({ companyId, onError, onSuccess });

  const openView = useCallback((pkg: InvitePackageItem) => {
    setSelectedPackage(pkg);
    setModalType('VIEW');
  }, []);

  const openEdit = useCallback((pkg: InvitePackageItem) => {
    setSelectedPackage(pkg);
    setModalType('EDIT');
  }, []);

  const openCreate = useCallback(() => {
    setSelectedPackage(null);
    setModalType('CREATE');
  }, []);

  const openToggle = useCallback(
    (pkg: InvitePackageItem) => {
      const isActive = pkg.is_active;
      presentConfirm({
        title: isActive
          ? t('home.invitePackages.toggleModal.deactivateTitle')
          : t('home.invitePackages.toggleModal.activateTitle'),
        message: isActive
          ? t('home.invitePackages.toggleModal.deactivateMessage')
          : t('home.invitePackages.toggleModal.activateMessage'),
        buttons: [
          {
            text: t('home.invitePackages.toggleModal.cancel'),
            variant: 'secondary',
          },
          {
            text: t('home.invitePackages.toggleModal.confirm'),
            variant: 'primary',
            onPress: () => {
              toggleActive(pkg)
                .then(ok => {
                  dismissConfirm();
                  if (ok) {
                    presentSuccess({
                      title: t('home.invitePackages.toggleModal.success'),
                      message: '',
                    });
                  }
                })
                .catch(() => {
                  dismissConfirm();
                });
            },
          },
        ],
      });
    },
    [dismissConfirm, presentConfirm, presentSuccess, t, toggleActive],
  );

  const openDelete = useCallback(
    (pkg: InvitePackageItem) => {
      presentConfirm({
        title: t('home.invitePackages.deleteModal.title'),
        message: t('home.invitePackages.deleteModal.message', {
          name: pkg.name,
        }),
        buttons: [
          {
            text: t('home.invitePackages.deleteModal.cancel'),
            variant: 'secondary',
          },
          {
            text: t('home.invitePackages.deleteModal.confirm'),
            variant: 'danger',
            onPress: () => {
              deletePackage(pkg.id)
                .then(ok => {
                  dismissConfirm();
                  if (ok) {
                    presentSuccess({
                      title: t('home.invitePackages.deleteModal.success'),
                      message: '',
                    });
                  }
                })
                .catch(() => {
                  dismissConfirm();
                });
            },
          },
        ],
      });
    },
    [deletePackage, dismissConfirm, presentConfirm, presentSuccess, t],
  );

  const closeModal = useCallback(() => {
    setModalType('NONE');
    setSelectedPackage(null);
  }, []);

  const formOptionsLoading =
    constantsLoading || permissionPackagesLoading;

  useEffect(() => {
    if (modalType === 'CREATE' || modalType === 'EDIT') {
      loadFormConstants().catch(() => { });
      loadFormPermissionPackages().catch(() => { });
    }
  }, [modalType, loadFormConstants, loadFormPermissionPackages]);

  const handleFormSave = useCallback(
    (form: InvitePackageFormData) => {
      if (modalType === 'CREATE') {
        const payload = buildInvitePackageCreatePayload(form);
        createPackage(payload)
          .then(ok => {
            if (ok) {
              closeModal();
            }
          })
          .catch(() => { });
        return;
      }

      if (modalType === 'EDIT' && selectedPackage) {
        const toHHmmss = (hhmm: string) =>
          hhmm.includes(':') && hhmm.split(':').length === 2
            ? `${hhmm}:00`
            : hhmm;
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          designation: form.designation || undefined,
          employment_type: form.employment_type || undefined,
          salary_type: form.salary_type || undefined,
          permission_package_id: form.permission_package_id ?? undefined,
          shift_start: toHHmmss(form.shift_start),
          shift_end: toHHmmss(form.shift_end),
          break_minutes: form.break_minutes || undefined,
          grace_minutes: form.grace_minutes || undefined,
          weekends: form.weekends,
          attendance_methods: form.attendance_methods,
          auto_approve: form.auto_approve,
          remarks: form.remarks.trim() || undefined,
        };
        updatePackage({ ...payload, package_id: selectedPackage.id })
          .then(ok => {
            if (ok) {
              closeModal();
            }
          })
          .catch(() => { });
      }
    },
    [modalType, selectedPackage, createPackage, updatePackage, closeModal],
  );

  const renderListItem = useCallback(
    ({ item }: { item: InvitePackageItem }) => (
      <PackageRow
        item={item}
        styles={styles}
        colors={colors}
        onView={() => openView(item)}
        onEdit={() => openEdit(item)}
        onToggle={() => openToggle(item)}
        onDelete={() => openDelete(item)}
        t={t}
      />
    ),
    [styles, colors, t, openView, openEdit, openToggle, openDelete],
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
            placeholder={t('home.invitePackages.searchPlaceholder')}
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
        {loading ? <PackageListSkeleton styles={styles} /> : null}
      </View>
    ),
    [colors.textMuted, loading, search, setSearch, styles, t],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerBox}>
          <PackageListSkeleton styles={styles} count={3} />
        </View>
      );
    }
    return null;
  }, [loadingMore, styles]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return null;
    }
    if (packages.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            {t('home.invitePackages.empty')}
          </Text>
        </View>
      );
    }
    return null;
  }, [packages.length, loading, styles, t]);

  const onEndReached = useCallback(() => {
    loadMore();
  }, [loadMore]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (companyId == null) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.invitePackages.back')}
          />
          <Text
            style={styles.stackHeaderTitle}
            numberOfLines={1}
            accessibilityRole="header">
            {t('home.invitePackages.title')}
          </Text>
        </View>
        <View style={[styles.centerBox, styles.fill]}>
          <Text style={styles.muted}>
            {t('home.invitePackages.noCompany')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && packages.length === 0 && !loading) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.stackHeader}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.invitePackages.back')}
          />
          <Text
            style={styles.stackHeaderTitle}
            numberOfLines={1}
            accessibilityRole="header">
            {t('home.invitePackages.title')}
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
              {t('home.invitePackages.retry')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.invitePackages.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header">
          {t('home.invitePackages.title')}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={openCreate}
            accessibilityRole="button"
            accessibilityLabel={t('home.invitePackages.createBtn')}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.createBtnText}>
              {t('home.invitePackages.createBtn')}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        style={styles.fill}
        data={loading ? [] : packages}
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

      {/* View Package Modal */}
      <ViewPackageModal
        visible={modalType === 'VIEW'}
        pkg={selectedPackage}
        onDismiss={closeModal}
        styles={styles}
        colors={colors}
        t={t}
      />

      {/* Create / Edit Package Modal */}
      <PackageFormModal
        visible={modalType === 'CREATE' || modalType === 'EDIT'}
        mode={modalType === 'CREATE' ? 'create' : 'edit'}
        pkg={selectedPackage}
        constants={constants}
        formOptionsLoading={formOptionsLoading}
        permissionPackages={permissionPackages}
        onSave={handleFormSave}
        onDismiss={closeModal}
        saving={mutating}
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
