import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
    buildLedgerListStyles,
    LEDGER_ACCENT,
    LedgerListSkeleton,
    LedgerRow,
    SummaryCard,
} from '@src/components/ledger/ledgerListUi';
import { DateRangePicker } from '@src/components/modals/DateRangePicker';
import {
    StatusAlert,
    useStatusAlert,
} from '@src/components/modals/StatusAlert';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useMyLedger } from '@src/hooks/useMyLedger';
import type { HomeStackParamList } from '@src/navigation/types';
import {
    LEDGER_TRANSACTION_TYPES,
    type LedgerTransaction,
    type LedgerTransactionType,
} from '@src/types/companyLedger';
import { todayIso } from '@src/utils/attendanceListDisplay';
import {
    formatLedgerAmount,
    formatLedgerShortDate,
    humanizeLedgerKey,
    ledgerBalanceColor,
} from '@src/utils/ledgerFormat';

type Props = NativeStackScreenProps<HomeStackParamList, 'Ledger'>;

export function LedgerScreen({ navigation }: Props) {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(
        () => buildLedgerListStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;
    const isEmployee = selectedCompany?.relation === 'employee';
    const { props: statusProps, presentError } = useStatusAlert();

    const [fromDate, setFromDate] = useState<string | null>(null);
    const [toDate, setToDate] = useState<string | null>(null);
    const [transactionType, setTransactionType] =
        useState<LedgerTransactionType | null>(null);
    const [dateRangePickerVisible, setDateRangePickerVisible] = useState(false);

    const onLedgerError = useCallback(
        (msg: string) =>
            presentError({
                title: t('home.myLedger.apiErrorTitle'),
                message: msg,
            }),
        [presentError, t],
    );

    const ledger = useMyLedger({
        companyId,
        enabled: isEmployee,
        fromDate,
        toDate,
        transactionType,
        onError: onLedgerError,
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

    const handleDateRangeClear = useCallback(() => {
        clearDateRange();
        setDateRangePickerVisible(false);
    }, [clearDateRange]);

    const dateRangeLabel = useMemo(() => {
        if (fromDate != null && toDate != null) {
            return `${formatLedgerShortDate(fromDate)} – ${formatLedgerShortDate(toDate)}`;
        }
        return t('home.myLedger.dateRange');
    }, [fromDate, toDate, t]);

    const renderItem = useCallback(
        ({ item }: { item: LedgerTransaction }) => (
            <LedgerRow
                item={item}
                styles={styles}
                colors={colors}
                oldBalanceLabel={t('home.myLedger.oldBalance')}
                amountLabel={t('home.myLedger.amount')}
                newBalanceLabel={t('home.myLedger.newBalance')}
                creditLabel={t('home.myLedger.entryCredit')}
                debitLabel={t('home.myLedger.entryDebit')}
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
                        {openingBalance != null ? (
                            <SummaryCard
                                label={
                                    hasDateRange
                                        ? t('home.myLedger.openingBalance')
                                        : t('home.myLedger.openingBalanceDefault')
                                }
                                value={formatLedgerAmount(openingBalance)}
                                valueColor={ledgerBalanceColor(openingBalance, colors)}
                                styles={styles}
                            />
                        ) : null}
                        <SummaryCard
                            label={t('home.myLedger.totalCredit')}
                            value={formatLedgerAmount(meta.credit)}
                            valueColor="#15803d"
                            styles={styles}
                        />
                        <SummaryCard
                            label={t('home.myLedger.totalDebit')}
                            value={formatLedgerAmount(meta.debit)}
                            valueColor={colors.danger}
                            styles={styles}
                        />
                        <SummaryCard
                            label={t('home.myLedger.net')}
                            value={formatLedgerAmount(meta.net)}
                            valueColor={ledgerBalanceColor(meta.net, colors)}
                            styles={styles}
                        />
                    </View>
                ) : null}

                <View style={styles.filterRow}>
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
                            {t('home.myLedger.allTypes')}
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
                        placeholder={t('home.myLedger.searchPlaceholder')}
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
                    {t('home.myLedger.transactionsTitle')}
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
                    <Text style={styles.muted}>{t('home.myLedger.noCompany')}</Text>
                </View>
            );
        }
        if (!isEmployee) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.myLedger.notEmployee')}</Text>
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
                        <Text style={styles.retryLabel}>{t('home.myLedger.retry')}</Text>
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
                    <Text style={styles.muted}>{t('home.myLedger.empty')}</Text>
                </View>
            );
        }
        return null;
    }, [
        companyId,
        colors.textMuted,
        error,
        isEmployee,
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

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.myLedger.back')}
                />
                <Text
                    style={styles.stackHeaderTitle}
                    numberOfLines={1}
                    accessibilityRole="header"
                >
                    {t('home.myLedger.title')}
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
                            refresh().catch(() => { });
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

            <DateRangePicker
                visible={dateRangePickerVisible}
                fromDate={fromDate}
                toDate={toDate}
                maxDate={todayIso()}
                title={t('home.myLedger.dateRange')}
                locale={i18n.language}
                onDismiss={() => setDateRangePickerVisible(false)}
                onConfirm={handleDateRangeConfirm}
                onClear={handleDateRangeClear}
            />

            <StatusAlert {...statusProps} />
        </SafeAreaView>
    );
}
