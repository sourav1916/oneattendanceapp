import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  formatTime12h,
  TimePicker,
  useTimePicker,
} from '@src/components/modals/TimePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  CompanyConstants,
  EmployeeEditFormData,
  EmployeeListItem,
  PermissionPackage,
} from '@src/types/employeeManagement';

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;
const DROPDOWN_SHEET_MAX = Dimensions.get('window').height * 0.55;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function formatLabel(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (
    typeof value === 'object' &&
    'label' in (value as Record<string, unknown>)
  ) {
    const label = (value as { label?: string }).label;
    if (label) {
      return label;
    }
  }
  const str = typeof value === 'string' ? value : String(value);
  if (!str) {
    return '';
  }
  return str
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatLabelValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (
    typeof value === 'object' &&
    'value' in (value as Record<string, unknown>)
  ) {
    return (value as { value?: string }).value ?? '';
  }
  return typeof value === 'string' ? value : String(value);
}

function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) {
    return '—';
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildFormDataFromEmployee(emp: EmployeeListItem): EmployeeEditFormData {
  return {
    designation: formatLabelValue(emp.designation),
    employment_type: formatLabelValue(emp.employment_type),
    salary_type: formatLabelValue(emp.salary_type),
    permission_package_id: emp.permission_package_id ?? null,
    attendance_methods: emp.attendance_methods.map(m => m.method),
    auto_approve: emp.attendance_methods.some(m => m.is_auto),
    shift_start: emp.shift_start ?? '09:00',
    shift_end: emp.shift_end ?? '18:00',
    break_minutes: formatDuration(emp.break_minutes),
    grace_minutes: formatDuration(emp.grace_minutes),
    weekends: emp.weekends
      .map(w => (typeof w.day === 'string' ? w.day.toLowerCase() : ''))
      .filter(Boolean),
  };
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    modalSafe: { flex: 1, backgroundColor: colors.overlay },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SHEET_MAX_HEIGHT,
      flexDirection: 'column',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 12 },
      }),
    },
    sheetForm: { height: SHEET_MAX_HEIGHT },
    sheetScroll: { flex: 1, minHeight: 0 },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sheetCloseBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.secondaryButton,
    },
    sheetBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    sheetFooter: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    sheetFooterBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryButton,
    },
    sheetFooterBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sheetFooterBtnDisabled: { opacity: 0.55 },
    sheetFooterBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    sheetFooterBtnTextPrimary: { color: '#fff', fontWeight: '700' },
    formSectionCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 14,
    },
    formSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    formGroup: { marginBottom: 14 },
    formGroupLast: { marginBottom: 0 },
    formLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    dropdownText: { flex: 1, fontSize: 15, color: colors.text },
    dropdownPlaceholder: { color: colors.textMuted },
    methodChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    methodChipActive: {
      borderColor: colors.primary,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    },
    methodChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    methodChipTextActive: { color: colors.primary },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    switchLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
    timeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    timeField: { flex: 1 },
    timeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    timeBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    durationInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    formError: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 4,
      fontWeight: '500',
    },
    optionsLoadingText: {
      marginTop: 12,
      textAlign: 'center',
    },
    centerBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    muted: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    dropdownModalSafe: { flex: 1, backgroundColor: colors.overlay },
    dropdownSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: DROPDOWN_SHEET_MAX,
      height: DROPDOWN_SHEET_MAX,
      flexDirection: 'column',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 12 },
      }),
    },
    dropdownList: { flex: 1, minHeight: 0 },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownOptionActive: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    dropdownOptionText: { flex: 1, fontSize: 16, color: colors.text },
    dropdownOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    dropdownCheck: { marginLeft: 8 },
  });
}

type DropdownPickerProps = {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
};

function DropdownPicker({
  visible,
  title,
  options,
  selected,
  onSelect,
  onDismiss,
  styles,
  colors,
}: DropdownPickerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.dropdownModalSafe} edges={['top']}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.dropdownSheet,
              { paddingBottom: Math.max(8, insets.bottom) },
            ]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button">
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <FlatList
              style={styles.dropdownList}
              data={options}
              keyExtractor={item => item.value}
              bounces={false}
              renderItem={({ item }) => {
                const active = item.value === selected;
                return (
                  <Pressable
                    style={[
                      styles.dropdownOption,
                      active && styles.dropdownOptionActive,
                    ]}
                    onPress={() => {
                      onSelect(item.value);
                      onDismiss();
                    }}>
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        active && styles.dropdownOptionTextActive,
                      ]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={colors.primary}
                        style={styles.dropdownCheck}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export type EditEmployeeModalProps = {
  visible: boolean;
  employee: EmployeeListItem | null;
  constants: Pick<
    CompanyConstants,
    'designations' | 'employment_types' | 'salary_types' | 'attendance_methods'
  > | null;
  permissionPackages: PermissionPackage[];
  onSave: (data: EmployeeEditFormData) => void;
  onDismiss: () => void;
  saving: boolean;
  optionsLoading: boolean;
};

export function EditEmployeeModal({
  visible,
  employee,
  constants,
  permissionPackages,
  onSave,
  onDismiss,
  saving,
  optionsLoading,
}: EditEmployeeModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => buildStyles(colors, scheme),
    [colors, scheme],
  );

  const [form, setForm] = useState<EmployeeEditFormData | null>(null);
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const shiftStartPicker = useTimePicker({
    initialValue: form?.shift_start ?? '09:00',
    onConfirm: (time: string) =>
      setForm(f => (f ? { ...f, shift_start: time } : f)),
  });
  const shiftEndPicker = useTimePicker({
    initialValue: form?.shift_end ?? '18:00',
    onConfirm: (time: string) =>
      setForm(f => (f ? { ...f, shift_end: time } : f)),
  });

  useEffect(() => {
    if (visible && employee) {
      const data = buildFormDataFromEmployee(employee);
      setForm(data);
      shiftStartPicker.setValue(data.shift_start);
      shiftEndPicker.setValue(data.shift_end);
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, employee]);

  const handleSave = useCallback(() => {
    if (!form) {
      return;
    }
    if (form.attendance_methods.length === 0) {
      setFormError(
        t('home.employeeList.editModal.errors.attendanceRequired'),
      );
      return;
    }
    setFormError(null);
    onSave(form);
  }, [form, onSave, t]);

  const toggleMethod = useCallback((method: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const methods = f.attendance_methods.includes(method)
        ? f.attendance_methods.filter(m => m !== method)
        : [...f.attendance_methods, method];
      return { ...f, attendance_methods: methods };
    });
    setFormError(null);
  }, []);

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const weekends = f.weekends.includes(day)
        ? f.weekends.filter(d => d !== day)
        : [...f.weekends, day];
      return { ...f, weekends };
    });
  }, []);

  const dropdownOptions = useMemo(() => {
    if (!constants) {
      return [];
    }
    switch (dropdownField) {
      case 'designation':
        return constants.designations;
      case 'employment_type':
        return constants.employment_types;
      case 'salary_type':
        return constants.salary_types;
      case 'permission_package':
        return permissionPackages.map(p => ({
          value: String(p.id),
          label: p.name,
        }));
      default:
        return [];
    }
  }, [constants, dropdownField, permissionPackages]);

  const dropdownTitle = useMemo(() => {
    switch (dropdownField) {
      case 'designation':
        return t('home.employeeList.editModal.designation');
      case 'employment_type':
        return t('home.employeeList.editModal.employmentType');
      case 'salary_type':
        return t('home.employeeList.editModal.salaryType');
      case 'permission_package':
        return t('home.employeeList.editModal.permissionPackage');
      default:
        return '';
    }
  }, [dropdownField, t]);

  const dropdownSelected = useMemo(() => {
    if (!form) {
      return '';
    }
    switch (dropdownField) {
      case 'designation':
        return form.designation;
      case 'employment_type':
        return form.employment_type;
      case 'salary_type':
        return form.salary_type;
      case 'permission_package':
        return form.permission_package_id != null
          ? String(form.permission_package_id)
          : '';
      default:
        return '';
    }
  }, [form, dropdownField]);

  const handleDropdownSelect = useCallback(
    (value: string) => {
      setForm(f => {
        if (!f) {
          return f;
        }
        switch (dropdownField) {
          case 'designation':
            return { ...f, designation: value };
          case 'employment_type':
            return { ...f, employment_type: value };
          case 'salary_type':
            return { ...f, salary_type: value };
          case 'permission_package':
            return {
              ...f,
              permission_package_id: parseInt(value, 10) || null,
            };
          default:
            return f;
        }
      });
    },
    [dropdownField],
  );

  const getDropdownDisplayText = useCallback(
    (field: string): string => {
      if (!form || !constants) {
        return '';
      }
      let options: { value: string; label: string }[] = [];
      let currentVal = '';
      switch (field) {
        case 'designation':
          options = constants.designations;
          currentVal = form.designation;
          break;
        case 'employment_type':
          options = constants.employment_types;
          currentVal = form.employment_type;
          break;
        case 'salary_type':
          options = constants.salary_types;
          currentVal = form.salary_type;
          break;
        case 'permission_package':
          options = permissionPackages.map(p => ({
            value: String(p.id),
            label: p.name,
          }));
          currentVal =
            form.permission_package_id != null
              ? String(form.permission_package_id)
              : '';
          break;
      }
      const found = options.find(o => o.value === currentVal);
      return found?.label ?? (currentVal ? formatLabel(currentVal) : '');
    },
    [form, constants, permissionPackages],
  );

  if (!form) {
    return null;
  }

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onDismiss}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={[styles.sheet, styles.sheetForm]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {t('home.employeeList.editModal.title')}
                </Text>
                <Pressable
                  style={styles.sheetCloseBtn}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.employeeList.editModal.close')}>
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetBody}
                bounces={false}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {optionsLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.muted, styles.optionsLoadingText]}>
                      {t('home.employeeList.editModal.loadingOptions')}
                    </Text>
                  </View>
                ) : null}
                {!optionsLoading && constants ? (
                  <>
                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.infoSection')}
                      </Text>
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.designation')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('designation')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('designation') &&
                                styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('designation') ||
                              t('home.employeeList.editModal.selectDesignation')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.permissionPackage')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('permission_package')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('permission_package') &&
                                styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('permission_package') ||
                              t('home.employeeList.editModal.selectPackage')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.employmentType')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('employment_type')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('employment_type') &&
                                styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('employment_type') ||
                              t('home.employeeList.editModal.selectEmploymentType')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.salaryType')}
                        </Text>
                        <Pressable
                          style={styles.dropdown}
                          onPress={() => setDropdownField('salary_type')}>
                          <Text
                            style={[
                              styles.dropdownText,
                              !getDropdownDisplayText('salary_type') &&
                                styles.dropdownPlaceholder,
                            ]}>
                            {getDropdownDisplayText('salary_type') ||
                              t('home.employeeList.editModal.selectSalaryType')}
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.attendanceSection')}
                      </Text>
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.attendanceMethods')}
                        </Text>
                        <View style={styles.methodChipWrap}>
                          {(constants?.attendance_methods ?? []).map(method => {
                            const active = form.attendance_methods.includes(
                              method.id,
                            );
                            return (
                              <Pressable
                                key={method.id}
                                style={[
                                  styles.methodChip,
                                  active && styles.methodChipActive,
                                ]}
                                onPress={() => toggleMethod(method.id)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}>
                                <Text
                                  style={[
                                    styles.methodChipText,
                                    active && styles.methodChipTextActive,
                                  ]}>
                                  {method.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {formError ? (
                          <Text style={styles.formError}>{formError}</Text>
                        ) : null}
                      </View>

                      <View style={[styles.formGroup, styles.switchRow]}>
                        <Text style={styles.switchLabel}>
                          {t('home.employeeList.editModal.autoApprove')}
                        </Text>
                        <Switch
                          value={form.auto_approve}
                          onValueChange={v =>
                            setForm(f => (f ? { ...f, auto_approve: v } : f))
                          }
                          trackColor={{
                            false: colors.border,
                            true: colors.primary,
                          }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.viewModal.scheduleSection')}
                      </Text>
                      <View style={styles.formGroup}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.shiftStart')}
                            </Text>
                            <Pressable
                              style={styles.timeBtn}
                              onPress={shiftStartPicker.present}>
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={18}
                                color={colors.primary}
                              />
                              <Text style={styles.timeBtnText}>
                                {formatTime12h(form.shift_start)}
                              </Text>
                            </Pressable>
                          </View>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.shiftEnd')}
                            </Text>
                            <Pressable
                              style={styles.timeBtn}
                              onPress={shiftEndPicker.present}>
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={18}
                                color={colors.primary}
                              />
                              <Text style={styles.timeBtnText}>
                                {formatTime12h(form.shift_end)}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      <View style={styles.formGroup}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.breakMinutes')}
                            </Text>
                            <TextInput
                              style={styles.durationInput}
                              value={form.break_minutes}
                              onChangeText={v =>
                                setForm(f => (f ? { ...f, break_minutes: v } : f))
                              }
                              placeholder="00:30"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                          <View style={styles.timeField}>
                            <Text style={styles.formLabel}>
                              {t('home.employeeList.editModal.graceMinutes')}
                            </Text>
                            <TextInput
                              style={styles.durationInput}
                              value={form.grace_minutes}
                              onChangeText={v =>
                                setForm(f => (f ? { ...f, grace_minutes: v } : f))
                              }
                              placeholder="00:15"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>
                        {t('home.employeeList.editModal.weekends')}
                      </Text>
                      <View style={[styles.formGroup, styles.formGroupLast]}>
                        <Text style={styles.formLabel}>
                          {t('home.employeeList.editModal.weekends')}
                        </Text>
                        <View style={styles.methodChipWrap}>
                          {ALL_WEEKDAYS.map(day => {
                            const active = form.weekends.includes(day);
                            return (
                              <Pressable
                                key={day}
                                style={[
                                  styles.methodChip,
                                  active && styles.methodChipActive,
                                ]}
                                onPress={() => toggleWeekend(day)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}>
                                <Text
                                  style={[
                                    styles.methodChipText,
                                    active && styles.methodChipTextActive,
                                  ]}>
                                  {t(`home.employeeList.days.${day}` as never)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  </>
                ) : null}
              </ScrollView>

              <View
                style={[
                  styles.sheetFooter,
                  { paddingBottom: Math.max(16, insets.bottom) },
                ]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetFooterBtn,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={onDismiss}
                  accessibilityRole="button">
                  <Text style={styles.sheetFooterBtnText}>
                    {t('home.employeeList.editModal.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetFooterBtn,
                    styles.sheetFooterBtnPrimary,
                    (saving || optionsLoading || !constants) &&
                      styles.sheetFooterBtnDisabled,
                    pressed && !saving && { opacity: 0.88 },
                  ]}
                  onPress={handleSave}
                  disabled={saving || optionsLoading || !constants}
                  accessibilityRole="button">
                  <Text style={styles.sheetFooterBtnTextPrimary}>
                    {saving
                      ? t('home.employeeList.editModal.saving')
                      : t('home.employeeList.editModal.save')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <TimePicker {...shiftStartPicker.pickerProps} />
      <TimePicker {...shiftEndPicker.pickerProps} />

      <DropdownPicker
        visible={dropdownField != null}
        title={dropdownTitle}
        options={dropdownOptions}
        selected={dropdownSelected}
        onSelect={handleDropdownSelect}
        onDismiss={() => setDropdownField(null)}
        styles={styles}
        colors={colors}
      />
    </>
  );
}
