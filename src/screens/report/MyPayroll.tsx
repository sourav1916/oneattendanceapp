import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { authHttpClient } from '@src/api/authHttpClient';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { formatLedgerAmount } from '@src/utils/ledgerFormat';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'MyPayroll'>;
type Adjustment = { id: number; type: string; name: string; amount: number; remark: string | null };
type Payroll = {
  id: number;
  month: number;
  year: number;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
  attendance: Record<string, number>;
  work: { worked_hours: number; overtime_hours: number };
  salary_snapshot: { employee_code: string | null };
  adjustments: Adjustment[];
};
type PayrollResponse = {
  success: boolean;
  message?: string;
  data?: Array<{ payroll: Payroll }>;
  meta?: { total?: number };
};

const PAGE_SIZE = 10;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const money = (value: number) => `₹${formatLedgerAmount(Number(value) || 0)}`;

const metric = (value: number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return String(numericValue);
};

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, maxHeight: 56, paddingRight: 16, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    title: { flex: 1, marginLeft: 2, color: colors.text, fontSize: 18, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 36 },
    intro: { marginBottom: 16 },
    eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    heading: { marginTop: 4, color: colors.text, fontSize: 26, fontWeight: '800' },
    subheading: { marginTop: 4, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
    filterCard: { padding: 14, marginBottom: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    filterLabel: { marginBottom: 9, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    filterRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, height: 44, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background, fontSize: 14 },
    monthButton: { flex: 1.5, height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    monthText: { color: colors.text, fontSize: 14 },
    apply: { height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primary },
    applyText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    activeFilter: { marginTop: 10, color: colors.primary, fontSize: 12, fontWeight: '700' },
    card: { marginBottom: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    month: { color: colors.text, fontSize: 18, fontWeight: '800' },
    code: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
    netLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
    net: { marginTop: 3, color: '#059669', fontSize: 19, fontWeight: '800' },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 15, backgroundColor: colors.border },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: colors.secondaryButton },
    statLabel: { color: colors.textMuted, fontSize: 11 },
    statValue: { marginTop: 4, color: colors.text, fontSize: 13, fontWeight: '800' },
    sectionTitle: { marginTop: 15, marginBottom: 6, color: colors.text, fontSize: 13, fontWeight: '800' },
    detail: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
    adjustment: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    adjustmentName: { flex: 1, color: colors.text, fontSize: 13 },
    adjustmentAmount: { fontWeight: '800' },
    fine: { color: colors.danger },
    credit: { color: '#059669' },
    center: { alignItems: 'center', justifyContent: 'center', padding: 48 },
    muted: { marginTop: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    error: { marginTop: 12, color: colors.danger, textAlign: 'center' },
    retry: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
    retryText: { color: '#fff', fontWeight: '800' },
    footer: { paddingVertical: 18 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
    modalTitle: { marginBottom: 14, color: colors.text, fontSize: 18, fontWeight: '800' },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    monthOption: { width: '31%', paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: colors.secondaryButton },
    monthOptionActive: { backgroundColor: colors.primary },
    monthOptionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    monthOptionTextActive: { color: '#fff' },
    clearMonth: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
    clearMonthText: { color: colors.primary, fontWeight: '800' },
  });
}

export function MyPayrollScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const isEmployee = selectedCompany?.relation === 'employee';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const years = useMemo(
    () => Array.from({ length: 7 }, (_, index) => String(currentYear - 5 + index)),
    [currentYear],
  );
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState<number | null>(currentMonth);
  const [appliedYear, setAppliedYear] = useState(String(currentYear));
  const [appliedMonth, setAppliedMonth] = useState<number | null>(currentMonth);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [items, setItems] = useState<Array<{ payroll: Payroll }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async (nextPage: number, refresh = false) => {
    if (companyId == null || !isEmployee) {
      fetchIdRef.current += 1;
      setLoading(false);
      return;
    }
    if (nextPage > 1) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
    }
    const fetchId = ++fetchIdRef.current;
    if (refresh) setRefreshing(true);
    else if (nextPage > 1) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      if (appliedYear) params.set('year', appliedYear);
      if (appliedMonth != null) params.set('month', String(appliedMonth));
      const response = await authHttpClient.get<PayrollResponse>(`/payroll/my?${params.toString()}`, {
        headers: { company: String(companyId) },
      });
      if (fetchId !== fetchIdRef.current) return;
      if (!response.data.success) throw new Error(response.data.message || t('home.myPayroll.loadError'));
      const nextItems = response.data.data || [];
      setItems(previous => nextPage === 1 ? nextItems : [...previous, ...nextItems]);
      setPage(nextPage);
      setTotal(Number(response.data.meta?.total || 0));
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return;
      setError(axios.isAxiosError(e) ? readApiError(e) : e instanceof Error ? e.message : t('home.myPayroll.loadError'));
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
      if (nextPage > 1) loadingMoreRef.current = false;
    }
  }, [appliedMonth, appliedYear, companyId, isEmployee, t]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotal(0);
    load(1).catch(() => {});
  }, [companyId, isEmployee, appliedYear, appliedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(({ item }: { item: { payroll: Payroll } }) => {
    const p = item.payroll;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.month}>{MONTHS[p.month - 1]} {p.year}</Text>
            <Text style={styles.code}>{p.salary_snapshot.employee_code || t('home.myPayroll.employeePayroll')}</Text>
          </View>
          <View>
            <Text style={styles.netLabel}>{t('home.myPayroll.netSalary')}</Text>
            <Text style={styles.net}>{money(p.net_salary)}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>{t('home.myPayroll.earnings')}</Text><Text style={styles.statValue}>{money(p.total_earnings)}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>{t('home.myPayroll.deductions')}</Text><Text style={styles.statValue}>{money(p.total_deductions)}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>{t('home.myPayroll.present')}</Text><Text style={styles.statValue}>{metric(p.attendance.present_days)}</Text></View>
        </View>
        <Text style={styles.sectionTitle}>{t('home.myPayroll.attendance')}</Text>
        <Text style={styles.detail}>{t('home.myPayroll.attendanceDetail', { working: metric(p.attendance.working_days), absent: metric(p.attendance.absent_days), leave: metric(Number(p.attendance.paid_leave_days || 0) + Number(p.attendance.unpaid_leave_days || 0)) })}</Text>
        <Text style={styles.detail}>{t('home.myPayroll.workDetail', { worked: metric(p.work.worked_hours), overtime: metric(p.work.overtime_hours) })}</Text>
        {p.adjustments.length > 0 ? <><Text style={styles.sectionTitle}>{t('home.myPayroll.adjustments')}</Text>{p.adjustments.map(adjustment => <View key={adjustment.id} style={styles.adjustment}><Text style={styles.adjustmentName}>{adjustment.name}</Text><Text style={[styles.adjustmentAmount, adjustment.type === 'fine' ? styles.fine : styles.credit]}>{adjustment.type === 'fine' ? '-' : '+'}{money(adjustment.amount)}</Text></View>)}</> : null}
      </View>
    );
  }, [styles, t]);

  const empty = loading
    ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
    : error
      ? <View style={styles.center}><MaterialCommunityIcons name="alert-circle-outline" size={38} color={colors.danger} /><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => load(1)}><Text style={styles.retryText}>{t('home.myPayroll.retry')}</Text></Pressable></View>
      : <View style={styles.center}><MaterialCommunityIcons name="file-document-outline" size={40} color={colors.textMuted} /><Text style={styles.muted}>{t('home.myPayroll.empty')}</Text></View>;

  const applyFilters = () => {
    const trimmedYear = year.trim();
    setAppliedYear(/^\d{4}$/.test(trimmedYear) ? trimmedYear : '');
    setAppliedMonth(month);
  };

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.header}><HeaderBackButton onPress={() => navigation.goBack()} tintColor={colors.primary} displayMode="minimal" accessibilityLabel={t('home.myPayroll.back')} /><Text style={styles.title}>{t('home.myPayroll.title')}</Text></View>
      {companyId == null || !isEmployee ? <View style={styles.center}><Text style={styles.muted}>{companyId == null ? t('home.myPayroll.noCompany') : t('home.myPayroll.notEmployee')}</Text></View> : <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => String(item.payroll.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><View style={styles.intro}><Text style={styles.eyebrow}>{t('home.myPayroll.eyebrow')}</Text><Text style={styles.heading}>{t('home.myPayroll.heading')}</Text><Text style={styles.subheading}>{t('home.myPayroll.subtitle')}</Text></View><View style={styles.filterCard}><Text style={styles.filterLabel}>{t('home.myPayroll.filterLabel')}</Text><View style={styles.filterRow}><Pressable style={styles.monthButton} onPress={() => setMonthPickerVisible(true)}><Text style={styles.monthText}>{month == null ? t('home.myPayroll.allMonths') : MONTHS[month - 1]}</Text><MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} /></Pressable><Pressable style={styles.monthButton} onPress={() => setYearPickerVisible(true)}><Text style={styles.monthText}>{year || t('home.myPayroll.allYears')}</Text><MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} /></Pressable><Pressable style={styles.apply} onPress={applyFilters}><Text style={styles.applyText}>{t('home.myPayroll.filter')}</Text></Pressable></View>{appliedYear || appliedMonth != null ? <Text style={styles.activeFilter}>{t('home.myPayroll.activeFilter', { value: `${appliedMonth == null ? t('home.myPayroll.allMonths') : MONTHS[appliedMonth - 1]} ${appliedYear || t('home.myPayroll.allYears')}` })}</Text> : null}</View></View>}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <View style={styles.footer}><ActivityIndicator color={colors.primary} /></View> : null}
        onEndReached={() => {
          if (!loading && !loadingMore && !loadingMoreRef.current && items.length < total) {
            load(page + 1).catch(() => {});
          }
        }}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />}
      <Modal visible={monthPickerVisible} transparent animationType="slide" onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMonthPickerVisible(false)}><Pressable style={styles.modalSheet} onPress={event => event.stopPropagation()}><Text style={styles.modalTitle}>{t('home.myPayroll.chooseMonth')}</Text><View style={styles.monthGrid}>{MONTHS.map((name, index) => <Pressable key={name} style={[styles.monthOption, month === index + 1 && styles.monthOptionActive]} onPress={() => { setMonth(index + 1); setMonthPickerVisible(false); }}><Text style={[styles.monthOptionText, month === index + 1 && styles.monthOptionTextActive]}>{name.slice(0, 3)}</Text></Pressable>)}</View><Pressable style={styles.clearMonth} onPress={() => { setMonth(null); setMonthPickerVisible(false); }}><Text style={styles.clearMonthText}>{t('home.myPayroll.allMonths')}</Text></Pressable></Pressable></Pressable>
      </Modal>
      <Modal visible={yearPickerVisible} transparent animationType="slide" onRequestClose={() => setYearPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setYearPickerVisible(false)}><Pressable style={styles.modalSheet} onPress={event => event.stopPropagation()}><Text style={styles.modalTitle}>{t('home.myPayroll.chooseYear')}</Text><View style={styles.monthGrid}>{years.map(value => <Pressable key={value} style={[styles.monthOption, year === value && styles.monthOptionActive]} onPress={() => { setYear(value); setYearPickerVisible(false); }}><Text style={[styles.monthOptionText, year === value && styles.monthOptionTextActive]}>{value}</Text></Pressable>)}</View></Pressable></Pressable>
      </Modal>
    </SafeAreaView>
  );
}
