import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmployeePickerList } from '@src/hooks/useEmployeePickerList';
import type { EmployeeListItem } from '@src/types/employeeList';
import type { LeaveBalanceMutationItem } from '@src/types/empLeaveBalance';
import type { LeaveConfigEntry } from '@src/types/markAttendance';
import type { AppThemeColors } from '@src/theme/palettes';

const T = 'home.leaveBalances.assignModal.';
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

type AssignRow = {
  id: string;
  leaveConfigId: number | null;
  allocated: string;
};

export type AssignLeaveBalanceModalProps = {
  visible: boolean;
  companyId: number | null;
  preselectedEmployee: SelectedEmployee | null;
  leaveConfigs: LeaveConfigEntry[];
  loadingConfigs: boolean;
  excludeConfigIds: number[];
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (
    employeeId: number,
    leaves: LeaveBalanceMutationItem[],
    employeeName: string,
  ) => void;
};

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

function parseAllocated(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100) / 100;
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
    employeePlaceholder: { flex: 1, fontSize: 14, color: colors.textMuted },
    changeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
    },
    changeBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
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
    allocatedInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    maxHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
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

function createRow(): AssignRow {
  return { id: String(Date.now()) + Math.random(), leaveConfigId: null, allocated: '' };
}

export function AssignLeaveBalanceModal({
  visible,
  companyId,
  preselectedEmployee,
  leaveConfigs,
  loadingConfigs,
  excludeConfigIds,
  submitting,
  onDismiss,
  onSubmit,
}: AssignLeaveBalanceModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(null);
  const [rows, setRows] = useState<AssignRow[]>([createRow()]);
  const [error, setError] = useState<string | null>(null);
  const [employeePickerVisible, setEmployeePickerVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top),
    [insets.top, keyboardHeight, windowHeight],
  );

  const sheetSizeStyle = useMemo(
    (): ViewStyle => ({
      maxHeight: layout.sheetMaxHeight,
      ...(layout.sheetHeight != null ? { height: layout.sheetHeight } : null),
    }),
    [layout.sheetHeight, layout.sheetMaxHeight],
  );

  const scrollToFocusedField = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const picker = useEmployeePickerList({
    companyId: employeePickerVisible ? companyId : null,
  });

  const activeEmployees = useMemo(
    () => picker.employees.filter(e => isEmployeeActive(e.status)),
    [picker.employees],
  );

  const availableConfigs = useMemo(
    () => leaveConfigs.filter(c => !excludeConfigIds.includes(c.id)),
    [excludeConfigIds, leaveConfigs],
  );

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    setSelectedEmployee(preselectedEmployee);
    setRows([createRow()]);
    setError(null);
    setEmployeePickerVisible(false);
  }, [visible, preselectedEmployee]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const usedConfigIds = useMemo(
    () => rows.map(r => r.leaveConfigId).filter((id): id is number => id != null),
    [rows],
  );

  const validate = useCallback((): string | null => {
    if (!selectedEmployee) {
      return t(`${T}errors.employeeRequired`);
    }
    if (rows.length === 0) {
      return t(`${T}errors.leavesRequired`);
    }
    const ids: number[] = [];
    for (const row of rows) {
      if (row.leaveConfigId == null) {
        return t(`${T}errors.leaveTypeRequired`);
      }
      if (ids.includes(row.leaveConfigId)) {
        return t(`${T}errors.duplicateType`);
      }
      if (parseAllocated(row.allocated) == null) {
        return t(`${T}errors.invalidAllocated`);
      }
      ids.push(row.leaveConfigId);
    }
    return null;
  }, [rows, selectedEmployee, t]);

  const buildPayload = useCallback((): LeaveBalanceMutationItem[] | null => {
    const items: LeaveBalanceMutationItem[] = [];
    const ids: number[] = [];
    for (const row of rows) {
      if (row.leaveConfigId == null) {
        return null;
      }
      if (ids.includes(row.leaveConfigId)) {
        return null;
      }
      const allocated = parseAllocated(row.allocated);
      if (allocated == null) {
        return null;
      }
      ids.push(row.leaveConfigId);
      items.push({ leave_config_id: row.leaveConfigId, total_allocated: allocated });
    }
    return items.length > 0 ? items : null;
  }, [rows]);

  const handleSubmit = useCallback(() => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!selectedEmployee) {
      return;
    }
    const leaves = buildPayload();
    if (!leaves) {
      setError(t(`${T}errors.leavesRequired`));
      return;
    }
    setError(null);
    onSubmit(selectedEmployee.id, leaves, selectedEmployee.name);
  }, [buildPayload, onSubmit, selectedEmployee, t, validate]);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, createRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== id)));
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<AssignRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const renderEmployeeItem = useCallback(
    ({ item }: { item: EmployeeListItem }) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setSelectedEmployee({
            id: item.id,
            name: item.name,
            employeeCode: item.employee_code,
          });
          setEmployeePickerVisible(false);
        }}
        style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.employeeMain}>
          <Text style={styles.employeeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.employeeCode} numberOfLines={1}>{item.employee_code}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
      </Pressable>
    ),
    [colors.primary, styles],
  );

  if (!visible) {
    return null;
  }

  const canAddRow = rows.length < availableConfigs.length;

  return (
    <>
      <Modal
        transparent
        visible={visible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onDismiss}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t('modals.common.closeDialog')}
            onPress={onDismiss}
          />
          <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
            <View style={[styles.sheet, sheetSizeStyle]} accessibilityViewIsModal>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>{t(`${T}title`)}</Text>
                <Text style={styles.subtitle}>{t(`${T}subtitle`, { year: new Date().getFullYear() })}</Text>
              </View>

              <ScrollView
                ref={scrollRef}
                style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: Math.max(12, insets.bottom) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={keyboardHeight > 0}
                bounces={false}>
                {!preselectedEmployee ? (
                  <>
                    <Text style={styles.label}>{t(`${T}employeeLabel`)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setEmployeePickerVisible(true)}
                      style={styles.employeeField}>
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
                  </>
                ) : null}

                <Text style={styles.label}>{t(`${T}leavesLabel`)}</Text>
                {loadingConfigs ? (
                  <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
                ) : availableConfigs.length === 0 ? (
                  <Text style={styles.emptyHint}>{t(`${T}noLeaveTypes`)}</Text>
                ) : (
                  rows.map((row, index) => (
                    <View key={row.id} style={styles.rowCard}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>
                          {t(`${T}rowLabel`, { index: index + 1 })}
                        </Text>
                        {rows.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => removeRow(row.id)}
                            style={styles.removeBtn}>
                            <MaterialCommunityIcons name="close" size={14} color="#dc2626" />
                          </Pressable>
                        ) : null}
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipScroll}
                        contentContainerStyle={styles.chipRow}>
                        {availableConfigs.map(config => {
                          const selected = row.leaveConfigId === config.id;
                          const takenElsewhere =
                            usedConfigIds.includes(config.id) && !selected;
                          return (
                            <Pressable
                              key={config.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected, disabled: takenElsewhere }}
                              disabled={takenElsewhere}
                              onPress={() => updateRow(row.id, { leaveConfigId: config.id })}
                              style={[
                                styles.chip,
                                selected && styles.chipSelected,
                                takenElsewhere && styles.chipDisabled,
                              ]}>
                              <Text
                                style={[
                                  styles.chipText,
                                  selected && styles.chipTextSelected,
                                ]}>
                                {config.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <TextInput
                        value={row.allocated}
                        onChangeText={value => updateRow(row.id, { allocated: value })}
                        onFocus={scrollToFocusedField}
                        keyboardType="decimal-pad"
                        placeholder={t(`${T}allocatedPlaceholder`)}
                        placeholderTextColor={colors.textMuted}
                        style={styles.allocatedInput}
                      />
                    </View>
                  ))
                )}

                {canAddRow && availableConfigs.length > 0 ? (
                  <Pressable accessibilityRole="button" onPress={addRow} style={styles.addRowBtn}>
                    <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
                    <Text style={styles.addRowLabel}>{t(`${T}addRow`)}</Text>
                  </Pressable>
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
                  disabled={submitting || availableConfigs.length === 0}
                  onPress={handleSubmit}
                  style={[
                    styles.btnPrimary,
                    (submitting || availableConfigs.length === 0) && styles.btnDisabled,
                  ]}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryLabel}>{t(`${T}submit`)}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
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
            keyExtractor={item => String(item.id)}
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
