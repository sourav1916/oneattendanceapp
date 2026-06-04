import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { DateRangePicker } from '@src/components/modals/DateRangePicker';
import { LedgerTransactionDetailModal } from '@src/components/modals/LedgerTransactionDetailModal';
import {
  LedgerRow,
  LedgerListSkeleton,
  SummaryCard,
  buildLedgerListStyles,
  LEDGER_ACCENT,
  type LedgerListStyles,
} from '@src/components/ledger/ledgerListUi';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useCompanyLedger } from '@src/hooks/useCompanyLedger';
import { useEmployeePickerList } from '@src/hooks/useEmployeePickerList';
import type { HomeStackParamList } from '@src/navigation/types';
import {
  LEDGER_TRANSACTION_TYPES,
  type LedgerTransaction,
  type LedgerTransactionType,
} from '@src/types/companyLedger';
import type { EmployeeListItem } from '@src/types/employeeList';
import { todayIso } from '@src/utils/attendanceListDisplay';
import {
  formatLedgerAmount,
  formatLedgerShortDate,
  humanizeLedgerKey,
  ledgerBalanceColor,
} from '@src/utils/ledgerFormat';

type Props = NativeStackScreenProps<HomeStackParamList, 'CompanyLedger'>;

type SelectedEmployee = {
  id: number;
  name: string;
  employeeCode: string;
};

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

const EmployeePickerRow = React.memo(function EmployeePickerRow({
  item,
  styles,
  onPress,
}: {
  item: EmployeeListItem;
  styles: LedgerListStyles;
  onPress: () => void;
}) {
  const contact = item.email?.trim() || item.phone?.trim() || '—';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.employeeRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.employeeMain}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.code} numberOfLines={1}>
            {item.employee_code}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {contact}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={LEDGER_ACCENT} />
      </View>
    </Pressable>
  );
});

export function CompanyLedgerScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildLedgerListStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusProps, presentError } = useStatusAlert();

  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(
    null,
  );
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [transactionType, setTransactionType] =
    useState<LedgerTransactionType | null>(null);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [dateRangePickerVisible, setDateRangePickerVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<LedgerTransaction | null>(null);

  const onLedgerError = useCallback(
    (msg: string) =>
      presentError({
        title: t('home.companyLedger.apiErrorTitle'),
        message: msg,
      }),
    [presentError, t],
  );

  const onPickerError = useCallback(
    (msg: string) =>
      presentError({
        title: t('home.companyLedger.apiErrorTitle'),
        message: msg,
      }),
    [presentError, t],
  );

  const ledger = useCompanyLedger({
    companyId,
    employeeId: selectedEmployee?.id ?? null,
    fromDate,
    toDate,
    transactionType,
    onError: onLedgerError,
  });

  const picker = useEmployeePickerList({
    companyId: employeeModalVisible ? companyId : null,
    onError: onPickerError,
  });

  const {
    transactions,
    openingBalance,
    meta,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    tryLoadMore,
    retry,
    hasDateRange,
  } = ledger;

  const showInitialLoading = loading && transactions.length === 0;

  const handleDateRangeConfirm = useCallback((from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setDateRangePickerVisible(false);
  }, []);

  const clearDateRange = useCallback(() => {
    setFromDate(null);
    setToDate(null);
  }, []);

  const dateRangeLabel = useMemo(() => {
    if (fromDate != null && toDate != null) {
      return `${formatLedgerShortDate(fromDate)} – ${formatLedgerShortDate(toDate)}`;
    }
    return t('home.companyLedger.dateRange');
  }, [fromDate, toDate, t]);

  const renderItem = useCallback(
    ({ item }: { item: LedgerTransaction }) => (
      <LedgerRow
        item={item}
        styles={styles}
        colors={colors}
        showEmployee
        onPress={() => setSelectedTransaction(item)}
        oldBalanceLabel={t('home.companyLedger.oldBalance')}
        amountLabel={t('home.companyLedger.amount')}
        newBalanceLabel={t('home.companyLedger.newBalance')}
        creditLabel={t('home.companyLedger.entryCredit')}
        debitLabel={t('home.companyLedger.entryDebit')}
      />
    ),
    [colors, styles, t],
  );

  const keyExtractor = useCallback(
    (item: LedgerTransaction) => String(item.id),
    [],
  );

  const listHeader = useMemo(
    () => (
      <View>
        {meta != null ? (
          <View style={styles.summaryGrid}>
            {hasDateRange && openingBalance != null ? (
              <SummaryCard
                label={t('home.companyLedger.openingBalance')}
                value={formatLedgerAmount(openingBalance)}
                valueColor={ledgerBalanceColor(openingBalance, colors)}
                styles={styles}
              />
            ) : null}
            <SummaryCard
              label={t('home.companyLedger.totalCredit')}
              value={formatLedgerAmount(meta.credit)}
              valueColor="#15803d"
              styles={styles}
            />
            <SummaryCard
              label={t('home.companyLedger.totalDebit')}
              value={formatLedgerAmount(meta.debit)}
              valueColor={colors.danger}
              styles={styles}
            />
            <SummaryCard
              label={t('home.companyLedger.net')}
              value={formatLedgerAmount(meta.net)}
              valueColor={ledgerBalanceColor(meta.net, colors)}
              styles={styles}
            />
          </View>
        ) : null}

        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEmployeeModalVisible(true)}
            style={({ pressed }) => [
              styles.filterChip,
              selectedEmployee != null && styles.filterChipActive,
              pressed && { opacity: 0.92 },
            ]}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={18}
              color={selectedEmployee != null ? LEDGER_ACCENT : colors.textMuted}
            />
            <Text
              style={[
                styles.filterChipText,
                selectedEmployee != null && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedEmployee?.name ?? t('home.companyLedger.allEmployees')}
            </Text>
          </Pressable>
          {selectedEmployee != null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedEmployee(null)}
              style={styles.clearBtn}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setDateRangePickerVisible(true)}
            style={({ pressed }) => [
              styles.filterChip,
              fromDate != null && toDate != null && styles.filterChipActive,
              pressed && { opacity: 0.92 },
            ]}
          >
            <MaterialCommunityIcons
              name="calendar-range"
              size={18}
              color={
                fromDate != null && toDate != null ? LEDGER_ACCENT : colors.textMuted
              }
            />
            <Text
              style={[
                styles.filterChipText,
                fromDate != null &&
                  toDate != null &&
                  styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {dateRangeLabel}
            </Text>
          </Pressable>
          {fromDate != null || toDate != null ? (
            <Pressable
              accessibilityRole="button"
              onPress={clearDateRange}
              style={styles.clearBtn}
            >
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
          style={styles.typeScroll}
          contentContainerStyle={styles.typeScrollContent}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setTransactionType(null)}
            style={[
              styles.typeChip,
              transactionType == null && styles.typeChipActive,
            ]}
          >
            <Text
              style={[
                styles.typeChipText,
                transactionType == null && styles.typeChipTextActive,
              ]}
            >
              {t('home.companyLedger.allTypes')}
            </Text>
          </Pressable>
          {LEDGER_TRANSACTION_TYPES.map(type => (
            <Pressable
              key={type}
              accessibilityRole="button"
              onPress={() =>
                setTransactionType(prev => (prev === type ? null : type))
              }
              style={[
                styles.typeChip,
                transactionType === type && styles.typeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  transactionType === type && styles.typeChipTextActive,
                ]}
              >
                {humanizeLedgerKey(type)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.companyLedger.searchPlaceholder')}
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
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>
          {t('home.companyLedger.transactionsTitle')}
        </Text>
        {showInitialLoading ? <LedgerListSkeleton styles={styles} /> : null}
      </View>
    ),
    [
      clearDateRange,
      colors,
      dateRangeLabel,
      fromDate,
      hasDateRange,
      meta,
      openingBalance,
      search,
      selectedEmployee,
      setSearch,
      showInitialLoading,
      styles,
      t,
      toDate,
      transactionType,
    ],
  );

  const listEmpty = useMemo(() => {
    if (showInitialLoading) {
      return null;
    }
    if (companyId == null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>{t('home.companyLedger.noCompany')}</Text>
        </View>
      );
    }
    if (error != null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={retry}
            accessibilityRole="button"
          >
            <Text style={styles.retryLabel}>{t('home.companyLedger.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    if (transactions.length === 0) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={40}
            color={colors.textMuted}
          />
          <Text style={styles.muted}>{t('home.companyLedger.empty')}</Text>
        </View>
      );
    }
    return null;
  }, [
    companyId,
    colors.textMuted,
    error,
    retry,
    showInitialLoading,
    styles,
    t,
    transactions.length,
  ]);

  const listFooter = useMemo(() => {
    if (!loadingMore) {
      return null;
    }
    return (
      <View style={styles.footerBox}>
        <ActivityIndicator color={LEDGER_ACCENT} />
      </View>
    );
  }, [loadingMore, styles.footerBox]);

  const renderEmployeeItem = useCallback(
    ({ item }: { item: EmployeeListItem }) => (
      <EmployeePickerRow
        item={item}
        styles={styles}
        onPress={() => {
          setSelectedEmployee({
            id: item.id,
            name: item.name,
            employeeCode: item.employee_code,
          });
          setEmployeeModalVisible(false);
        }}
      />
    ),
    [styles],
  );

  const employeeKeyExtractor = useCallback(
    (item: EmployeeListItem) => String(item.id),
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.companyLedger.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t('home.companyLedger.title')}
        </Text>
      </View>

      <FlatList
        style={styles.fill}
        contentContainerStyle={styles.listContent}
        data={showInitialLoading ? [] : transactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh().catch(() => {});
            }}
            tintColor={LEDGER_ACCENT}
            colors={[LEDGER_ACCENT]}
          />
        }
        onEndReached={tryLoadMore}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={employeeModalVisible}
        animationType="slide"
        onRequestClose={() => setEmployeeModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('home.companyLedger.selectEmployee')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEmployeeModalVisible(false)}
              style={styles.modalClose}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.listContent}
            data={picker.loading ? [] : picker.employees}
            keyExtractor={employeeKeyExtractor}
            renderItem={renderEmployeeItem}
            ListHeaderComponent={
              <View style={styles.searchWrap}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color={colors.textMuted}
                  style={styles.searchIcon}
                />
                <TextInput
                  value={picker.search}
                  onChangeText={picker.setSearch}
                  placeholder={t('home.companyLedger.employeeSearchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
              </View>
            }
            ListEmptyComponent={
              picker.loading ? (
                <LedgerListSkeleton styles={styles} count={4} />
              ) : (
                <View style={styles.centerBox}>
                  <Text style={styles.muted}>
                    {t('home.companyLedger.noEmployees')}
                  </Text>
                </View>
              )
            }
            onEndReached={picker.tryLoadMore}
            onEndReachedThreshold={0.35}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>

      <DateRangePicker
        visible={dateRangePickerVisible}
        fromDate={fromDate}
        toDate={toDate}
        maxDate={todayIso()}
        title={t('home.companyLedger.dateRange')}
        locale={i18n.language}
        onDismiss={() => setDateRangePickerVisible(false)}
        onConfirm={handleDateRangeConfirm}
      />

      <LedgerTransactionDetailModal
        visible={selectedTransaction != null}
        transaction={selectedTransaction}
        showEmployee
        onDismiss={() => setSelectedTransaction(null)}
      />

      <StatusAlert {...statusProps} />
    </SafeAreaView>
  );
}
