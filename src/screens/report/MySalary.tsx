import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useMySalary } from '@src/hooks/useMySalary';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { MySalaryComponentLine, SalaryCalcType } from '@src/types/salary';
import { formatLedgerAmount } from '@src/utils/ledgerFormat';

type Props = NativeStackScreenProps<HomeStackParamList, 'MySalary'>;

const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_YEAR = new Date().getFullYear();

type StatTheme = {
  accent: string;
  tint: string;
  border: string;
  icon: IconProps['name'];
};

const STAT_THEMES = {
  base: {
    accent: '#4f46e5',
    tint: '#eef2ff',
    border: '#c7d2fe',
    icon: 'cash',
  },
  earnings: {
    accent: '#059669',
    tint: '#d1fae5',
    border: '#a7f3d0',
    icon: 'trending-up',
  },
  deductions: {
    accent: '#e11d48',
    tint: '#ffe4e6',
    border: '#fecdd3',
    icon: 'trending-down',
  },
} as const satisfies Record<string, StatTheme>;

function formatCalcHint(calcType: SalaryCalcType, calcValue: number): string {
  if (calcType === 'percentage') {
    return `${calcValue}%`;
  }
  return formatLedgerAmount(calcValue);
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const screenBg = isDark ? colors.background : '#f1f5f9';
  const cardBg = isDark ? colors.surface : '#ffffff';
  const heroBg = isDark ? '#1e3a5f' : '#0f766e';

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
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    heroCard: {
      backgroundColor: heroBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#0f766e',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.35 : 0.22,
          shadowRadius: 16,
        },
        android: { elevation: 6 },
      }),
    },
    heroOrb: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.08)',
      top: -28,
      right: -24,
    },
    heroOrbSmall: {
      position: 'absolute',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.06)',
      bottom: -12,
      left: 24,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    heroIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroEyebrow: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.82)',
      letterSpacing: 0.2,
    },
    heroValue: {
      fontSize: 32,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.4,
    },
    heroCaption: {
      marginTop: 6,
      fontSize: 12,
      color: 'rgba(255,255,255,0.72)',
      lineHeight: 17,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 14,
      minHeight: 96,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    noteBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: isDark ? '#0f172a' : '#fffbeb',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#fde68a',
      padding: 14,
      marginBottom: 18,
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? colors.textMuted : '#92400e',
      lineHeight: 19,
    },
    sectionBlock: {
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    sectionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    sectionCount: {
      marginLeft: 'auto',
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    componentCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.18 : 0.04,
          shadowRadius: 6,
        },
        android: { elevation: 1 },
      }),
    },
    componentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    componentRowLast: {
      borderBottomWidth: 0,
    },
    rowIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    componentMain: { flex: 1, minWidth: 0 },
    componentName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    componentMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
      lineHeight: 17,
    },
    amountPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      minWidth: 72,
      alignItems: 'flex-end',
    },
    componentAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    emptyRow: {
      paddingHorizontal: 14,
      paddingVertical: 18,
    },
    emptyRowText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    centerBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 56,
      paddingHorizontal: 28,
      gap: 12,
    },
    centerIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    error: {
      fontSize: 15,
      color: colors.danger,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    loadingBox: {
      paddingVertical: 56,
      alignItems: 'center',
    },
  });
}

type ScreenStyles = ReturnType<typeof buildStyles>;

function themedIconBg(scheme: 'light' | 'dark', theme: StatTheme): string {
  return scheme === 'dark' ? `${theme.accent}22` : theme.tint;
}

function themedIconBorder(scheme: 'light' | 'dark', theme: StatTheme): string {
  return scheme === 'dark' ? `${theme.accent}44` : theme.border;
}

function StatCard({
  label,
  value,
  theme,
  scheme,
  styles,
  valueColor,
}: {
  label: string;
  value: string;
  theme: StatTheme;
  scheme: 'light' | 'dark';
  styles: ScreenStyles;
  valueColor?: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: themedIconBorder(scheme, theme) }]}>
      <View
        style={[
          styles.statIconWrap,
          { backgroundColor: themedIconBg(scheme, theme) },
        ]}>
        <MaterialCommunityIcons name={theme.icon} size={20} color={theme.accent} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SalaryComponentRow({
  item,
  styles,
  scheme,
  calcHintLabel,
  taxableLabel,
  statutoryLabel,
  isEarning,
  isLast = false,
}: {
  item: MySalaryComponentLine;
  styles: ScreenStyles;
  scheme: 'light' | 'dark';
  calcHintLabel: string;
  taxableLabel: string;
  statutoryLabel: string;
  isEarning: boolean;
  isLast?: boolean;
}) {
  const theme = isEarning ? STAT_THEMES.earnings : STAT_THEMES.deductions;
  const flags = [
    item.is_taxable ? taxableLabel : null,
    item.is_statutory ? statutoryLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.componentRow, isLast && styles.componentRowLast]}>
      <View
        style={[
          styles.rowIconWrap,
          { backgroundColor: themedIconBg(scheme, theme) },
        ]}>
        <MaterialCommunityIcons
          name={isEarning ? 'plus-circle-outline' : 'minus-circle-outline'}
          size={20}
          color={theme.accent}
        />
      </View>
      <View style={styles.componentMain}>
        <Text style={styles.componentName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.componentMeta} numberOfLines={2}>
          {item.code} · {calcHintLabel}: {formatCalcHint(item.calc_type, item.calc_value)}
          {flags ? ` · ${flags}` : ''}
        </Text>
        {item.remark?.trim() ? (
          <Text style={styles.componentMeta} numberOfLines={2}>
            {item.remark.trim()}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.amountPill,
          { backgroundColor: themedIconBg(scheme, theme) },
        ]}>
        <Text style={[styles.componentAmount, { color: theme.accent }]}>
          {formatLedgerAmount(item.amount)}
        </Text>
      </View>
    </View>
  );
}

export function MySalaryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const isEmployee = selectedCompany?.relation === 'employee';
  const { props: statusAlertProps, presentError } = useStatusAlert();

  const onSalaryError = useCallback(
    (message: string) => {
      presentError({
        title: t('home.mySalary.apiErrorTitle'),
        message,
      });
    },
    [presentError, t],
  );

  const { data, loading, refreshing, error, notFound, refresh, retry } = useMySalary({
    companyId,
    month: CURRENT_MONTH,
    year: CURRENT_YEAR,
    enabled: isEmployee,
    onError: onSalaryError,
  });

  const showInitialLoading = loading && !data && !notFound && !error;

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.mySalary.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('home.mySalary.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh().catch(() => {});
            }}
            tintColor={colors.primary}
          />
        }>
        {companyId == null ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIconWrap}>
              <MaterialCommunityIcons
                name="office-building-outline"
                size={34}
                color={STAT_THEMES.base.accent}
              />
            </View>
            <Text style={styles.muted}>{t('home.mySalary.noCompany')}</Text>
          </View>
        ) : !isEmployee ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIconWrap}>
              <MaterialCommunityIcons
                name="account-off-outline"
                size={34}
                color={STAT_THEMES.deductions.accent}
              />
            </View>
            <Text style={styles.muted}>{t('home.mySalary.notEmployee')}</Text>
          </View>
        ) : showInitialLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : notFound ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIconWrap}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={34}
                color={colors.textMuted}
              />
            </View>
            <Text style={styles.muted}>{t('home.mySalary.notFound')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIconWrap}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={34}
                color={colors.danger}
              />
            </View>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.retryLabel}>{t('home.mySalary.retry')}</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroOrb} />
              <View style={styles.heroOrbSmall} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons name="wallet-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.heroEyebrow}>{t('home.mySalary.netSalary')}</Text>
              </View>
              <Text style={styles.heroValue}>{formatLedgerAmount(data.net_salary)}</Text>
              <Text style={styles.heroCaption}>{t('home.mySalary.heroCaption')}</Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label={t('home.mySalary.baseAmount')}
                value={formatLedgerAmount(data.base_amount)}
                theme={STAT_THEMES.base}
                scheme={resolvedScheme}
                styles={styles}
              />
              <StatCard
                label={t('home.mySalary.totalEarnings')}
                value={formatLedgerAmount(data.total_earnings)}
                theme={STAT_THEMES.earnings}
                scheme={resolvedScheme}
                styles={styles}
                valueColor={STAT_THEMES.earnings.accent}
              />
              <StatCard
                label={t('home.mySalary.totalDeductions')}
                value={formatLedgerAmount(data.total_deductions)}
                theme={STAT_THEMES.deductions}
                scheme={resolvedScheme}
                styles={styles}
                valueColor={STAT_THEMES.deductions.accent}
              />
            </View>

            <View style={styles.noteBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={resolvedScheme === 'dark' ? colors.textMuted : '#d97706'}
              />
              <Text style={styles.noteText}>{t('home.mySalary.previewNote')}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    {
                      backgroundColor: themedIconBg(resolvedScheme, STAT_THEMES.earnings),
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name="cash-plus"
                    size={18}
                    color={STAT_THEMES.earnings.accent}
                  />
                </View>
                <Text style={styles.sectionTitle}>{t('home.mySalary.earnings')}</Text>
                <Text style={styles.sectionCount}>{data.earnings.length}</Text>
              </View>
              <View style={styles.componentCard}>
                {data.earnings.length > 0 ? (
                  data.earnings.map((item, index) => (
                    <SalaryComponentRow
                      key={item.component_id}
                      item={item}
                      styles={styles}
                      scheme={resolvedScheme}
                      isEarning
                      calcHintLabel={t('home.mySalary.calcValue')}
                      taxableLabel={t('home.mySalary.taxable')}
                      statutoryLabel={t('home.mySalary.statutory')}
                      isLast={index === data.earnings.length - 1}
                    />
                  ))
                ) : (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyRowText}>{t('home.mySalary.noEarnings')}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    {
                      backgroundColor: themedIconBg(resolvedScheme, STAT_THEMES.deductions),
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name="cash-minus"
                    size={18}
                    color={STAT_THEMES.deductions.accent}
                  />
                </View>
                <Text style={styles.sectionTitle}>{t('home.mySalary.deductions')}</Text>
                <Text style={styles.sectionCount}>{data.deductions.length}</Text>
              </View>
              <View style={styles.componentCard}>
                {data.deductions.length > 0 ? (
                  data.deductions.map((item, index) => (
                    <SalaryComponentRow
                      key={item.component_id}
                      item={item}
                      styles={styles}
                      scheme={resolvedScheme}
                      isEarning={false}
                      calcHintLabel={t('home.mySalary.calcValue')}
                      taxableLabel={t('home.mySalary.taxable')}
                      statutoryLabel={t('home.mySalary.statutory')}
                      isLast={index === data.deductions.length - 1}
                    />
                  ))
                ) : (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyRowText}>{t('home.mySalary.noDeductions')}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
