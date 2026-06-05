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
import type { EmployeeLeaveRow } from '@src/types/employeeLeave';

const REMARKS_MAX = 1000;
const T = 'home.leaveRequests.actions.rejectModal.';

export type RejectLeaveModalProps = {
  visible: boolean;
  leave: EmployeeLeaveRow | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (remarks: string) => void;
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
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 14,
    },
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
      minHeight: 88,
      textAlignVertical: 'top',
    },
    error: { fontSize: 12, color: '#dc2626', marginTop: 6 },
    charCount: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
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
    btnDanger: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: '#dc2626',
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnDangerLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.55 },
  });
}

export function RejectLeaveModal({
  visible,
  leave,
  submitting,
  onDismiss,
  onSubmit,
}: RejectLeaveModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRemarks('');
      setError(null);
    }
  }, [visible, leave?.id]);

  const handleSubmit = useCallback(() => {
    const trimmed = remarks.trim();
    if (trimmed.length > REMARKS_MAX) {
      setError(t(`${T}remarksTooLong`, { max: REMARKS_MAX }));
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }, [onSubmit, remarks, t]);

  if (!leave) {
    return null;
  }

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
            <Text style={styles.subtitle}>
              {t(`${T}message`, { name: leave.employee_name })}
            </Text>
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
            <Text style={styles.charCount}>
              {remarks.length}/{REMARKS_MAX}
            </Text>
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
                style={[styles.btnDanger, submitting && styles.btnDisabled]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnDangerLabel}>{t(`${T}confirm`)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
