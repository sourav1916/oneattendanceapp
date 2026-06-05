import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { DatePicker } from '@src/components/modals/DatePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmployeePickerList } from '@src/hooks/useEmployeePickerList';
import type { AppThemeColors } from '@src/theme/palettes';
import type { EmployeeListItem } from '@src/types/employeeList';
import type { CreateManagementLeavePayload } from '@src/types/leaveManagement';
import type { LeaveConfigEntry } from '@src/types/markAttendance';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';

const T = 'home.leaveManagement.createModal.';
const MAX_REASON = 2000;
const MAX_REMARKS = 1000;
const MAX_ATTACHMENTS = 10;
const FAR_FUTURE = '2099-12-31';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

type FieldErrors = {
  employee?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  reason?: string;
  remarks?: string;
  attachments?: string;
};

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRequestedDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (!startDate || !endDate) {
    return 0;
  }
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  if (isHalfDay && startDate === endDate) {
    return 0.5;
  }
  return dayCount;
}

type ModalStyles = ReturnType<typeof buildStyles>;

type SelectedEmployee = {
  id: number;
  name: string;
  employeeCode: string;
};

type UploadedFile = {
  id: string;
  url: string;
  name: string;
};

export type CreateManagementLeaveModalProps = {
  visible: boolean;
  companyId: number | null;
  leaveConfigs: LeaveConfigEntry[];
  loadingConfigs: boolean;
  submitting: boolean;
  locale: string;
  onDismiss: () => void;
  onSubmit: (payload: CreateManagementLeavePayload, employeeName: string) => void;
};

function formatDisplayDate(iso: string): string {
  if (!iso) {
    return '';
  }
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isEmployeeActive(status: string): boolean {
  const n = status.trim().toLowerCase();
  return n === 'active' || n === '1' || n === 'true';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.background : '#f8fafc';
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
    fieldGroup: { marginBottom: 14 },
    employeeField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: cardBg,
    },
    fieldErrorBorder: { borderColor: colors.danger },
    employeeAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    employeeAvatarText: { fontSize: 13, fontWeight: '700', color: colors.text },
    employeeMain: { flex: 1, minWidth: 0 },
    employeeName: { fontSize: 14, fontWeight: '600', color: colors.text },
    employeeCode: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    employeePlaceholder: { flex: 1, fontSize: 14, color: colors.textMuted },
    changeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
    },
    changeBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    chipScroll: { marginBottom: 0 },
    chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTextSelected: { color: colors.primary },
    emptyHint: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
    loadingIndicator: { marginBottom: 14 },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateFieldWrap: { flex: 1 },
    dateField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: cardBg,
    },
    dateFieldText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    dateFieldPlaceholder: { flex: 1, fontSize: 13, fontWeight: '400', color: colors.textMuted },
    dateFieldDisabled: { opacity: 0.5 },
    daysCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: 4,
    },
    daysCountLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    daysCountValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
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
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: cardBg,
      marginBottom: 0,
      textAlignVertical: 'top',
    },
    reasonInput: { minHeight: 72 },
    remarksInput: { minHeight: 56 },
    addFileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: cardBg,
      marginBottom: 8,
    },
    addFileLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
    uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    uploadingText: { fontSize: 12, color: colors.textMuted },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
    },
    fileItemName: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.text },
    fileRemoveBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? '#3f1d1d' : '#fee2e2',
    },
    fieldError: { fontSize: 12, color: colors.danger, marginTop: 4 },
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
    btnPrimaryDisabled: {
      backgroundColor: scheme === 'dark' ? '#334155' : '#cbd5e1',
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnPrimaryLabelDisabled: { color: scheme === 'dark' ? '#94a3b8' : '#64748b' },
    btnDisabled: { opacity: 0.55 },
    pickerSafe: { flex: 1, backgroundColor: colors.background },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    pickerClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.secondaryButton,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.text,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    pickerRowPressed: { backgroundColor: colors.secondaryButton },
    pickerEmpty: { padding: 24, alignItems: 'center' },
    pickerEmptyText: { fontSize: 14, color: colors.textMuted },
  });
}

const EmployeePickerRow = React.memo(function EmployeePickerRow({
  item,
  styles,
  accentColor,
  onPress,
}: {
  item: EmployeeListItem;
  styles: ModalStyles;
  accentColor: string;
  onPress: () => void;
}) {
  const contact = item.email?.trim() || item.phone?.trim() || '—';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}>
      <View style={styles.employeeAvatar}>
        <Text style={styles.employeeAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.employeeMain}>
        <Text style={styles.employeeName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.employeeCode} numberOfLines={1}>{item.employee_code}</Text>
        <Text style={styles.employeeCode} numberOfLines={1}>{contact}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={accentColor} />
    </Pressable>
  );
});

export function CreateManagementLeaveModal({
  visible,
  companyId,
  leaveConfigs,
  loadingConfigs,
  submitting,
  locale,
  onDismiss,
  onSubmit,
}: CreateManagementLeaveModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(null);
  const [leaveConfigId, setLeaveConfigId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [employeePickerVisible, setEmployeePickerVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  const tomorrow = useMemo(() => tomorrowIso(), []);

  const requestedDays = useMemo(
    () => getRequestedDays(startDate, endDate, isHalfDay),
    [endDate, isHalfDay, startDate],
  );

  const canPickEndDate = Boolean(startDate) && !isHalfDay;

  const picker = useEmployeePickerList({
    companyId: employeePickerVisible ? companyId : null,
  });

  const activeEmployees = useMemo(
    () => picker.employees.filter(e => isEmployeeActive(e.status)),
    [picker.employees],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedEmployee(null);
    setLeaveConfigId(leaveConfigs.length === 1 ? leaveConfigs[0].id : null);
    setStartDate('');
    setEndDate('');
    setIsHalfDay(false);
    setHalfDayType('first_half');
    setReason('');
    setRemarks('');
    setUploadedFiles([]);
    setUploading(false);
    setShowFieldErrors(false);
    setAttachmentError(null);
    setEmployeePickerVisible(false);
  }, [visible, leaveConfigs]);

  const onSelectHalfDay = useCallback((value: boolean) => {
    setIsHalfDay(value);
    if (value) {
      setEndDate(prev => startDate || prev);
    }
  }, [startDate]);

  const fieldErrors = useMemo((): FieldErrors => {
    if (!showFieldErrors) {
      return {};
    }
    const errors: FieldErrors = {};
    if (!selectedEmployee) {
      errors.employee = t(`${T}errors.employeeRequired`);
    }
    if (!loadingConfigs && leaveConfigs.length > 0 && leaveConfigId == null) {
      errors.leaveType = t(`${T}errors.leaveTypeRequired`);
    }
    if (!startDate) {
      errors.startDate = t(`${T}errors.startDateRequired`);
    } else if (startDate < tomorrow) {
      errors.startDate = t(`${T}errors.futureDateOnly`);
    }
    if (!endDate) {
      errors.endDate = t(`${T}errors.endDateRequired`);
    } else if (endDate < tomorrow) {
      errors.endDate = t(`${T}errors.futureDateOnly`);
    }
    if (startDate && endDate && endDate < startDate) {
      errors.dateRange = t(`${T}errors.endBeforeStart`);
    } else if (isHalfDay && startDate && endDate && startDate !== endDate) {
      errors.dateRange = t(`${T}errors.halfDaySameDay`);
    }
    if (reason.length > MAX_REASON) {
      errors.reason = t(`${T}errors.reasonTooLong`, { max: MAX_REASON });
    }
    if (remarks.length > MAX_REMARKS) {
      errors.remarks = t(`${T}errors.remarksTooLong`, { max: MAX_REMARKS });
    }
    if (uploadedFiles.length > MAX_ATTACHMENTS) {
      errors.attachments = t(`${T}errors.maxAttachments`, { max: MAX_ATTACHMENTS });
    }
    return errors;
  }, [
    endDate,
    isHalfDay,
    leaveConfigId,
    leaveConfigs.length,
    loadingConfigs,
    reason,
    remarks,
    selectedEmployee,
    showFieldErrors,
    startDate,
    t,
    tomorrow,
    uploadedFiles.length,
  ]);

  const canSubmit = useMemo(() => {
    if (!selectedEmployee || leaveConfigId == null || !startDate || !endDate) {
      return false;
    }
    if (submitting || uploading || loadingConfigs) {
      return false;
    }
    if (startDate < tomorrow || endDate < tomorrow) {
      return false;
    }
    if (endDate < startDate) {
      return false;
    }
    if (isHalfDay && startDate !== endDate) {
      return false;
    }
    if (reason.length > MAX_REASON || remarks.length > MAX_REMARKS) {
      return false;
    }
    if (uploadedFiles.length > MAX_ATTACHMENTS) {
      return false;
    }
    return true;
  }, [
    endDate,
    isHalfDay,
    leaveConfigId,
    loadingConfigs,
    reason,
    remarks,
    selectedEmployee,
    startDate,
    submitting,
    tomorrow,
    uploadedFiles.length,
    uploading,
  ]);

  const openEndPicker = useCallback(() => {
    if (!canPickEndDate) {
      return;
    }
    setEndPickerVisible(true);
  }, [canPickEndDate]);

  const handlePickFile = useCallback(async () => {
    if (uploadedFiles.length >= MAX_ATTACHMENTS) {
      setShowFieldErrors(true);
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
      });
      if (result.didCancel || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const mime = asset.type ?? 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.includes(mime)) {
        setAttachmentError(t(`${T}errors.invalidFileType`));
        return;
      }
      setUploading(true);
      setAttachmentError(null);
      const url = await uploadFileToOneSaas({
        uri: asset.uri ?? '',
        mimeType: mime,
        fileName: asset.fileName ?? `file_${Date.now()}`,
      });
      setUploadedFiles(prev => [
        ...prev,
        { id: String(Date.now()), url, name: asset.fileName ?? 'file' },
      ]);
    } catch {
      setAttachmentError(t(`${T}errors.uploadFailed`));
    } finally {
      setUploading(false);
    }
  }, [t, uploadedFiles.length]);

  const removeUploadedFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleSubmit = useCallback(() => {
    setShowFieldErrors(true);
    if (!canSubmit || !selectedEmployee || leaveConfigId == null) {
      return;
    }

    const payload: CreateManagementLeavePayload = {
      employee_id: selectedEmployee.id,
      leave_config_id: leaveConfigId,
      start_date: startDate,
      end_date: endDate,
      is_half_day: isHalfDay,
      reason: reason.trim() || null,
      remarks: remarks.trim() || null,
    };
    if (isHalfDay) {
      payload.half_day_type = halfDayType;
    }
    const urls = uploadedFiles.map(f => f.url);
    if (urls.length > 0) {
      payload.attachments = urls;
    }
    onSubmit(payload, selectedEmployee.name);
  }, [
    canSubmit,
    endDate,
    halfDayType,
    isHalfDay,
    leaveConfigId,
    onSubmit,
    reason,
    remarks,
    selectedEmployee,
    startDate,
    uploadedFiles,
  ]);

  const renderEmployeeItem = useCallback(
    ({ item }: { item: EmployeeListItem }) => (
      <EmployeePickerRow
        item={item}
        styles={styles}
        accentColor={colors.primary}
        onPress={() => {
          setSelectedEmployee({
            id: item.id,
            name: item.name,
            employeeCode: item.employee_code,
          });
          setEmployeePickerVisible(false);
        }}
      />
    ),
    [colors.primary, styles],
  );

  const employeeKeyExtractor = useCallback(
    (item: EmployeeListItem) => String(item.id),
    [],
  );

  const submitDisabled = !canSubmit;

  if (!visible) {
    return null;
  }

  return (
    <>
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrap}
            pointerEvents="box-none">
            <View style={styles.sheet} accessibilityViewIsModal>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>{t(`${T}title`)}</Text>
                <Text style={styles.subtitle}>{t(`${T}subtitle`)}</Text>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}employeeLabel`)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEmployeePickerVisible(true)}
                    style={[
                      styles.employeeField,
                      fieldErrors.employee ? styles.fieldErrorBorder : null,
                    ]}>
                    {selectedEmployee ? (
                      <>
                        <View style={styles.employeeAvatar}>
                          <Text style={styles.employeeAvatarText}>
                            {getInitials(selectedEmployee.name)}
                          </Text>
                        </View>
                        <View style={styles.employeeMain}>
                          <Text style={styles.employeeName} numberOfLines={1}>
                            {selectedEmployee.name}
                          </Text>
                          <Text style={styles.employeeCode} numberOfLines={1}>
                            {selectedEmployee.employeeCode}
                          </Text>
                        </View>
                        <View style={styles.changeBtn}>
                          <Text style={styles.changeBtnText}>{t(`${T}changeEmployee`)}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="account-search-outline"
                          size={22}
                          color={colors.textMuted}
                        />
                        <Text style={styles.employeePlaceholder}>{t(`${T}selectEmployee`)}</Text>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color={colors.textMuted}
                        />
                      </>
                    )}
                  </Pressable>
                  {fieldErrors.employee ? (
                    <Text style={styles.fieldError}>{fieldErrors.employee}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}leaveTypeLabel`)}</Text>
                  {loadingConfigs ? (
                    <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
                  ) : leaveConfigs.length === 0 ? (
                    <Text style={styles.emptyHint}>{t(`${T}noLeaveTypes`)}</Text>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipScroll}
                      contentContainerStyle={styles.chipRow}>
                      {leaveConfigs.map(config => {
                        const selected = leaveConfigId === config.id;
                        return (
                          <Pressable
                            key={config.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => setLeaveConfigId(config.id)}
                            style={[styles.chip, selected && styles.chipSelected]}>
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {config.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                  {fieldErrors.leaveType ? (
                    <Text style={styles.fieldError}>{fieldErrors.leaveType}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}dateRange`)}</Text>
                  <View style={styles.dateRow}>
                    <View style={styles.dateFieldWrap}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setStartPickerVisible(true)}
                        style={[
                          styles.dateField,
                          fieldErrors.startDate ? styles.fieldErrorBorder : null,
                        ]}>
                        <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} />
                        {startDate ? (
                          <Text style={styles.dateFieldText}>{formatDisplayDate(startDate)}</Text>
                        ) : (
                          <Text style={styles.dateFieldPlaceholder}>
                            {t(`${T}startDatePlaceholder`)}
                          </Text>
                        )}
                      </Pressable>
                      {fieldErrors.startDate ? (
                        <Text style={styles.fieldError}>{fieldErrors.startDate}</Text>
                      ) : null}
                    </View>
                    <View style={styles.dateFieldWrap}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={openEndPicker}
                        disabled={!canPickEndDate}
                        style={[
                          styles.dateField,
                          !canPickEndDate && styles.dateFieldDisabled,
                          fieldErrors.endDate ? styles.fieldErrorBorder : null,
                        ]}>
                        <MaterialCommunityIcons
                          name="calendar"
                          size={18}
                          color={canPickEndDate ? colors.primary : colors.textMuted}
                        />
                        {endDate ? (
                          <Text style={styles.dateFieldText}>{formatDisplayDate(endDate)}</Text>
                        ) : (
                          <Text style={styles.dateFieldPlaceholder}>
                            {t(`${T}endDatePlaceholder`)}
                          </Text>
                        )}
                      </Pressable>
                      {fieldErrors.endDate ? (
                        <Text style={styles.fieldError}>{fieldErrors.endDate}</Text>
                      ) : null}
                    </View>
                  </View>
                  {fieldErrors.dateRange ? (
                    <Text style={styles.fieldError}>{fieldErrors.dateRange}</Text>
                  ) : null}
                  {startDate && endDate && endDate >= startDate && requestedDays > 0 ? (
                    <View style={styles.daysCountRow}>
                      <Text style={styles.daysCountLabel}>{t(`${T}totalDaysLabel`)}</Text>
                      <Text style={styles.daysCountValue}>
                        {t(`${T}totalDaysValue`, { count: requestedDays })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.label}>{t(`${T}duration`)}</Text>
                <View style={styles.durationRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelectHalfDay(false)}
                    style={[styles.durationChip, !isHalfDay && styles.durationChipActive]}>
                    <Text
                      style={[
                        styles.durationChipText,
                        !isHalfDay && styles.durationChipTextActive,
                      ]}>
                      {t('home.leaveRequest.applyModal.fullDay')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelectHalfDay(true)}
                    style={[styles.durationChip, isHalfDay && styles.durationChipActive]}>
                    <Text
                      style={[
                        styles.durationChipText,
                        isHalfDay && styles.durationChipTextActive,
                      ]}>
                      {t('home.leaveRequest.applyModal.halfDayOption')}
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
                          {t('home.leaveRequest.applyModal.firstHalf')}
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
                          {t('home.leaveRequest.applyModal.secondHalf')}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}reasonLabel`)}</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder={t(`${T}reasonPlaceholder`)}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={MAX_REASON}
                    style={[
                      styles.textInput,
                      styles.reasonInput,
                      fieldErrors.reason ? styles.fieldErrorBorder : null,
                    ]}
                  />
                  {fieldErrors.reason ? (
                    <Text style={styles.fieldError}>{fieldErrors.reason}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}remarksLabel`)}</Text>
                  <TextInput
                    value={remarks}
                    onChangeText={setRemarks}
                    placeholder={t(`${T}remarksPlaceholder`)}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={MAX_REMARKS}
                    style={[
                      styles.textInput,
                      styles.remarksInput,
                      fieldErrors.remarks ? styles.fieldErrorBorder : null,
                    ]}
                  />
                  {fieldErrors.remarks ? (
                    <Text style={styles.fieldError}>{fieldErrors.remarks}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t(`${T}attachmentsLabel`)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={uploading || uploadedFiles.length >= MAX_ATTACHMENTS}
                    onPress={() => {
                      handlePickFile().catch(() => { });
                    }}
                    style={[
                      styles.addFileBtn,
                      (uploading || uploadedFiles.length >= MAX_ATTACHMENTS) && styles.btnDisabled,
                    ]}>
                    <MaterialCommunityIcons name="paperclip" size={18} color={colors.primary} />
                    <Text style={styles.addFileLabel}>{t(`${T}addFile`)}</Text>
                  </Pressable>
                  {uploading ? (
                    <View style={styles.uploadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.uploadingText}>{t(`${T}uploading`)}</Text>
                    </View>
                  ) : null}
                  {uploadedFiles.map(file => (
                    <View key={file.id} style={styles.fileItem}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={18}
                        color={colors.textMuted}
                      />
                      <Text style={styles.fileItemName} numberOfLines={1}>{file.name}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => removeUploadedFile(file.id)}
                        style={styles.fileRemoveBtn}>
                        <MaterialCommunityIcons name="close" size={14} color="#dc2626" />
                      </Pressable>
                    </View>
                  ))}
                  {fieldErrors.attachments || attachmentError ? (
                    <Text style={styles.fieldError}>
                      {fieldErrors.attachments ?? attachmentError}
                    </Text>
                  ) : null}
                </View>
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
                  disabled={submitting || uploading}
                  accessibilityState={{ disabled: submitDisabled }}
                  onPress={handleSubmit}
                  style={[
                    styles.btnPrimary,
                    submitDisabled && styles.btnPrimaryDisabled,
                  ]}>
                  {submitting ? (
                    <ActivityIndicator
                      color={submitDisabled ? colors.textMuted : '#fff'}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.btnPrimaryLabel,
                        submitDisabled && styles.btnPrimaryLabelDisabled,
                      ]}>
                      {t(`${T}submit`)}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <DatePicker
          visible={startPickerVisible}
          value={startDate}
          title={t('home.leaveRequest.applyModal.startLabel')}
          locale={locale}
          minDate={tomorrow}
          maxDate={FAR_FUTURE}
          onDismiss={() => setStartPickerVisible(false)}
          onConfirm={iso => {
            setStartPickerVisible(false);
            setStartDate(iso);
            if (isHalfDay) {
              setEndDate(iso);
            } else if (!endDate || endDate < iso) {
              setEndDate(iso);
            }
          }}
        />
        <DatePicker
          visible={endPickerVisible}
          value={endDate || startDate}
          title={t('home.leaveRequest.applyModal.endLabel')}
          locale={locale}
          minDate={startDate || tomorrow}
          maxDate={FAR_FUTURE}
          onDismiss={() => setEndPickerVisible(false)}
          onConfirm={iso => {
            setEndPickerVisible(false);
            setEndDate(iso);
          }}
        />
      </Modal>

      <Modal
        visible={employeePickerVisible}
        animationType="slide"
        onRequestClose={() => setEmployeePickerVisible(false)}>
        <SafeAreaView style={styles.pickerSafe} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t(`${T}selectEmployee`)}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEmployeePickerVisible(false)}
              style={styles.pickerClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={picker.loading ? [] : activeEmployees}
            keyExtractor={employeeKeyExtractor}
            renderItem={renderEmployeeItem}
            onEndReached={picker.tryLoadMore}
            onEndReachedThreshold={0.35}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.searchWrap}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
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
                <View style={styles.pickerEmpty}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>
                    {t('home.companyLedger.noEmployees')}
                  </Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
