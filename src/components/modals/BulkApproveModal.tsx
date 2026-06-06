import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useKeyboardBottomSheet } from '@src/hooks/useKeyboardBottomSheet';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  BulkApproveMode,
  BulkApprovePayload,
  HalfDayType,
  LeaveConfigEntry,
  LeaveType,
} from '@src/types/markAttendance';

export type BulkApproveTarget = {
  employeeIds: number[] | 'all';
  date: string;
  employeeCount: number;
};

export type BulkApproveModalProps = {
  visible: boolean;
  target: BulkApproveTarget | null;
  submitting: boolean;
  leaveConfigs: LeaveConfigEntry[];
  onDismiss: () => void;
  onSubmit: (payload: BulkApprovePayload) => void;
};

const MODES: BulkApproveMode[] = ['actual', 'present', 'half_day', 'leave', 'absent'];
const HALF_DAY_TYPES: HalfDayType[] = ['first_half', 'second_half'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid'];

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
    },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 16,
    },
    sectionLabelFirst: { marginTop: 0 },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextActive: { color: colors.primary },
    notesInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    infoCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
      padding: 12,
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 10,
    },
    submitBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
    cancelBtn: {
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
    },
    cancelLabel: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 16,
    },
  });
}

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.85 },
      ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function BulkApproveModal({
  visible,
  target,
  submitting,
  leaveConfigs,
  onDismiss,
  onSubmit,
}: BulkApproveModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const scrollRef = useRef<ScrollView>(null);
  const {
    keyboardHeight,
    layout,
    sheetSizeStyle,
    scrollViewProps,
    scrollContentPaddingBottom,
  } = useKeyboardBottomSheet(visible);

  const scrollToFocusedField = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const [mode, setMode] = useState<BulkApproveMode>('actual');
  const [halfDayType, setHalfDayType] = useState<HalfDayType>('first_half');
  const [leaveType, setLeaveType] = useState<LeaveType>('paid');
  const [leaveCode, setLeaveCode] = useState('');
  const [notes, setNotes] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setMode('actual');
      setHalfDayType('first_half');
      setLeaveType('paid');
      setLeaveCode('');
      setNotes('');
      setValidationErrors({});
    }
  }, [visible]);

  const paidLeaveConfigs = useMemo(
    () => leaveConfigs.filter(c => c.is_paid),
    [leaveConfigs],
  );

  const unpaidLeaveConfigs = useMemo(
    () => leaveConfigs.filter(c => !c.is_paid),
    [leaveConfigs],
  );

  const activeLeaveConfigs = leaveType === 'paid' ? paidLeaveConfigs : unpaidLeaveConfigs;

  const validate = useCallback((): Record<string, string> | null => {
    const errs: Record<string, string> = {};
    if (mode === 'leave' && leaveType === 'paid' && !leaveCode.trim()) {
      errs.leaveCode = t('home.attendanceManagement.bulk.errors.leaveCodeRequired');
    }
    return Object.keys(errs).length > 0 ? errs : null;
  }, [leaveCode, leaveType, mode, t]);

  const handleSubmit = useCallback(() => {
    if (!target || submitting) {
      return;
    }
    const errs = validate();
    if (errs) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});

    const payload: BulkApprovePayload = {
      attendance_date: target.date,
      employee_ids: target.employeeIds,
      attendance_type: 'attendance',
      mode,
    };

    if (mode === 'half_day') {
      payload.half_day_type = halfDayType;
    }

    if (mode === 'leave') {
      payload.leave_type = leaveType;
      if (leaveType === 'paid') {
        payload.leave_type_value = leaveCode.trim();
      }
    }

    if (notes.trim()) {
      payload.notes = notes.trim();
    }

    onSubmit(payload);
  }, [halfDayType, leaveCode, leaveType, mode, notes, onSubmit, submitting, target, validate]);

  if (!target) {
    return null;
  }

  const tk = 'home.attendanceManagement.bulk';

  const subtitle =
    target.employeeIds === 'all'
      ? t(`${tk}.subtitleAll`, { date: target.date })
      : t(`${tk}.subtitle`, { count: target.employeeCount, date: target.date });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${tk}.close`)}
          style={styles.backdrop}
          onPress={onDismiss}
        />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={[styles.sheet, sheetSizeStyle]}>
            <View style={styles.header}>
              <View style={styles.handle} />
              <Text style={styles.headerTitle} accessibilityRole="header">
                {t(`${tk}.title`)}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            <ScrollView
              ref={scrollRef}
              style={[
                styles.scroll,
                keyboardHeight > 0 && styles.scrollKeyboardOpen,
              ]}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: scrollContentPaddingBottom },
              ]}
              nestedScrollEnabled
              {...scrollViewProps}>

              <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>
                {t(`${tk}.mode`)}
              </Text>
              <View style={styles.chipRow}>
                {MODES.map(m => (
                  <Chip
                    key={m}
                    label={t(`${tk}.modes.${m}`)}
                    active={mode === m}
                    onPress={() => setMode(m)}
                    styles={styles}
                  />
                ))}
              </View>

              {mode === 'actual' ? (
                <View style={styles.infoCard}>
                  <MaterialCommunityIcons name="information-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.infoText}>{t(`${tk}.actualInfo`)}</Text>
                </View>
              ) : null}

              {mode === 'half_day' ? (
                <>
                  <Text style={styles.sectionLabel}>{t(`${tk}.halfDayType`)}</Text>
                  <View style={styles.chipRow}>
                    {HALF_DAY_TYPES.map(h => (
                      <Chip
                        key={h}
                        label={t(`${tk}.halfDayTypes.${h}`)}
                        active={halfDayType === h}
                        onPress={() => setHalfDayType(h)}
                        styles={styles}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {mode === 'leave' ? (
                <>
                  <Text style={styles.sectionLabel}>{t(`${tk}.leaveTypeLabel`)}</Text>
                  <View style={styles.chipRow}>
                    {LEAVE_TYPES.map(lt => (
                      <Chip
                        key={lt}
                        label={t(`${tk}.leaveTypes.${lt}`)}
                        active={leaveType === lt}
                        onPress={() => {
                          setLeaveType(lt);
                          setLeaveCode('');
                          setValidationErrors({});
                        }}
                        styles={styles}
                      />
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>{t(`${tk}.leaveCodeLabel`)}</Text>
                  <View style={styles.chipRow}>
                    {activeLeaveConfigs.map(cfg => (
                      <Chip
                        key={cfg.id}
                        label={cfg.name}
                        active={leaveCode === cfg.code}
                        onPress={() => {
                          setLeaveCode(cfg.code);
                          setValidationErrors({});
                        }}
                        styles={styles}
                      />
                    ))}
                  </View>
                  {validationErrors.leaveCode ? (
                    <Text style={styles.errorText}>{validationErrors.leaveCode}</Text>
                  ) : null}
                </>
              ) : null}

              <Text style={styles.sectionLabel}>{t(`${tk}.notesLabel`)}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onFocus={scrollToFocusedField}
                placeholder={t(`${tk}.notesPlaceholder`)}
                placeholderTextColor={colors.textMuted}
                multiline
                style={styles.notesInput}
              />
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitBtn,
                  submitting && styles.submitBtnDisabled,
                  pressed && !submitting && { opacity: 0.9 },
                ]}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : null}
                <Text style={styles.submitLabel}>{t(`${tk}.submit`)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                disabled={submitting}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.cancelLabel}>{t(`${tk}.cancel`)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
