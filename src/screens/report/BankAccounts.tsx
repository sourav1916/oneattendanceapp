import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Easing,
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

import { bankAccountApi } from '@src/api/bankAccountApi';
import { BankAccountFormModal } from '@src/components/modals/BankAccountFormModal';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useMyBankAccounts } from '@src/hooks/useMyBankAccounts';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { BankAccountListItem, EmployeeAccountType } from '@src/types/bankAccount';
import {
  accountDisplayLine,
  accountTypeLabelKey,
} from '@src/utils/bankAccountValidation';
import { readApiError } from '@src/utils/readApiError';
import { resolveMyEmployeeId } from '@src/utils/resolveMyEmployeeId';

type Props = NativeStackScreenProps<HomeStackParamList, 'BankAccounts'>;

const TYPE_ICONS: Record<EmployeeAccountType, IconProps['name']> = {
  savings: 'piggy-bank-outline',
  current: 'bank-outline',
  upi: 'qrcode',
};

const TYPE_THEMES: Record<EmployeeAccountType, { accent: string; tint: string }> = {
  savings: { accent: '#2563eb', tint: '#dbeafe' },
  current: { accent: '#7c3aed', tint: '#ede9fe' },
  upi: { accent: '#0891b2', tint: '#cffafe' },
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const cardBg = isDark ? colors.surface : '#ffffff';

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: isDark ? colors.background : '#f1f5f9' },
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
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)',
    },
    addBtnPressed: { opacity: 0.88 },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 14,
    },
    centerBox: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    centerIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
    error: { fontSize: 15, color: colors.danger, textAlign: 'center', lineHeight: 22 },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryBtnPressed: { opacity: 0.9 },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.16 : 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    cardPrimary: {
      borderColor: '#0d9488',
      backgroundColor: isDark ? '#0f172a' : '#f0fdfa',
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: '#0d9488',
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    cardSub: { marginTop: 3, fontSize: 12, color: colors.textMuted },
    cardMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: 4 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    iconBtnPrimary: {
      borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)',
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
    },
    iconBtnDanger: {
      borderColor: '#fecaca',
      backgroundColor: isDark ? '#450a0a' : '#fff1f2',
    },
    iconBtnPressed: { opacity: 0.85 },
    iconBtnDisabled: {
      opacity: 0.5,
    },
    skPulseBase: { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
    skCard: {
      backgroundColor: cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
    },
    skRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    skIcon: { width: 40, height: 40, borderRadius: 12 },
    skBody: { flex: 1, gap: 8 },
    skLine: { height: 12, borderRadius: 6 },
    skLineMd: { width: '48%' },
    skLineLg: { width: '72%' },
  });
}

function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return useMemo(
    () => ({
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.72] }),
    }),
    [pulse],
  );
}

function ListSkeleton({ styles }: { styles: ReturnType<typeof buildStyles> }) {
  const pulseStyle = useSkeletonPulse();
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={`sk-${i}`} style={styles.skCard}>
          <View style={styles.skRow}>
            <Animated.View style={[styles.skIcon, styles.skPulseBase, pulseStyle]} />
            <View style={styles.skBody}>
              <Animated.View style={[styles.skLine, styles.skLineMd, styles.skPulseBase, pulseStyle]} />
              <Animated.View style={[styles.skLine, styles.skLineLg, styles.skPulseBase, pulseStyle]} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

function BankAccountCard({
  account,
  styles,
  scheme,
  onEdit,
  onDelete,
  deleting,
}: {
  account: BankAccountListItem;
  styles: ReturnType<typeof buildStyles>;
  scheme: 'light' | 'dark';
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const theme = TYPE_THEMES[account.account_type];
  const iconBg = scheme === 'dark' ? `${theme.accent}22` : theme.tint;

  return (
    <View style={[styles.card, account.is_primary && styles.cardPrimary]}>
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons
            name={TYPE_ICONS[account.account_type]}
            size={20}
            color={theme.accent}
          />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{t(accountTypeLabelKey(account.account_type))}</Text>
            {account.is_primary ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t('settings.bankAccounts.primaryBadge')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardSub} numberOfLines={2}>
            {accountDisplayLine(account)}
          </Text>
          {account.account_holder_name ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {account.account_holder_name}
            </Text>
          ) : null}
          {account.ifsc_code ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {t('settings.bankAccounts.ifscShort', { code: account.ifsc_code })}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnPrimary,
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.bankAccounts.editA11y')}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            disabled={deleting}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnDanger,
              pressed && !deleting && styles.iconBtnPressed,
              deleting && styles.iconBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.bankAccounts.deleteA11y')}>
            {deleting ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <MaterialCommunityIcons name="delete-outline" size={18} color="#e11d48" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function BankAccountsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany, profileRole } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const isEmployee = selectedCompany?.relation === 'employee';
  const employeeId =
    resolveMyEmployeeId(profileRole, companyId) ??
    null;

  const { props: confirmProps, present } = useConfirmAlert();
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAccount, setEditingAccount] = useState<BankAccountListItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { accounts, loading, refreshing, error, refresh, retry, reload } = useMyBankAccounts({
    companyId,
    enabled: isEmployee && companyId != null,
  });

  const showSkeleton = loading || refreshing;
  const resolvedEmployeeId = employeeId ?? accounts[0]?.employee_id ?? null;

  const openCreate = useCallback(() => {
    setFormMode('create');
    setEditingAccount(null);
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((account: BankAccountListItem) => {
    setFormMode('edit');
    setEditingAccount(account);
    setFormVisible(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    setEditingAccount(null);
  }, []);

  const handleSaved = useCallback(() => {
    reload().catch(() => { });
  }, [reload]);

  const confirmDelete = useCallback(
    (account: BankAccountListItem) => {
      present({
        title: t('settings.bankAccounts.deleteConfirmTitle'),
        message: t('settings.bankAccounts.deleteConfirmMessage'),
        buttons: [
          { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
          {
            key: 'delete',
            text: t('settings.bankAccounts.deleteConfirmAction'),
            variant: 'danger',
            onPress: () => {
              if (companyId == null) {
                return;
              }
              setDeletingId(account.bank_account_id);
              bankAccountApi
                .deleteAccount(companyId, { bank_id: account.bank_account_id })
                .then(res => {
                  if (!res.success) {
                    present({
                      title: t('settings.bankAccounts.errors.deleteFailedTitle'),
                      message: res.message?.trim() || t('settings.bankAccounts.errors.deleteFailed'),
                      buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                    });
                    return;
                  }
                  reload().catch(() => { });
                })
                .catch(e => {
                  present({
                    title: t('settings.bankAccounts.errors.deleteFailedTitle'),
                    message: readApiError(e),
                    buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                  });
                })
                .finally(() => {
                  setDeletingId(null);
                });
            },
          },
        ],
      });
    },
    [companyId, present, reload, t],
  );

  const canAdd = isEmployee && companyId != null && resolvedEmployeeId != null;

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('settings.bankAccounts.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('settings.bankAccounts.title')}
        </Text>
        {canAdd ? (
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.bankAccounts.addA11y')}>
            <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !loading}
            onRefresh={() => {
              refresh().catch(() => { });
            }}
            tintColor={colors.primary}
          />
        }>
        <Text style={styles.intro}>{t('settings.bankAccounts.subtitle')}</Text>

        {companyId == null ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="office-building-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.muted}>{t('settings.bankAccounts.noCompany')}</Text>
          </View>
        ) : !isEmployee ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="account-off-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.muted}>{t('settings.bankAccounts.notEmployee')}</Text>
          </View>
        ) : showSkeleton ? (
          <ListSkeleton styles={styles} />
        ) : error ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.danger} />
            </View>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              onPress={retry}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
              accessibilityRole="button">
              <Text style={styles.retryLabel}>{t('settings.bankAccounts.retry')}</Text>
            </Pressable>
          </View>
        ) : accounts.length === 0 ? (
          <View style={styles.centerBox}>
            <View style={styles.centerIcon}>
              <MaterialCommunityIcons name="bank-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.muted}>{t('settings.bankAccounts.empty')}</Text>
            {canAdd ? (
              <Pressable
                onPress={openCreate}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
                accessibilityRole="button">
                <Text style={styles.retryLabel}>{t('settings.bankAccounts.addAccount')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          accounts.map(account => (
            <BankAccountCard
              key={account.bank_account_id}
              account={account}
              styles={styles}
              scheme={resolvedScheme}
              onEdit={() => openEdit(account)}
              onDelete={() => confirmDelete(account)}
              deleting={deletingId === account.bank_account_id}
            />
          ))
        )}
      </ScrollView>

      {canAdd ? (
        <BankAccountFormModal
          visible={formVisible}
          mode={formMode}
          account={editingAccount}
          companyId={companyId}
          employeeId={resolvedEmployeeId}
          onDismiss={closeForm}
          onSaved={handleSaved}
        />
      ) : null}

      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
