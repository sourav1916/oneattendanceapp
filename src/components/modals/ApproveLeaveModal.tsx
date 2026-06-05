import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { DatePicker } from '@src/components/modals/DatePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { EmployeeLeaveRow } from '@src/types/employeeLeave';
import type { ApproveEditLeavePayload } from '@src/types/leaveManagement';
import { buildApproveEditPayload } from '@src/utils/leaveApprovePayload';

const T = 'home.leaveRequests.actions.approveModal.';

export type ApproveLeaveModalProps = {
  visible: boolean;
  leave: EmployeeLeaveRow | null;
  submitting: boolean;
  locale: string;
  onDismiss: () => void;
  onSubmit: (payload: ApproveEditLeavePayload) => void;
};

function formatDisplayDate(iso: string): string {
  if (!iso) {
    return '';
  }
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: { flex: 1, justifyContent: 'flex-end', paddingTop: 48 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      maxHeight: '92%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    dateField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: scheme === 'dark' ? colors.background : '#f8fafc',
    },
    dateFieldText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    durationRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    durationChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    durationChipActive: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
    },
    durationChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    durationChipTextActive: { color: colors.primary },
    halfRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    error: { fontSize: 12, color: '#dc2626', marginBottom: 8 },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
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

export function ApproveLeaveModal({
  visible,
  leave,
  submitting,
  locale,
  onDismiss,
  onSubmit,
}: ApproveLeaveModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && leave) {
      setStartDate(leave.start_date);
      setEndDate(leave.end_date);
      setIsHalfDay(leave.is_half_day);
      setHalfDayType(leave.half_day_type ?? 'first_half');
      setError(null);
    }
  }, [visible, leave]);

  const handleSubmit = useCallback(() => {
    if (!leave || leave.status !== 'pending') {
      return;
    }
    if (isHalfDay && startDate !== endDate) {
      setError(t(`${T}halfDaySameDay`));
      return;
    }
    if (startDate > endDate) {
      setError(t(`${T}invalidRange`));
      return;
    }

    const payload = buildApproveEditPayload(leave, {
      startDate,
      endDate,
      isHalfDay,
      halfDayType,
    });
    setError(null);
    onSubmit(payload);
  }, [endDate, isHalfDay, halfDayType, leave, onSubmit, startDate, t]);

  const onSelectHalfDay = useCallback((value: boolean) => {
    setIsHalfDay(value);
    if (value) {
      setEndDate(prev => startDate || prev);
    }
  }, [startDate]);

  if (!leave || leave.status !== 'pending') {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t(`${T}title`)}</Text>
              <Text style={styles.subtitle}>
                {leave.employee_name} · {leave.leave_name}
              </Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}>
              <Text style={styles.label}>{t(`${T}dateRange`)}</Text>
              <View style={styles.dateRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStartPickerVisible(true)}
                  style={styles.dateField}>
                  <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.dateFieldText}>{formatDisplayDate(startDate)}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEndPickerVisible(true)}
                  disabled={isHalfDay}
                  style={[styles.dateField, isHalfDay && styles.btnDisabled]}>
                  <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.dateFieldText}>{formatDisplayDate(endDate)}</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>{t(`${T}duration`)}</Text>
              <View style={styles.durationRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelectHalfDay(false)}
                  style={[styles.durationChip, !isHalfDay && styles.durationChipActive]}>
                  <Text style={[styles.durationChipText, !isHalfDay && styles.durationChipTextActive]}>
                    {t('home.leaveRequest.applyModal.fullDay')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelectHalfDay(true)}
                  style={[styles.durationChip, isHalfDay && styles.durationChipActive]}>
                  <Text style={[styles.durationChipText, isHalfDay && styles.durationChipTextActive]}>
                    {t('home.leaveRequest.applyModal.halfDayLabel')}
                  </Text>
                </Pressable>
              </View>

              {isHalfDay ? (
                <>
                  <Text style={styles.label}>{t(`${T}halfSession`)}</Text>
                  <View style={styles.halfRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setHalfDayType('first_half')}
                      style={[
                        styles.durationChip,
                        halfDayType === 'first_half' && styles.durationChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.durationChipText,
                          halfDayType === 'first_half' && styles.durationChipTextActive,
                        ]}>
                        {t('home.leaveRequest.detailModal.firstHalf')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setHalfDayType('second_half')}
                      style={[
                        styles.durationChip,
                        halfDayType === 'second_half' && styles.durationChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.durationChipText,
                          halfDayType === 'second_half' && styles.durationChipTextActive,
                        ]}>
                        {t('home.leaveRequest.detailModal.secondHalf')}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
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

      <DatePicker
        visible={startPickerVisible}
        value={startDate}
        title={t('home.leaveRequest.applyModal.startLabel')}
        locale={locale}
        onDismiss={() => setStartPickerVisible(false)}
        onConfirm={iso => {
          setStartPickerVisible(false);
          setStartDate(iso);
          if (isHalfDay) {
            setEndDate(iso);
          }
        }}
      />
      <DatePicker
        visible={endPickerVisible}
        value={endDate || startDate}
        title={t('home.leaveRequest.applyModal.endLabel')}
        locale={locale}
        onDismiss={() => setEndPickerVisible(false)}
        onConfirm={iso => {
          setEndPickerVisible(false);
          setEndDate(iso);
        }}
      />
    </Modal>
  );
}
