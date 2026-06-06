import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  GeneratePayrollEmployeeOption,
  GeneratePayrollRequest,
  GeneratePayrollScope,
} from '@src/types/generatePayroll';

export type GeneratePayrollModalProps = {
  visible: boolean;
  submitting: boolean;
  currentMonthLabel: string;
  currentYear: number;
  previewEmployees: GeneratePayrollEmployeeOption[];
  pageEmployees: GeneratePayrollEmployeeOption[];
  onDismiss: () => void;
  onSubmit: (payload: GeneratePayrollRequest) => void;
};

const SCOPES: GeneratePayrollScope[] = ['preview', 'selected', 'all'];

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.background : '#f8fafc';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheetWrap: { flex: 1, justifyContent: 'flex-end', paddingTop: 48 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      maxHeight: '92%',
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
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(45, 212, 191, 0.35)' : '#99f6e4',
      backgroundColor: scheme === 'dark' ? 'rgba(19, 78, 74, 0.35)' : '#f0fdfa',
      marginBottom: 16,
    },
    noticeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 10,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: {
      paddingHorizontal: 12,
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
    chipDisabled: { opacity: 0.45 },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTextActive: { color: colors.primary },
    chipHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
      marginBottom: 8,
    },
    toggleTextWrap: { flex: 1 },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    toggleHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    selectActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginBottom: 8,
    },
    selectActionText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    employeeList: { gap: 6 },
    employeeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    employeeRowSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    employeeMain: { flex: 1, minWidth: 0 },
    employeeName: { fontSize: 14, fontWeight: '600', color: colors.text },
    employeeMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    kindBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
    },
    kindPreview: {
      backgroundColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.15)' : '#fffbeb',
    },
    kindGenerated: {
      backgroundColor: scheme === 'dark' ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4',
    },
    kindTextPreview: {
      fontSize: 10,
      fontWeight: '700',
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    kindTextGenerated: {
      fontSize: 10,
      fontWeight: '700',
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    emptySelect: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    emptySelectText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
    errorText: { fontSize: 13, color: colors.danger, marginTop: 8 },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 20 : 16,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
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
    cancelBtn: { paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
    cancelLabel: { color: colors.primary, fontWeight: '600', fontSize: 16 },
    optionsSectionLabelSpaced: { marginTop: 16 },
  });
}

export function GeneratePayrollModal({
  visible,
  submitting,
  currentMonthLabel,
  currentYear,
  previewEmployees,
  pageEmployees,
  onDismiss,
  onSubmit,
}: GeneratePayrollModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [scope, setScope] = useState<GeneratePayrollScope>('preview');
  const [sendPdf, setSendPdf] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setScope(previewEmployees.length > 0 ? 'preview' : 'all');
    setSendPdf(false);
    setSelectedIds(previewEmployees.map(item => item.id));
    setValidationError(null);
  }, [previewEmployees, visible]);

  const toggleEmployee = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id],
    );
    setValidationError(null);
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedIds(pageEmployees.map(item => item.id));
    setValidationError(null);
  }, [pageEmployees]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setValidationError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (scope === 'all') {
      onSubmit({ all_employees: true, send_pdf: sendPdf });
      return;
    }

    const ids =
      scope === 'preview'
        ? previewEmployees.map(item => item.id)
        : selectedIds;

    if (ids.length === 0) {
      setValidationError(t('home.payrollManagement.generateModal.validationNoEmployees'));
      return;
    }

    onSubmit({
      employee_id: ids,
      all_employees: false,
      send_pdf: sendPdf,
    });
  }, [onSubmit, previewEmployees, scope, selectedIds, sendPdf, t]);

  const canSubmit =
    !submitting &&
    (scope === 'all' ||
      (scope === 'preview' && previewEmployees.length > 0) ||
      (scope === 'selected' && selectedIds.length > 0));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={submitting ? undefined : onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('home.payrollManagement.generateModal.cancel')}
          onPress={submitting ? undefined : onDismiss}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('home.payrollManagement.generateModal.title')}</Text>
              <Text style={styles.subtitle}>
                {t('home.payrollManagement.generateModal.subtitle')}
              </Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.noticeCard}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.noticeText}>
                  {t('home.payrollManagement.generateModal.currentMonthNotice', {
                    month: currentMonthLabel,
                    year: currentYear,
                  })}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>
                {t('home.payrollManagement.generateModal.scopeLabel')}
              </Text>
              <View style={styles.chipRow}>
                {SCOPES.map(key => {
                  const active = scope === key;
                  const disabled =
                    key === 'preview' && previewEmployees.length === 0;
                  const count =
                    key === 'preview'
                      ? previewEmployees.length
                      : key === 'selected'
                        ? pageEmployees.length
                        : null;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active, disabled }}
                      disabled={disabled || submitting}
                      onPress={() => {
                        setScope(key);
                        setValidationError(null);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        disabled && styles.chipDisabled,
                        pressed && !disabled && { opacity: 0.9 },
                      ]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(`home.payrollManagement.generateModal.scopes.${key}`)}
                      </Text>
                      {count != null ? (
                        <Text style={styles.chipHint}>
                          {t('home.payrollManagement.generateModal.scopeCount', { count })}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {scope === 'selected' ? (
                <>
                  <View style={styles.selectActions}>
                    <Pressable accessibilityRole="button" onPress={selectAllOnPage}>
                      <Text style={styles.selectActionText}>
                        {t('home.payrollManagement.generateModal.selectAll')}
                      </Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={clearSelection}>
                      <Text style={styles.selectActionText}>
                        {t('home.payrollManagement.generateModal.clearSelection')}
                      </Text>
                    </Pressable>
                  </View>
                  {pageEmployees.length === 0 ? (
                    <View style={styles.emptySelect}>
                      <Text style={styles.emptySelectText}>
                        {t('home.payrollManagement.generateModal.noPageEmployees')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.employeeList}>
                      {pageEmployees.map(item => {
                        const selected = selectedIds.includes(item.id);
                        const isPreview = item.kind === 'preview';
                        return (
                          <Pressable
                            key={item.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            onPress={() => toggleEmployee(item.id)}
                            style={[
                              styles.employeeRow,
                              selected && styles.employeeRowSelected,
                            ]}>
                            <View
                              style={[styles.checkbox, selected && styles.checkboxSelected]}>
                              {selected ? (
                                <MaterialCommunityIcons name="check" size={14} color="#fff" />
                              ) : null}
                            </View>
                            <View style={styles.employeeMain}>
                              <Text style={styles.employeeName} numberOfLines={1}>
                                {item.name}
                              </Text>
                              <Text style={styles.employeeMeta} numberOfLines={1}>
                                {item.employeeCode}
                              </Text>
                              <View
                                style={[
                                  styles.kindBadge,
                                  isPreview ? styles.kindPreview : styles.kindGenerated,
                                ]}>
                                <Text
                                  style={
                                    isPreview ? styles.kindTextPreview : styles.kindTextGenerated
                                  }>
                                  {isPreview
                                    ? t('home.payrollManagement.statusPreview')
                                    : t('home.payrollManagement.statusGenerated')}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              <Text
                style={[
                  styles.sectionLabel,
                  scope === 'selected' ? styles.optionsSectionLabelSpaced : null,
                ]}>
                {t('home.payrollManagement.generateModal.optionsLabel')}
              </Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleLabel}>
                    {t('home.payrollManagement.generateModal.sendPdfLabel')}
                  </Text>
                  <Text style={styles.toggleHint}>
                    {t('home.payrollManagement.generateModal.sendPdfHint')}
                  </Text>
                </View>
                <Switch
                  value={sendPdf}
                  onValueChange={setSendPdf}
                  disabled={submitting}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {validationError ? (
                <Text style={styles.errorText}>{validationError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                  pressed && canSubmit && { opacity: 0.9 },
                ]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialCommunityIcons name="cash-check" size={20} color="#fff" />
                )}
                <Text style={styles.submitLabel}>
                  {t('home.payrollManagement.generateModal.submit')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onDismiss}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.cancelLabel}>
                  {t('home.payrollManagement.generateModal.cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
