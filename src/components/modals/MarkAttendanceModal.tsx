import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { TimePicker, formatTime12h } from '@src/components/modals/TimePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useKeyboardBottomSheet } from '@src/hooks/useKeyboardBottomSheet';
import type { AppThemeColors } from '@src/theme/palettes';
import type { AttendanceDayRecord, ShiftInfo } from '@src/types/attendanceList';
import type {
  HalfDayType,
  LeaveConfigEntry,
  LeaveType,
  MarkAttendancePayload,
  MarkAttendanceStatus,
  MarkAttendanceType,
} from '@src/types/markAttendance';

export type MarkAttendanceTarget = {
  employeeId: number;
  employeeName: string;
  date: string;
  preSelectedStatus?: MarkAttendanceStatus;
  existingRecord?: AttendanceDayRecord | null;
  shift?: ShiftInfo | null;
};

export type MarkAttendanceModalProps = {
  visible: boolean;
  target: MarkAttendanceTarget | null;
  submitting: boolean;
  leaveConfigs: LeaveConfigEntry[];
  onDismiss: () => void;
  onSubmit: (payload: MarkAttendancePayload) => void;
};

const ATTENDANCE_STATUSES: MarkAttendanceStatus[] = [
  'present',
  'half_day',
  'absent',
  'leave',
];

const HALF_DAY_TYPES: HalfDayType[] = ['first_half', 'second_half'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(v: string): boolean {
  return TIME_RE.test(v.trim());
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFillObject },
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
    timeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    timeField: { flex: 1 },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
    },
    textInputError: {
      borderColor: colors.danger,
    },
    timePress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
    },
    timePressError: {
      borderColor: colors.danger,
    },
    timePressIcon: {
      color: colors.primary,
    },
    timePressValue: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 1,
    },
    timePressPlaceholder: {
      fontSize: 16,
      color: colors.textMuted,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    switchLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
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
    errorText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SwitchField({
  label,
  value,
  onValueChange,
  styles,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function MarkAttendanceModal({
  visible,
  target,
  submitting,
  leaveConfigs,
  onDismiss,
  onSubmit,
}: MarkAttendanceModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
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

  const [type, setType] = useState<MarkAttendanceType>('attendance');
  const [status, setStatus] = useState<MarkAttendanceStatus>('present');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [halfDayType, setHalfDayType] = useState<HalfDayType>('first_half');
  const [leaveType, setLeaveType] = useState<LeaveType>('paid');
  const [leaveCode, setLeaveCode] = useState('');
  const [leaveOvertimeMin, setLeaveOvertimeMin] = useState('');
  const [isDeductible, setIsDeductible] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [notes, setNotes] = useState('');
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible || !target) {
      return;
    }

    setValidationErrors({});

    const { preSelectedStatus, existingRecord, shift } = target;

    if (existingRecord) {
      setType('attendance');
      setStatus(existingRecord.day_status as MarkAttendanceStatus);
      setStartTime(existingRecord.punch_in?.time ?? '');
      setEndTime(existingRecord.punch_out?.time ?? '');
      setIsDeductible(existingRecord.is_deductible);
      setIsOvertime(existingRecord.is_overtime);
      setHalfDayType(
        (existingRecord.half_day_session as HalfDayType) ?? 'first_half',
      );
      setLeaveType((existingRecord.leave_type as LeaveType) ?? 'paid');
      setLeaveCode(existingRecord.leave_sub_type ?? '');
      setLeaveOvertimeMin('');
      setNotes(existingRecord.remark ?? '');
      return;
    }

    setType('attendance');
    setStatus(preSelectedStatus ?? 'present');
    setIsDeductible(false);
    setIsOvertime(false);
    setHalfDayType('first_half');
    setLeaveType('paid');
    setLeaveCode('');
    setLeaveOvertimeMin('');
    setNotes('');

    if (shift) {
      setStartTime(shift.start_time);
      setEndTime(shift.end_time);
    } else {
      setStartTime('');
      setEndTime('');
    }
  }, [visible, target]);

  const needsTimes =
    type === 'attendance'
      ? status === 'present' || status === 'half_day'
      : true;

  const paidLeaveOptions = useMemo(
    () => leaveConfigs.filter(c => c.is_paid),
    [leaveConfigs],
  );

  const unpaidLeaveOptions = useMemo(
    () => leaveConfigs.filter(c => !c.is_paid),
    [leaveConfigs],
  );

  const activeLeaveOptions =
    leaveType === 'paid' ? paidLeaveOptions : unpaidLeaveOptions;

  const validate = useCallback((): Record<string, string> | null => {
    const errs: Record<string, string> = {};

    if (type === 'attendance') {
      if (status === 'present' || status === 'half_day') {
        if (!isValidTime(startTime)) {
          errs.startTime = t(
            'home.attendanceManagement.mark.errors.invalidTime',
          );
        }
        if (!isValidTime(endTime)) {
          errs.endTime = t(
            'home.attendanceManagement.mark.errors.invalidTime',
          );
        }
        if (
          isValidTime(startTime) &&
          isValidTime(endTime) &&
          endTime <= startTime
        ) {
          errs.endTime = t(
            'home.attendanceManagement.mark.errors.endAfterStart',
          );
        }
      }
      if (status === 'leave' && !leaveCode.trim()) {
        errs.leaveCode = t(
          'home.attendanceManagement.mark.errors.leaveCodeRequired',
        );
      }
    } else {
      const hasStart = startTime.trim().length > 0;
      const hasEnd = endTime.trim().length > 0;
      if (!hasStart && !hasEnd) {
        errs.startTime = t(
          'home.attendanceManagement.mark.errors.breakTimeRequired',
        );
      }
      if (hasStart && !isValidTime(startTime)) {
        errs.startTime = t(
          'home.attendanceManagement.mark.errors.invalidTime',
        );
      }
      if (hasEnd && !isValidTime(endTime)) {
        errs.endTime = t(
          'home.attendanceManagement.mark.errors.invalidTime',
        );
      }
      if (
        hasStart &&
        hasEnd &&
        isValidTime(startTime) &&
        isValidTime(endTime) &&
        endTime <= startTime
      ) {
        errs.endTime = t(
          'home.attendanceManagement.mark.errors.endAfterStart',
        );
      }
    }

    return Object.keys(errs).length > 0 ? errs : null;
  }, [endTime, leaveCode, startTime, status, t, type]);

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

    const payload: MarkAttendancePayload = {
      employee_id: target.employeeId,
      date: target.date,
      type,
    };

    if (type === 'attendance') {
      payload.status = status;

      if (status === 'present' || status === 'half_day') {
        payload.start_time = startTime.trim();
        payload.end_time = endTime.trim();
        payload.is_deductible = isDeductible;
        payload.is_overtime = isOvertime;
      }

      if (status === 'half_day') {
        payload.half_day_type = halfDayType;
      }

      if (status === 'leave') {
        payload.leave_type = leaveType;
        payload.leave_type_value = leaveCode.trim() || null;
        const overtimeNum = parseInt(leaveOvertimeMin.trim(), 10);
        if (!isNaN(overtimeNum) && overtimeNum > 0) {
          payload.leave_day_overtime = overtimeNum;
        }
      }
    } else {
      if (startTime.trim()) {
        payload.start_time = startTime.trim();
      }
      if (endTime.trim()) {
        payload.end_time = endTime.trim();
      }
    }

    if (notes.trim()) {
      payload.notes = notes.trim();
    }

    onSubmit(payload);
  }, [
    endTime,
    halfDayType,
    isDeductible,
    isOvertime,
    leaveCode,
    leaveOvertimeMin,
    leaveType,
    notes,
    onSubmit,
    startTime,
    status,
    submitting,
    target,
    type,
    validate,
  ]);

  if (!target) {
    return null;
  }

  const tk = 'home.attendanceManagement.mark';

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
                {target.employeeName} · {target.date}
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
                {t(`${tk}.type`)}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label={t(`${tk}.typeAttendance`)}
                  active={type === 'attendance'}
                  onPress={() => setType('attendance')}
                  styles={styles}
                />
                <Chip
                  label={t(`${tk}.typeBreak`)}
                  active={type === 'break'}
                  onPress={() => setType('break')}
                  styles={styles}
                />
              </View>

              {type === 'attendance' && (
                <>
                  <Text style={styles.sectionLabel}>{t(`${tk}.status`)}</Text>
                  <View style={styles.chipRow}>
                    {ATTENDANCE_STATUSES.map(s => (
                      <Chip
                        key={s}
                        label={t(`${tk}.statuses.${s}`)}
                        active={status === s}
                        onPress={() => setStatus(s)}
                        styles={styles}
                      />
                    ))}
                  </View>
                </>
              )}

              {type === 'attendance' && status === 'half_day' && (
                <>
                  <Text style={styles.sectionLabel}>
                    {t(`${tk}.halfDayType`)}
                  </Text>
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
              )}

              {type === 'attendance' && status === 'leave' && (
                <>
                  <Text style={styles.sectionLabel}>
                    {t(`${tk}.leaveTypeLabel`)}
                  </Text>
                  <View style={styles.chipRow}>
                    {LEAVE_TYPES.map(lt => (
                      <Chip
                        key={lt}
                        label={t(`${tk}.leaveTypes.${lt}`)}
                        active={leaveType === lt}
                        onPress={() => {
                          setLeaveType(lt);
                          setLeaveCode('');
                        }}
                        styles={styles}
                      />
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>
                    {t(`${tk}.leaveCodeLabel`)}
                  </Text>
                  {activeLeaveOptions.length > 0 ? (
                    <View style={styles.chipRow}>
                      {activeLeaveOptions.map(opt => (
                        <Chip
                          key={opt.id}
                          label={opt.name || opt.code}
                          active={leaveCode === opt.code}
                          onPress={() => setLeaveCode(opt.code)}
                          styles={styles}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.infoText}>
                      {leaveConfigs.length === 0
                        ? t(`${tk}.leaveCodesLoading`)
                        : t(`${tk}.leaveCodesEmpty`)}
                    </Text>
                  )}
                  {validationErrors.leaveCode ? (
                    <Text style={styles.errorText}>
                      {validationErrors.leaveCode}
                    </Text>
                  ) : null}

                  <Text style={styles.sectionLabel}>
                    {t(`${tk}.leaveOvertimeLabel`)}
                  </Text>
                  <TextInput
                    value={leaveOvertimeMin}
                    onChangeText={setLeaveOvertimeMin}
                    placeholder={t(`${tk}.leaveOvertimePlaceholder`)}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={styles.textInput}
                  />
                </>
              )}

              {needsTimes && (
                <>
                  <Text style={styles.sectionLabel}>
                    {t(`${tk}.timeLabel`)}
                  </Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.fieldLabel}>
                        {t(`${tk}.startTime`)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setStartPickerOpen(true)}
                        style={({ pressed }) => [
                          styles.timePress,
                          validationErrors.startTime && styles.timePressError,
                          pressed && { opacity: 0.85 },
                        ]}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={20}
                          color={styles.timePressIcon.color}
                        />
                        {startTime ? (
                          <Text style={styles.timePressValue}>{formatTime12h(startTime)}</Text>
                        ) : (
                          <Text style={styles.timePressPlaceholder}>HH:mm</Text>
                        )}
                      </Pressable>
                      {validationErrors.startTime ? (
                        <Text style={styles.errorText}>
                          {validationErrors.startTime}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.fieldLabel}>
                        {t(`${tk}.endTime`)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setEndPickerOpen(true)}
                        style={({ pressed }) => [
                          styles.timePress,
                          validationErrors.endTime && styles.timePressError,
                          pressed && { opacity: 0.85 },
                        ]}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={20}
                          color={styles.timePressIcon.color}
                        />
                        {endTime ? (
                          <Text style={styles.timePressValue}>{formatTime12h(endTime)}</Text>
                        ) : (
                          <Text style={styles.timePressPlaceholder}>HH:mm</Text>
                        )}
                      </Pressable>
                      {validationErrors.endTime ? (
                        <Text style={styles.errorText}>
                          {validationErrors.endTime}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </>
              )}

              {type === 'attendance' &&
                (status === 'present' || status === 'half_day') && (
                  <>
                    <Text style={styles.sectionLabel}>
                      {t(`${tk}.optionsLabel`)}
                    </Text>
                    <SwitchField
                      label={t(`${tk}.isDeductible`)}
                      value={isDeductible}
                      onValueChange={setIsDeductible}
                      styles={styles}
                      colors={colors}
                    />
                    <SwitchField
                      label={t(`${tk}.isOvertime`)}
                      value={isOvertime}
                      onValueChange={setIsOvertime}
                      styles={styles}
                      colors={colors}
                    />
                  </>
                )}

              {type === 'attendance' && status === 'absent' && (
                <View style={styles.infoCard}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                  <Text style={styles.infoText}>{t(`${tk}.absentInfo`)}</Text>
                </View>
              )}

              {type === 'break' && (
                <View style={styles.infoCard}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                  <Text style={styles.infoText}>{t(`${tk}.breakInfo`)}</Text>
                </View>
              )}

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
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={styles.cancelLabel}>{t(`${tk}.cancel`)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
      <TimePicker
        visible={startPickerOpen}
        value={startTime || '09:00'}
        title={t(`${tk}.startTime`)}
        onDismiss={() => setStartPickerOpen(false)}
        onConfirm={(time) => {
          setStartTime(time);
          setValidationErrors(prev => {
            const next = { ...prev };
            delete next.startTime;
            return next;
          });
        }}
      />
      <TimePicker
        visible={endPickerOpen}
        value={endTime || '18:00'}
        title={t(`${tk}.endTime`)}
        minTime={startTime || undefined}
        onDismiss={() => setEndPickerOpen(false)}
        onConfirm={(time) => {
          setEndTime(time);
          setValidationErrors(prev => {
            const next = { ...prev };
            delete next.endTime;
            return next;
          });
        }}
      />
    </Modal>
  );
}
