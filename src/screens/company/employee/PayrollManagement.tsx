import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
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

import { ExpandableAnimatedSection } from '@src/components/ExpandableAnimatedSection';
import { GeneratePayrollModal } from '@src/components/modals/GeneratePayrollModal';
import { MonthPickerModal } from '@src/components/modals/MonthPickerModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { generatePayroll } from '@src/api/payrollApi';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import {
  usePayrollList,
  type PayrollStatusFilter,
} from '@src/hooks/usePayrollList';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { GeneratePayrollEmployeeOption, GeneratePayrollRequest } from '@src/types/generatePayroll';
import type { PayrollListDisplayRow } from '@src/types/payrollList';
import { resolveProfilePictureUrl } from '@src/utils/attendanceListDisplay';
import { readApiError } from '@src/utils/readApiError';
import {
  formatPayrollAmount,
  MONTH_KEYS,
  shiftMonthYear,
} from '@src/utils/formatPayrollAmount';

type Props = NativeStackScreenProps<HomeStackParamList, 'PayrollManagement'>;

const PAGE_SIZE = 20;
const SCREEN_PAD = 12;
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();

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
  const screenBg = isDark ? colors.background : '#f0fdfa';
  const cardBg = isDark ? colors.surface : '#ffffff';

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: screenBg },
    stackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: SCREEN_PAD,
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
    filtersWrap: {
      paddingHorizontal: SCREEN_PAD,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: screenBg,
    },
    periodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? '#134e4a' : '#0d9488',
      ...Platform.select({
        ios: {
          shadowColor: '#0d9488',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.18,
          shadowRadius: 6,
        },
        android: { elevation: 3 },
      }),
    },
    periodNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    periodCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 6 },
    periodCenterPressed: { opacity: 0.88 },
    periodLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
    periodValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 1 },
    summaryCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#99f6e4',
    },
    summaryItem: { minWidth: '30%', flexGrow: 1 },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
    summaryValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 1 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#99f6e4',
      paddingHorizontal: 10,
      marginBottom: 8,
      minHeight: 40,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 8 : 6,
      fontSize: 14,
      color: colors.text,
    },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    filterChipActive: {
      borderColor: '#0d9488',
      backgroundColor: isDark ? '#134e4a' : '#ccfbf1',
    },
    filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    filterChipTextActive: { color: isDark ? '#5eead4' : '#0f766e' },
    listContent: {
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    card: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: cardBg,
    },
    cardPressed: { backgroundColor: isDark ? colors.background : '#f8fafc' },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: SCREEN_PAD,
      paddingVertical: 10,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondaryButton,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    cardMain: { flex: 1, minWidth: 0 },
    employeeName: { fontSize: 14, fontWeight: '700', color: colors.text },
    employeeSnippet: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      marginTop: 4,
    },
    statusGenerated: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.14)' : '#f0fdf4',
      borderColor: isDark ? 'rgba(74, 222, 128, 0.4)' : '#bbf7d0',
    },
    statusPreview: {
      backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : '#fffbeb',
      borderColor: isDark ? 'rgba(251, 191, 36, 0.35)' : '#fde68a',
    },
    statusTextGenerated: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#4ade80' : '#15803d',
    },
    statusTextPreview: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#fbbf24' : '#b45309',
    },
    chevronWrap: { padding: 4 },
    cardDetails: {
      paddingHorizontal: SCREEN_PAD,
      paddingBottom: 10,
    },
    salaryBlock: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: isDark ? colors.background : '#f8fafc',
    },
    netLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
    netValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 1 },
    amountsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    amountCol: { flex: 1 },
    amountLabel: { fontSize: 10, color: colors.textMuted },
    amountValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 1 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    statPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? '#334155' : colors.secondaryButton,
    },
    statText: { fontSize: 10, fontWeight: '600', color: colors.text },
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: SCREEN_PAD,
    },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
    error: { fontSize: 15, color: colors.danger, textAlign: 'center', lineHeight: 22 },
    retryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: SCREEN_PAD,
      gap: 10,
    },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    pageBtnDisabled: { opacity: 0.45 },
    pageBtnLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
    pageInfo: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: isDark ? '#134e4a' : '#0d9488',
    },
    generateBtnDisabled: { opacity: 0.45 },
    generateBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    skeleton: {
      height: 56,
      marginHorizontal: SCREEN_PAD,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      marginBottom: 8,
      opacity: 0.55,
    },
  });
}

type RowProps = {
  row: PayrollListDisplayRow;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: (key: string, opts?: Record<string, unknown>) => string;
};

const PayrollRow = React.memo(function PayrollRow({ row, styles, colors, t }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const { employee, payroll, kind } = row;
  const photoUri = resolveProfilePictureUrl(employee.profile_picture);
  const designation = employee.designation?.label ?? employee.designation?.value ?? '';
  const isGenerated = kind === 'generated';

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [chevronAnim, expanded]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const snippet = [
    employee.employee_code,
    formatPayrollAmount(payroll.net_salary),
    isGenerated
      ? t('home.payrollManagement.statusGenerated')
      : t('home.payrollManagement.statusPreview'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(prev => !prev)}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.cardPressed]}>
        <View style={styles.avatar}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImg}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={styles.avatarText}>{getInitials(employee.name)}</Text>
          )}
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.employeeName} numberOfLines={1}>
            {employee.name}
          </Text>
          <Text style={styles.employeeSnippet} numberOfLines={1}>
            {snippet}
          </Text>
        </View>
        <Animated.View style={[styles.chevronWrap, { transform: [{ rotate: chevronRotate }] }]}>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      <ExpandableAnimatedSection expanded={expanded} contentStyle={styles.cardDetails}>
        {designation ? (
          <Text style={styles.employeeSnippet}>{designation}</Text>
        ) : null}
        <View
          style={[
            styles.statusBadge,
            isGenerated ? styles.statusGenerated : styles.statusPreview,
          ]}>
          <Text style={isGenerated ? styles.statusTextGenerated : styles.statusTextPreview}>
            {isGenerated
              ? t('home.payrollManagement.statusGenerated')
              : t('home.payrollManagement.statusPreview')}
          </Text>
        </View>
        <View style={styles.salaryBlock}>
          <Text style={styles.netLabel}>{t('home.payrollManagement.netSalary')}</Text>
          <Text style={styles.netValue}>{formatPayrollAmount(payroll.net_salary)}</Text>
          <View style={styles.amountsRow}>
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>{t('home.payrollManagement.earnings')}</Text>
              <Text style={styles.amountValue}>
                {formatPayrollAmount(payroll.total_earnings)}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>{t('home.payrollManagement.deductions')}</Text>
              <Text style={styles.amountValue}>
                {formatPayrollAmount(payroll.total_deductions)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statText}>
              {t('home.payrollManagement.presentDays', {
                count: payroll.attendance.present_days,
                total: payroll.attendance.working_days,
              })}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statText}>
              {t('home.payrollManagement.absentDays', { count: payroll.attendance.absent_days })}
            </Text>
          </View>
          {payroll.work.overtime_minutes > 0 ? (
            <View style={styles.statPill}>
              <Text style={styles.statText}>
                {t('home.payrollManagement.overtimeMinutes', {
                  count: payroll.work.overtime_minutes,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </ExpandableAnimatedSection>
    </View>
  );
});

export function PayrollManagementScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusAlertProps, presentSuccess, presentError } = useStatusAlert();

  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PayrollStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);

  const monthLabels = useMemo(
    () => MONTH_KEYS.map(key => t(`home.payrollManagement.months.${key}`)),
    [t],
  );

  useEffect(() => {
    setPage(1);
  }, [month, year, statusFilter]);

  const {
    generatedPayrolls,
    previewPayrolls,
    displayRows,
    meta,
    loading,
    refreshing,
    error,
    accessDenied,
    refresh,
    retry,
  } = usePayrollList({
    companyId,
    month,
    year,
    page,
    limit: PAGE_SIZE,
    statusFilter,
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return displayRows;
    }
    return displayRows.filter(rowItem => {
      const { employee } = rowItem;
      const haystack = [
        employee.name,
        employee.email,
        employee.employee_code,
        employee.designation?.label,
        employee.designation?.value,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [displayRows, search]);

  const periodLabel = t(`home.payrollManagement.months.${MONTH_KEYS[month - 1]}`);
  const canGoPrev = page > 1;
  const canGoNext = meta != null && page < meta.total_pages;

  const goPrevPeriod = useCallback(() => {
    const next = shiftMonthYear(month, year, -1);
    setMonth(next.month);
    setYear(next.year);
  }, [month, year]);

  const goNextPeriod = useCallback(() => {
    const next = shiftMonthYear(month, year, 1);
    setMonth(next.month);
    setYear(next.year);
  }, [month, year]);

  const handlePickerConfirm = useCallback((nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
  }, []);

  const currentMonthLabel = t(`home.payrollManagement.months.${MONTH_KEYS[CURRENT_MONTH - 1]}`);

  const previewEmployeeOptions = useMemo<GeneratePayrollEmployeeOption[]>(
    () =>
      previewPayrolls.map(row => ({
        id: row.employee.id,
        name: row.employee.name,
        employeeCode: row.employee.employee_code,
        kind: 'preview',
      })),
    [previewPayrolls],
  );

  const pageEmployeeOptions = useMemo<GeneratePayrollEmployeeOption[]>(
    () =>
      displayRows.map(row => ({
        id: row.employee.id,
        name: row.employee.name,
        employeeCode: row.employee.employee_code,
        kind: row.kind,
      })),
    [displayRows],
  );

  const canGenerate = companyId != null && !accessDenied && !loading;

  const handleGenerateSubmit = useCallback(
    async (payload: GeneratePayrollRequest) => {
      if (companyId == null) {
        return;
      }
      setGenerateSubmitting(true);
      try {
        const res = await generatePayroll(companyId, payload);
        if (res.success) {
          setGenerateModalVisible(false);
          refresh();
          const processed = res.meta?.processed_count ?? res.data?.length ?? 0;
          let message = t('home.payrollManagement.generateModal.successMessage', {
            count: processed,
          });
          if (payload.send_pdf && res.email_summary) {
            message = `${message}\n${t('home.payrollManagement.generateModal.emailSummary', {
              sent: res.email_summary.sent,
              failed: res.email_summary.failed,
            })}`;
          }
          presentSuccess({
            title: t('home.payrollManagement.generateModal.successTitle'),
            message,
          });
          return;
        }
        presentError({
          title: t('home.payrollManagement.generateModal.errorTitle'),
          message: res.message?.trim() || t('home.payrollManagement.generateModal.errorGeneric'),
        });
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          presentError({
            title: t('home.payrollManagement.generateModal.errorTitle'),
            message: t('home.payrollManagement.generateModal.accessDenied'),
          });
        } else {
          presentError({
            title: t('home.payrollManagement.generateModal.errorTitle'),
            message: readApiError(e),
          });
        }
      } finally {
        setGenerateSubmitting(false);
      }
    },
    [companyId, presentError, presentSuccess, refresh, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: PayrollListDisplayRow }) => (
      <PayrollRow row={item} styles={styles} colors={colors} t={t} />
    ),
    [colors, styles, t],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.filtersWrap}>
        <View style={styles.periodCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.payrollManagement.prevPeriod')}
            onPress={goPrevPeriod}
            style={styles.periodNavBtn}>
            <MaterialCommunityIcons name="chevron-left" size={20} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.payrollManagement.selectPeriod')}
            onPress={() => setPickerVisible(true)}
            style={({ pressed }) => [styles.periodCenter, pressed && styles.periodCenterPressed]}>
            <Text style={styles.periodLabel}>{t('home.payrollManagement.periodLabel')}</Text>
            <Text style={styles.periodValue}>
              {periodLabel} {year}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.payrollManagement.nextPeriod')}
            onPress={goNextPeriod}
            style={styles.periodNavBtn}>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
          </Pressable>
        </View>

        {meta != null && !loading ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('home.payrollManagement.totalEmployees')}</Text>
              <Text style={styles.summaryValue}>{String(meta.total)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('home.payrollManagement.generatedCount')}</Text>
              <Text style={styles.summaryValue}>{String(generatedPayrolls.length)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('home.payrollManagement.previewCount')}</Text>
              <Text style={styles.summaryValue}>{String(previewPayrolls.length)}</Text>
            </View>
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
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.payrollManagement.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {(['all', 'generated', 'preview'] as const).map(key => {
            const active = statusFilter === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setStatusFilter(key)}
                style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {t(`home.payrollManagement.filters.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <>
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
          </>
        ) : null}
      </View>
    ),
    [
      colors.textMuted,
      generatedPayrolls.length,
      goNextPeriod,
      goPrevPeriod,
      loading,
      meta,
      periodLabel,
      previewPayrolls.length,
      search,
      statusFilter,
      styles,
      t,
      year,
    ],
  );

  const listFooter = useMemo(() => {
    if (loading || meta == null || meta.total_pages <= 1) {
      return null;
    }
    return (
      <View style={styles.pagination}>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoPrev}
          onPress={() => canGoPrev && setPage(p => p - 1)}
          style={[styles.pageBtn, !canGoPrev && styles.pageBtnDisabled]}>
          <MaterialCommunityIcons name="chevron-left" size={18} color={colors.primary} />
          <Text style={styles.pageBtnLabel}>{t('home.payrollManagement.prevPage')}</Text>
        </Pressable>
        <Text style={styles.pageInfo}>
          {t('home.payrollManagement.pageOf', { page: meta.page, total: meta.total_pages })}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoNext}
          onPress={() => canGoNext && setPage(p => p + 1)}
          style={[styles.pageBtn, !canGoNext && styles.pageBtnDisabled]}>
          <Text style={styles.pageBtnLabel}>{t('home.payrollManagement.nextPage')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      </View>
    );
  }, [canGoNext, canGoPrev, colors.primary, loading, meta, styles, t]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return null;
    }
    if (companyId == null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{t('home.payrollManagement.noCompany')}</Text>
        </View>
      );
    }
    if (accessDenied) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.textMuted} />
          <Text style={styles.error}>{t('home.payrollManagement.accessDenied')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>{t('home.payrollManagement.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <Text style={styles.muted}>{t('home.payrollManagement.empty')}</Text>
      </View>
    );
  }, [accessDenied, companyId, error, loading, colors.textMuted, retry, styles, t]);

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.payrollManagement.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('home.payrollManagement.title')}
        </Text>
        <View style={styles.headerActions}>
          {refreshing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.payrollManagement.generate')}
            disabled={!canGenerate}
            onPress={() => setGenerateModalVisible(true)}
            style={({ pressed }) => [
              styles.generateBtn,
              !canGenerate && styles.generateBtnDisabled,
              pressed && canGenerate && { opacity: 0.88 },
            ]}>
            <MaterialCommunityIcons name="cash-plus" size={16} color="#fff" />
            <Text style={styles.generateBtnText}>{t('home.payrollManagement.generate')}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={loading ? [] : filteredRows}
        keyExtractor={item =>
          `${item.kind}-${item.employee.id}-${item.payroll.month}-${item.payroll.year}`
        }
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      <MonthPickerModal
        visible={pickerVisible}
        month={month}
        year={year}
        monthLabels={monthLabels}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={handlePickerConfirm}
      />

      <GeneratePayrollModal
        visible={generateModalVisible}
        submitting={generateSubmitting}
        currentMonthLabel={currentMonthLabel}
        currentYear={CURRENT_YEAR}
        previewEmployees={previewEmployeeOptions}
        pageEmployees={pageEmployeeOptions}
        onDismiss={() => {
          if (!generateSubmitting) {
            setGenerateModalVisible(false);
          }
        }}
        onSubmit={payload => {
          handleGenerateSubmit(payload).catch(() => {});
        }}
      />

      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
