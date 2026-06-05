import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { BulkLeaveAction } from '@src/types/leaveManagement';

const REMARKS_MAX = 255;
const T = 'home.leaveRequests.actions.bulkModal.';

export type BulkLeaveTarget = {
  ids: number[] | 'all';
  count: number;
};

export type BulkLeaveActionModalProps = {
  visible: boolean;
  target: BulkLeaveTarget | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (action: BulkLeaveAction, remarks: string) => void;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    centerWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
        },
        android: { elevation: 12 },
      }),
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 14 },
    actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    actionChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    actionChipApprove: {
      borderColor: '#22c55e',
      backgroundColor: scheme === 'dark' ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
    },
    actionChipReject: {
      borderColor: '#ef4444',
      backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.15)' : '#fef2f2',
    },
    actionChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
    actionChipTextApprove: { color: '#15803d' },
    actionChipTextReject: { color: '#b91c1c' },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 14,
      color: colors.text,
      backgroundColor: scheme === 'dark' ? colors.background : '#f8fafc',
      minHeight: 72,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
    error: { fontSize: 12, color: '#dc2626', marginTop: 6 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    btnSecondary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.55 },
  });
}

export function BulkLeaveActionModal({
  visible,
  target,
  submitting,
  onDismiss,
  onSubmit,
}: BulkLeaveActionModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const [action, setAction] = useState<BulkLeaveAction>('approve');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAction('approve');
      setRemarks('');
      setError(null);
    }
  }, [visible, target?.count]);

  const handleSubmit = useCallback(() => {
    const trimmed = remarks.trim();
    if (trimmed.length > REMARKS_MAX) {
      setError(t(`${T}remarksTooLong`, { max: REMARKS_MAX }));
      return;
    }
    setError(null);
    onSubmit(action, trimmed);
  }, [action, onSubmit, remarks, t]);

  if (!target) {
    return null;
  }

  const countLabel =
    target.ids === 'all'
      ? t(`${T}allPending`)
      : t(`${T}selectedCount`, { count: target.count });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title}>{t(`${T}title`)}</Text>
            <Text style={styles.subtitle}>{countLabel}</Text>

            <Text style={styles.label}>{t(`${T}actionLabel`)}</Text>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: action === 'approve' }}
                onPress={() => setAction('approve')}
                style={[
                  styles.actionChip,
                  action === 'approve' && styles.actionChipApprove,
                ]}>
                <Text
                  style={[
                    styles.actionChipText,
                    action === 'approve' && styles.actionChipTextApprove,
                  ]}>
                  {t(`${T}approve`)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: action === 'reject' }}
                onPress={() => setAction('reject')}
                style={[
                  styles.actionChip,
                  action === 'reject' && styles.actionChipReject,
                ]}>
                <Text
                  style={[
                    styles.actionChipText,
                    action === 'reject' && styles.actionChipTextReject,
                  ]}>
                  {t(`${T}reject`)}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{t(`${T}remarksLabel`)}</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t(`${T}remarksPlaceholder`)}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={REMARKS_MAX}
              style={styles.input}
            />
            <Text style={styles.charCount}>{remarks.length}/{REMARKS_MAX}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onDismiss}
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}>
                <Text style={styles.btnSecondaryLabel}>{t(`${T}cancel`)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleSubmit}
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryLabel}>{t(`${T}confirm`)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
