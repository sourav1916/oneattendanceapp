import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { salaryApi } from '@src/api/salaryApi';
import { DatePicker } from '@src/components/modals/DatePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  AssignSalaryComponentPayload,
  AssignSalaryPayload,
  SalaryCalcType,
  SalaryComponent,
  SalaryComponentType,
} from '@src/types/salary';
const T = 'home.employeeProfile.salary.assignModal.';
const KEYBOARD_GAP = 8;
const MIN_SHEET_HEIGHT = 280;

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
): { wrapStyle: ViewStyle; sheetHeight?: number; sheetMaxHeight: number } {
  const keyboardOpen = keyboardHeight > 0;
  const sheetMaxHeight = Math.min(windowHeight * 0.92, windowHeight - topInset - 24);

  if (keyboardOpen) {
    const available = windowHeight - keyboardHeight - KEYBOARD_GAP - topInset;
    const sheetHeight = Math.max(MIN_SHEET_HEIGHT, Math.min(sheetMaxHeight, available));
    return {
      wrapStyle: { justifyContent: 'flex-end', paddingTop: 24, paddingBottom: keyboardHeight },
      sheetHeight,
      sheetMaxHeight,
    };
  }

  return {
    wrapStyle: { justifyContent: 'flex-end', paddingTop: 48, paddingBottom: 0 },
    sheetMaxHeight,
  };
}

type SelectedEmployee = {
  id: number;
  name: string;
  employeeCode: string;
};

type ComponentRow = {
  id: string;
  componentId: number | null;
  calcType: SalaryCalcType;
  calcValue: string;
  reason: string;
};

type DateField = 'from' | 'to' | null;

export type AssignSalaryModalProps = {
  visible: boolean;
  companyId: number | null;
  employee: SelectedEmployee | null;
  submitting: boolean;
  apiError?: string;
  showOverlapHint?: boolean;
  onDismiss: () => void;
  onSubmit: (payload: AssignSalaryPayload) => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function formatDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) {
    return iso;
  }
  const [, y, mo, d] = match;
  return `${d}/${mo}/${y}`;
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function parseCalcValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

function createComponentRow(): ComponentRow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    componentId: null,
    calcType: 'fixed',
    calcValue: '',
    reason: '',
  };
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.background : '#f8fafc';
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
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    employeeField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
      backgroundColor: cardBg,
    },
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
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: 14,
    },
    inputLast: { marginBottom: 0 },
    dateField: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 14,
      backgroundColor: colors.surface,
    },
    dateFieldDisabled: { opacity: 0.5 },
    dateValue: { fontSize: 14, fontWeight: '600', color: colors.text },
    datePlaceholder: { fontSize: 14, color: colors.textMuted },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
      paddingVertical: 4,
    },
    switchLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
    switchHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    switchTextWrap: { flex: 1 },
    rowCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      backgroundColor: cardBg,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? '#3f1d1d' : '#fee2e2',
    },
    typeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 6,
      marginTop: 4,
    },
    chipScroll: { marginBottom: 8 },
    chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    chipTextSelected: { color: colors.primary },
    chipDisabled: { opacity: 0.4 },
    calcTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    calcChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    calcChipSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
    },
    calcChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    calcChipTextSelected: { color: colors.primary },
    addRowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      marginBottom: 8,
    },
    addRowLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
    emptyHint: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
    loadingIndicator: { marginBottom: 10 },
    overlapNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.35)' : '#fde68a',
      backgroundColor: scheme === 'dark' ? 'rgba(120, 53, 15, 0.35)' : '#fffbeb',
      marginBottom: 10,
    },
    overlapText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    error: { fontSize: 12, color: colors.danger, marginBottom: 8 },
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

function groupComponentsByType(components: SalaryComponent[]) {
  const groups: Record<SalaryComponentType, SalaryComponent[]> = {
    earning: [],
    deduction: [],
    employer_contribution: [],
  };
  for (const item of components) {
    if (item.type in groups) {
      groups[item.type].push(item);
    }
  }
  return groups;
}

export function AssignSalaryModal({
  visible,
  companyId,
  employee,
  submitting,
  apiError = '',
  showOverlapHint = false,
  onDismiss,
  onSubmit,
}: AssignSalaryModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [baseAmount, setBaseAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [openEnded, setOpenEnded] = useState(true);
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [error, setError] = useState('');
  const [dateField, setDateField] = useState<DateField>(null);

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top),
    [insets.top, keyboardHeight, windowHeight],
  );
  const sheetSizeStyle = layout.sheetHeight
    ? { height: layout.sheetHeight, maxHeight: layout.sheetMaxHeight }
    : { maxHeight: layout.sheetMaxHeight };

  const usedComponentIds = useMemo(
    () => new Set(rows.map(r => r.componentId).filter((id): id is number => id != null)),
    [rows],
  );

  const groupedComponents = useMemo(() => groupComponentsByType(components), [components]);

  const resetForm = useCallback(() => {
    setBaseAmount('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setOpenEnded(true);
    setRows([]);
    setError('');
    setDateField(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetForm();
      return;
    }
    if (!companyId) {
      return;
    }
    let cancelled = false;
    setLoadingComponents(true);
    salaryApi
      .listComponents(companyId)
      .then(res => {
        if (cancelled) {
          return;
        }
        if (res.success && Array.isArray(res.data)) {
          setComponents(res.data.filter(c => c.is_active !== false));
        } else {
          setComponents([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComponents([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingComponents(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, resetForm, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const scrollToFocusedField = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleOpenEndedChange = useCallback((value: boolean) => {
    setOpenEnded(value);
    if (value) {
      setEffectiveTo('');
    }
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, createComponentRow()]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  }, []);

  const updateRow = useCallback((rowId: string, patch: Partial<ComponentRow>) => {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, ...patch } : r)));
  }, []);

  const validate = useCallback((): AssignSalaryPayload | null => {
    if (!employee) {
      setError(t(`${T}errors.employeeRequired`));
      return null;
    }
    const base = parseAmount(baseAmount);
    if (base == null) {
      setError(t(`${T}errors.baseAmountRequired`));
      return null;
    }
    if (!effectiveFrom.trim()) {
      setError(t(`${T}errors.effectiveFromRequired`));
      return null;
    }
    if (!openEnded) {
      if (!effectiveTo.trim()) {
        setError(t(`${T}errors.effectiveToRequired`));
        return null;
      }
      if (effectiveTo < effectiveFrom) {
        setError(t(`${T}errors.effectiveToBeforeFrom`));
        return null;
      }
    }

    const payloadComponents: AssignSalaryComponentPayload[] = [];
    const seenIds = new Set<number>();

    for (const row of rows) {
      if (row.componentId == null) {
        setError(t(`${T}errors.componentRequired`));
        return null;
      }
      if (seenIds.has(row.componentId)) {
        setError(t(`${T}errors.duplicateComponent`));
        return null;
      }
      seenIds.add(row.componentId);
      const calcValue = parseCalcValue(row.calcValue);
      if (calcValue == null) {
        setError(t(`${T}errors.calcValueRequired`));
        return null;
      }
      const item: AssignSalaryComponentPayload = {
        component_id: row.componentId,
        calc_type: row.calcType,
        calc_value: calcValue,
      };
      const reason = row.reason.trim();
      if (reason) {
        item.reason = reason;
      }
      payloadComponents.push(item);
    }

    const payload: AssignSalaryPayload = {
      employee_id: employee.id,
      base_amount: base,
      effective_from: effectiveFrom.trim(),
    };
    if (!openEnded && effectiveTo.trim()) {
      payload.effective_to = effectiveTo.trim();
    }
    if (payloadComponents.length > 0) {
      payload.components = payloadComponents;
    }
    return payload;
  }, [
    baseAmount,
    effectiveFrom,
    effectiveTo,
    employee,
    openEnded,
    rows,
    t,
  ]);

  const handleSubmit = useCallback(() => {
    setError('');
    const payload = validate();
    if (!payload) {
      return;
    }
    onSubmit(payload);
  }, [onSubmit, validate]);

  const handleDismiss = useCallback(() => {
    if (submitting) {
      return;
    }
    onDismiss();
  }, [onDismiss, submitting]);

  if (!visible) {
    return null;
  }

  const componentTypeOrder: SalaryComponentType[] = [
    'earning',
    'deduction',
    'employer_contribution',
  ];

  return (
    <>
      <Modal
        transparent
        visible={visible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleDismiss}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t('modals.common.closeDialog')}
            onPress={handleDismiss}
          />
          <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
            <View style={[styles.sheet, sheetSizeStyle]} accessibilityViewIsModal>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>{t(`${T}title`)}</Text>
                <Text style={styles.subtitle}>{t(`${T}subtitle`)}</Text>
              </View>

              <ScrollView
                ref={scrollRef}
                style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: Math.max(12, insets.bottom) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={keyboardHeight > 0}
                bounces={false}>
                {employee ? (
                  <>
                    <Text style={styles.label}>{t(`${T}employeeLabel`)}</Text>
                    <View style={styles.employeeField}>
                      <View style={styles.employeeAvatar}>
                        <Text style={styles.employeeAvatarText}>
                          {getInitials(employee.name)}
                        </Text>
                      </View>
                      <View style={styles.employeeMain}>
                        <Text style={styles.employeeName} numberOfLines={1}>
                          {employee.name}
                        </Text>
                        <Text style={styles.employeeCode} numberOfLines={1}>
                          {employee.employeeCode}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}

                <Text style={styles.label}>{t(`${T}baseAmountLabel`)}</Text>
                <TextInput
                  value={baseAmount}
                  onChangeText={setBaseAmount}
                  onFocus={scrollToFocusedField}
                  keyboardType="decimal-pad"
                  placeholder={t(`${T}baseAmountPlaceholder`)}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />

                <Text style={styles.label}>{t(`${T}effectiveFromLabel`)}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDateField('from')}
                  style={styles.dateField}>
                  <Text
                    style={effectiveFrom ? styles.dateValue : styles.datePlaceholder}>
                    {effectiveFrom
                      ? formatDisplayDate(effectiveFrom)
                      : t(`${T}selectDate`)}
                  </Text>
                  <MaterialCommunityIcons
                    name="calendar-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>

                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchLabel}>{t(`${T}openEndedLabel`)}</Text>
                    <Text style={styles.switchHint}>{t(`${T}openEndedHint`)}</Text>
                  </View>
                  <Switch
                    value={openEnded}
                    onValueChange={handleOpenEndedChange}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {!openEnded ? (
                  <>
                    <Text style={styles.label}>{t(`${T}effectiveToLabel`)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDateField('to')}
                      style={styles.dateField}>
                      <Text
                        style={effectiveTo ? styles.dateValue : styles.datePlaceholder}>
                        {effectiveTo
                          ? formatDisplayDate(effectiveTo)
                          : t(`${T}selectDate`)}
                      </Text>
                      <MaterialCommunityIcons
                        name="calendar-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </>
                ) : null}

                <Text style={styles.label}>{t(`${T}componentsLabel`)}</Text>
                {loadingComponents ? (
                  <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
                ) : components.length === 0 ? (
                  <Text style={styles.emptyHint}>{t(`${T}noComponents`)}</Text>
                ) : null}

                {rows.map((row, index) => (
                  <View key={row.id} style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle}>
                        {t(`${T}rowLabel`, { index: index + 1 })}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => removeRow(row.id)}
                        style={styles.removeBtn}>
                        <MaterialCommunityIcons name="close" size={16} color="#dc2626" />
                      </Pressable>
                    </View>

                    {componentTypeOrder.map(typeKey => {
                      const typeItems = groupedComponents[typeKey];
                      if (typeItems.length === 0) {
                        return null;
                      }
                      return (
                        <View key={typeKey}>
                          <Text style={styles.typeLabel}>
                            {t(`${T}componentTypes.${typeKey}`)}
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.chipScroll}>
                            <View style={styles.chipRow}>
                              {typeItems.map(comp => {
                                const selected = row.componentId === comp.id;
                                const usedElsewhere =
                                  usedComponentIds.has(comp.id) && !selected;
                                return (
                                  <Pressable
                                    key={comp.id}
                                    accessibilityRole="button"
                                    disabled={usedElsewhere}
                                    onPress={() =>
                                      updateRow(row.id, { componentId: comp.id })
                                    }
                                    style={[
                                      styles.chip,
                                      selected && styles.chipSelected,
                                      usedElsewhere && styles.chipDisabled,
                                    ]}>
                                    <Text
                                      style={[
                                        styles.chipText,
                                        selected && styles.chipTextSelected,
                                      ]}
                                      numberOfLines={1}>
                                      {comp.name}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>
                      );
                    })}

                    <Text style={styles.typeLabel}>{t(`${T}calcTypeLabel`)}</Text>
                    <View style={styles.calcTypeRow}>
                      {(['fixed', 'percentage'] as SalaryCalcType[]).map(calcType => {
                        const selected = row.calcType === calcType;
                        return (
                          <Pressable
                            key={calcType}
                            accessibilityRole="button"
                            onPress={() => updateRow(row.id, { calcType })}
                            style={[
                              styles.calcChip,
                              selected && styles.calcChipSelected,
                            ]}>
                            <Text
                              style={[
                                styles.calcChipText,
                                selected && styles.calcChipTextSelected,
                              ]}>
                              {t(`${T}calcTypes.${calcType}`)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.typeLabel}>{t(`${T}calcValueLabel`)}</Text>
                    <TextInput
                      value={row.calcValue}
                      onChangeText={value => updateRow(row.id, { calcValue: value })}
                      onFocus={scrollToFocusedField}
                      keyboardType="decimal-pad"
                      placeholder={
                        row.calcType === 'percentage'
                          ? t(`${T}calcValuePlaceholderPercent`)
                          : t(`${T}calcValuePlaceholderFixed`)
                      }
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                    />

                    <Text style={styles.typeLabel}>{t(`${T}reasonLabel`)}</Text>
                    <TextInput
                      value={row.reason}
                      onChangeText={value => updateRow(row.id, { reason: value })}
                      onFocus={scrollToFocusedField}
                      placeholder={t(`${T}reasonPlaceholder`)}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.inputLast]}
                    />
                  </View>
                ))}

                {components.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={addRow}
                    style={styles.addRowBtn}>
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.addRowLabel}>{t(`${T}addComponent`)}</Text>
                  </Pressable>
                ) : null}

                {showOverlapHint ? (
                  <View style={styles.overlapNotice}>
                    <MaterialCommunityIcons
                      name="alert-outline"
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.overlapText}>{t(`${T}overlapHint`)}</Text>
                  </View>
                ) : null}

                {apiError ? <Text style={styles.error}>{apiError}</Text> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={handleDismiss}
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
                    <Text style={styles.btnPrimaryLabel}>{t(`${T}assign`)}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <DatePicker
        visible={dateField === 'from'}
        value={effectiveFrom || new Date().toISOString().slice(0, 10)}
        onDismiss={() => setDateField(null)}
        onConfirm={iso => {
          setEffectiveFrom(iso);
          setDateField(null);
        }}
        title={t(`${T}effectiveFromLabel`)}
        cancelLabel={t(`${T}cancel`)}
        confirmLabel={t(`${T}confirmDate`)}
      />

      <DatePicker
        visible={dateField === 'to'}
        value={effectiveTo || effectiveFrom || new Date().toISOString().slice(0, 10)}
        onDismiss={() => setDateField(null)}
        onConfirm={iso => {
          setEffectiveTo(iso);
          setDateField(null);
        }}
        title={t(`${T}effectiveToLabel`)}
        cancelLabel={t(`${T}cancel`)}
        confirmLabel={t(`${T}confirmDate`)}
        minDate={effectiveFrom || undefined}
      />
    </>
  );
}
