import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TAB_SCREEN_SCROLL_PADDING_BOTTOM } from '@src/constants/tabScreenLayout';
import type { AppThemeColors } from '@src/theme/palettes';
import type { LedgerTransaction } from '@src/types/companyLedger';
import {
  formatLedgerAmount,
  formatLedgerShortDate,
  formatSignedLedgerAmount,
  humanizeLedgerKey,
  ledgerBalanceColor,
  resolveLedgerEntryType,
} from '@src/utils/ledgerFormat';

export const LEDGER_ACCENT = '#0d9488';
const SKELETON_ROWS = 5;

export function buildLedgerListStyles(
  colors: AppThemeColors,
  scheme: 'light' | 'dark',
) {
  const dark = scheme === 'dark';

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
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 10,
      minHeight: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.text,
    },
    clearBtn: { padding: 4 },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: '100%',
    },
    filterChipActive: {
      borderColor: LEDGER_ACCENT,
      backgroundColor: dark ? 'rgba(13,148,136,0.18)' : '#ccfbf1',
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    filterChipTextActive: {
      color: dark ? '#5eead4' : '#0f766e',
    },
    typeScroll: { marginBottom: 10 },
    typeScrollContent: { gap: 8, paddingRight: 8 },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    typeChipActive: {
      borderColor: LEDGER_ACCENT,
      backgroundColor: dark ? 'rgba(13,148,136,0.18)' : '#ccfbf1',
    },
    typeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    typeChipTextActive: {
      color: dark ? '#5eead4' : '#0f766e',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    summaryCard: {
      flexGrow: 1,
      flexBasis: '47%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    txnCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      paddingLeft: 14,
      marginBottom: 8,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: dark ? 0.18 : 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    txnCardPressed: {
      opacity: 0.92,
    },
    txnHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    txnHeaderMain: { flex: 1, minWidth: 0 },
    txnDate: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    txnEmployeeName: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '600',
      color: LEDGER_ACCENT,
    },
    txnBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      maxWidth: '52%',
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(13,148,136,0.18)' : '#ccfbf1',
      borderWidth: 1,
      borderColor: dark ? 'rgba(45,212,191,0.35)' : '#99f6e4',
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: dark ? '#5eead4' : '#0f766e',
    },
    entryChipCredit: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
      borderWidth: 1,
      borderColor: dark ? 'rgba(74,222,128,0.35)' : '#bbf7d0',
    },
    entryChipDebit: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(248,113,113,0.35)' : '#fecaca',
    },
    entryChipTextCredit: {
      fontSize: 10,
      fontWeight: '700',
      color: dark ? '#4ade80' : '#15803d',
    },
    entryChipTextDebit: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.danger,
    },
    balanceFlow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: dark ? 'rgba(15,23,42,0.45)' : '#f8fafc',
      borderWidth: 1,
      borderColor: dark ? '#334155' : colors.border,
    },
    balanceFlowCol: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
    },
    balanceFlowLabel: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    balanceFlowValue: {
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    amountPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 72,
      alignItems: 'center',
      marginHorizontal: 2,
    },
    amountPillCredit: {
      backgroundColor: dark ? 'rgba(34,197,94,0.15)' : '#ecfdf5',
      borderColor: dark ? 'rgba(74,222,128,0.35)' : '#86efac',
    },
    amountPillDebit: {
      backgroundColor: dark ? 'rgba(239,68,68,0.12)' : '#fff1f2',
      borderColor: dark ? 'rgba(248,113,113,0.35)' : '#fecaca',
    },
    amountPillNeutral: {
      backgroundColor: dark ? '#334155' : colors.secondaryButton,
      borderColor: colors.border,
    },
    amountPillText: {
      fontSize: 12,
      fontWeight: '800',
    },
    amountPillTextCredit: {
      color: dark ? '#4ade80' : '#15803d',
    },
    amountPillTextDebit: {
      color: colors.danger,
    },
    amountPillTextNeutral: {
      color: colors.text,
    },
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    muted: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    error: {
      fontSize: 14,
      color: colors.danger,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
    footerBox: { paddingVertical: 16, alignItems: 'center' },
    skCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    skBar: {
      height: 14,
      borderRadius: 7,
      backgroundColor: dark ? '#334155' : colors.secondaryButton,
      marginBottom: 8,
    },
    skBarShort: {
      height: 12,
      borderRadius: 6,
      width: '55%',
      backgroundColor: dark ? '#334155' : colors.secondaryButton,
    },
    modalSafe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    modalClose: { padding: 4 },
    employeeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    employeeMain: { flex: 1, minWidth: 0 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: dark ? 'rgba(13,148,136,0.25)' : '#ccfbf1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontWeight: '700', color: LEDGER_ACCENT, fontSize: 15 },
    name: { fontSize: 16, fontWeight: '700', color: colors.text },
    code: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
      color: LEDGER_ACCENT,
    },
    subline: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}

export type LedgerListStyles = ReturnType<typeof buildLedgerListStyles>;

export function LedgerListSkeleton({
  styles,
  count = SKELETON_ROWS,
}: {
  styles: LedgerListStyles;
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
          <View style={styles.skBar} />
          <View style={styles.skBarShort} />
        </View>
      ))}
    </Animated.View>
  );
}

export function SummaryCard({
  label,
  value,
  valueColor,
  styles,
}: {
  label: string;
  value: string;
  valueColor?: string;
  styles: LedgerListStyles;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          valueColor != null ? { color: valueColor } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export const LedgerRow = React.memo(function LedgerRow({
  item,
  styles,
  colors,
  oldBalanceLabel,
  amountLabel,
  newBalanceLabel,
  creditLabel,
  debitLabel,
  showEmployee = false,
  onPress,
}: {
  item: LedgerTransaction;
  styles: LedgerListStyles;
  colors: AppThemeColors;
  oldBalanceLabel: string;
  amountLabel: string;
  newBalanceLabel: string;
  creditLabel: string;
  debitLabel: string;
  showEmployee?: boolean;
  onPress?: () => void;
}) {
  const entryType = resolveLedgerEntryType(item);
  const signedAmount = formatSignedLedgerAmount(item.amount, entryType);
  const pillStyle =
    entryType === 'credit'
      ? styles.amountPillDebit
      : entryType === 'debit'
        ? styles.amountPillCredit
        : styles.amountPillNeutral;
  const pillTextStyle =
    entryType === 'credit'
      ? styles.amountPillTextDebit
      : entryType === 'debit'
        ? styles.amountPillTextCredit
        : styles.amountPillTextNeutral;

  const content = (
    <>
      <View style={styles.txnHeader}>
        <View style={styles.txnHeaderMain}>
          <Text style={styles.txnDate}>
            {formatLedgerShortDate(item.transaction_date)}
          </Text>
          {showEmployee && item.employee?.name?.trim() ? (
            <Text style={styles.txnEmployeeName} numberOfLines={1}>
              {item.employee.name.trim()}
            </Text>
          ) : null}
        </View>
        <View style={styles.txnBadges}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {humanizeLedgerKey(item.transaction_type)}
            </Text>
          </View>
          {entryType === 'credit' ? (
            <View style={styles.entryChipCredit}>
              <Text style={styles.entryChipTextCredit}>{creditLabel}</Text>
            </View>
          ) : null}
          {entryType === 'debit' ? (
            <View style={styles.entryChipDebit}>
              <Text style={styles.entryChipTextDebit}>{debitLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.balanceFlow}>
        <View style={styles.balanceFlowCol}>
          <Text
            style={[
              styles.balanceFlowValue,
              { color: ledgerBalanceColor(item.old_balance, colors) },
            ]}
            numberOfLines={1}
          >
            {formatLedgerAmount(item.old_balance)}
          </Text>
          <Text style={styles.balanceFlowLabel}>{oldBalanceLabel}</Text>
        </View>

        <View style={[styles.amountPill, pillStyle]}>
          <Text style={[styles.amountPillText, pillTextStyle]}>
            {signedAmount}
          </Text>
          <Text style={styles.balanceFlowLabel}>{amountLabel}</Text>
        </View>

        <View style={styles.balanceFlowCol}>
          <Text
            style={[
              styles.balanceFlowValue,
              { color: ledgerBalanceColor(item.new_balance, colors) },
            ]}
            numberOfLines={1}
          >
            {formatLedgerAmount(item.new_balance)}
          </Text>
          <Text style={styles.balanceFlowLabel}>{newBalanceLabel}</Text>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.txnCard,
          pressed && styles.txnCardPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.txnCard}>{content}</View>;
});
