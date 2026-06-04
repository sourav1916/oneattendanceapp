import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEDGER_ACCENT } from '@src/components/ledger/ledgerListUi';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { LedgerTransaction } from '@src/types/companyLedger';
import {
  formatLedgerAmount,
  formatLedgerEmployeeLine,
  formatLedgerShortDate,
  formatSignedLedgerAmount,
  humanizeLedgerKey,
  ledgerBalanceColor,
  resolveLedgerEntryType,
} from '@src/utils/ledgerFormat';

export type LedgerTransactionDetailModalProps = {
  visible: boolean;
  transaction: LedgerTransaction | null;
  showEmployee?: boolean;
  onDismiss: () => void;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    centerWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    card: {
      maxHeight: '88%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 14,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
    },
    scrollBody: {
      maxHeight: 420,
    },
    summaryStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(15,23,42,0.55)' : '#f8fafc',
      borderWidth: 1,
      borderColor: dark ? '#334155' : colors.border,
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
    },
    summaryLabel: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    amountHighlight: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 84,
      alignItems: 'center',
    },
    amountHighlightCredit: {
      backgroundColor: dark ? 'rgba(34,197,94,0.15)' : '#ecfdf5',
      borderColor: dark ? 'rgba(74,222,128,0.35)' : '#86efac',
    },
    amountHighlightDebit: {
      backgroundColor: dark ? 'rgba(239,68,68,0.12)' : '#fff1f2',
      borderColor: dark ? 'rgba(248,113,113,0.35)' : '#fecaca',
    },
    amountHighlightNeutral: {
      backgroundColor: dark ? '#334155' : colors.secondaryButton,
      borderColor: colors.border,
    },
    amountHighlightText: {
      fontSize: 13,
      fontWeight: '800',
    },
    row: {
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    value: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 20,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(13,148,136,0.18)' : '#ccfbf1',
      borderWidth: 1,
      borderColor: dark ? 'rgba(45,212,191,0.35)' : '#99f6e4',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: dark ? '#5eead4' : '#0f766e',
    },
    entryChipCredit: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
      borderWidth: 1,
      borderColor: dark ? 'rgba(74,222,128,0.35)' : '#bbf7d0',
    },
    entryChipDebit: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(248,113,113,0.35)' : '#fecaca',
    },
    entryChipTextCredit: {
      fontSize: 11,
      fontWeight: '700',
      color: dark ? '#4ade80' : '#15803d',
    },
    entryChipTextDebit: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.danger,
    },
    employeeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(13,148,136,0.12)' : '#f0fdfa',
      borderWidth: 1,
      borderColor: dark ? 'rgba(45,212,191,0.25)' : '#ccfbf1',
    },
    employeeAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: dark ? 'rgba(13,148,136,0.25)' : '#ccfbf1',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    employeeAvatarImage: {
      width: 44,
      height: 44,
    },
    employeeAvatarText: {
      fontSize: 15,
      fontWeight: '700',
      color: LEDGER_ACCENT,
    },
    employeeMain: {
      flex: 1,
      minWidth: 0,
    },
    employeeName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    employeeSub: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
    },
    closeBtn: {
      marginTop: 6,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    closeBtnPressed: {
      opacity: 0.88,
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

function employeeInitials(name: string): string {
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

export function LedgerTransactionDetailModal({
  visible,
  transaction,
  showEmployee = false,
  onDismiss,
}: LedgerTransactionDetailModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  if (!transaction) {
    return null;
  }

  const entryType = resolveLedgerEntryType(transaction);
  const signedAmount = formatSignedLedgerAmount(transaction.amount, entryType);
  const amountStyle =
    entryType === 'credit'
      ? styles.amountHighlightDebit
      : entryType === 'debit'
        ? styles.amountHighlightCredit
        : styles.amountHighlightNeutral;
  const amountTextStyle =
    entryType === 'credit'
      ? styles.entryChipTextDebit
      : entryType === 'debit'
        ? styles.entryChipTextCredit
        : styles.summaryValue;

  const employee = transaction.employee;
  const employeeContact =
    employee?.email?.trim() || employee?.mobile?.trim() || null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.safe}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header">
              {t('modals.ledgerTransactionDetail.title')}
            </Text>

            <ScrollView
              style={styles.scrollBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {humanizeLedgerKey(transaction.transaction_type)}
                  </Text>
                </View>
                {entryType === 'credit' ? (
                  <View style={styles.entryChipCredit}>
                    <Text style={styles.entryChipTextCredit}>
                      {t('home.companyLedger.entryCredit')}
                    </Text>
                  </View>
                ) : null}
                {entryType === 'debit' ? (
                  <View style={styles.entryChipDebit}>
                    <Text style={styles.entryChipTextDebit}>
                      {t('home.companyLedger.entryDebit')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {showEmployee && employee?.name?.trim() ? (
                <View style={styles.employeeCard}>
                  <View style={styles.employeeAvatar}>
                    {employee.profile_picture?.trim() ? (
                      <Image
                        source={{ uri: employee.profile_picture.trim() }}
                        style={styles.employeeAvatarImage}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Text style={styles.employeeAvatarText}>
                        {employeeInitials(employee.name)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.employeeMain}>
                    <Text style={styles.employeeName} numberOfLines={2}>
                      {formatLedgerEmployeeLine(employee)}
                    </Text>
                    {employeeContact ? (
                      <Text style={styles.employeeSub} numberOfLines={1}>
                        {employeeContact}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.summaryStrip}>
                <View style={styles.summaryCol}>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: ledgerBalanceColor(transaction.old_balance, colors) },
                    ]}
                    numberOfLines={1}
                  >
                    {formatLedgerAmount(transaction.old_balance)}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {t('home.companyLedger.oldBalance')}
                  </Text>
                </View>
                <View style={[styles.amountHighlight, amountStyle]}>
                  <Text style={[styles.amountHighlightText, amountTextStyle]}>
                    {signedAmount}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {t('home.companyLedger.amount')}
                  </Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: ledgerBalanceColor(transaction.new_balance, colors) },
                    ]}
                    numberOfLines={1}
                  >
                    {formatLedgerAmount(transaction.new_balance)}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {t('home.companyLedger.newBalance')}
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('modals.ledgerTransactionDetail.transactionDate')}
                </Text>
                <Text style={styles.value}>
                  {formatLedgerShortDate(transaction.transaction_date)}
                </Text>
              </View>

              {transaction.remarks?.trim() ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('modals.ledgerTransactionDetail.remarks')}
                  </Text>
                  <Text style={styles.value}>{transaction.remarks.trim()}</Text>
                </View>
              ) : null}

              {transaction.create_by?.name ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.companyLedger.createdBy')}
                  </Text>
                  <Text style={styles.value}>{transaction.create_by.name}</Text>
                  {transaction.create_by.email ? (
                    <Text style={styles.employeeSub}>
                      {transaction.create_by.email}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {transaction.modify_by?.name ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('modals.ledgerTransactionDetail.modifiedBy')}
                  </Text>
                  <Text style={styles.value}>{transaction.modify_by.name}</Text>
                </View>
              ) : null}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed,
              ]}
            >
              <Text style={styles.closeBtnText}>
                {t('modals.ledgerTransactionDetail.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
