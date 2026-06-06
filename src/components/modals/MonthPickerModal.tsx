import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { YearWheelPicker } from '@src/components/modals/YearWheelPicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 480);
const DEFAULT_MIN_YEAR = 2020;
const DEFAULT_MAX_YEAR = 2030;

type PickerMode = 'month' | 'year';

export type MonthPickerModalProps = {
  visible: boolean;
  month: number;
  year: number;
  monthLabels: string[];
  onDismiss: () => void;
  onConfirm: (month: number, year: number) => void;
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  selectYearLabel?: string;
  dismissOnBackdropPress?: boolean;
  minYear?: number;
  maxYear?: number;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const yearSelectorBg = isDark ? '#334155' : colors.background;
  const yearSelectorBorder = isDark ? '#64748b' : colors.border;

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    sheetWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 400,
      maxHeight: SHEET_MAX_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    pickerModeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    pickerModeBackBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerModeTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    yearSelectorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 112,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: yearSelectorBorder,
      backgroundColor: yearSelectorBg,
    },
    yearSelectorBtnPressed: {
      opacity: 0.88,
    },
    yearSelectorText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    pickerGrid: {
      gap: 8,
      marginBottom: 8,
    },
    pickerRow: {
      flexDirection: 'row',
      gap: 8,
    },
    monthPickCell: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthPickCellActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    monthPickCellPressed: {
      opacity: 0.88,
    },
    monthPickText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    monthPickTextActive: {
      color: '#fff',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    footerBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerBtnPressed: {
      opacity: 0.88,
    },
    cancelBtn: {
      backgroundColor: colors.secondaryButton,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
    },
    cancelLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    confirmLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

function clampYear(value: number, minYear: number, maxYear: number): number {
  return Math.min(maxYear, Math.max(minYear, value));
}

function buildYearsList(minYear: number, maxYear: number): number[] {
  const list: number[] = [];
  for (let y = minYear; y <= maxYear; y += 1) {
    list.push(y);
  }
  return list;
}

export function MonthPickerModal({
  visible,
  month,
  year,
  monthLabels,
  onDismiss,
  onConfirm,
  title,
  cancelLabel,
  confirmLabel,
  selectYearLabel,
  dismissOnBackdropPress = true,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
}: MonthPickerModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [pickerMode, setPickerMode] = useState<PickerMode>('month');
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftYear, setDraftYear] = useState(year);
  const [yearWheelResetToken, setYearWheelResetToken] = useState(0);

  const resolvedMinYear = Math.min(minYear, maxYear);
  const resolvedMaxYear = Math.max(minYear, maxYear);

  useEffect(() => {
    if (visible) {
      setDraftMonth(month);
      setDraftYear(clampYear(year, resolvedMinYear, resolvedMaxYear));
      setPickerMode('month');
    }
  }, [visible, month, year, resolvedMinYear, resolvedMaxYear]);

  const resolvedTitle = title ?? t('modals.monthPicker.title');
  const resolvedCancel = cancelLabel ?? t('modals.monthPicker.cancel');
  const resolvedConfirm = confirmLabel ?? t('modals.monthPicker.confirm');
  const resolvedSelectYear =
    selectYearLabel ?? t('modals.monthPicker.selectYear', { defaultValue: 'Select year' });

  const yearsList = useMemo(
    () => buildYearsList(resolvedMinYear, resolvedMaxYear),
    [resolvedMinYear, resolvedMaxYear],
  );

  const openYearPicker = useCallback(() => {
    setYearWheelResetToken(token => token + 1);
    setPickerMode('year');
  }, []);

  const handleDraftYearChange = useCallback((nextYear: number) => {
    setDraftYear(nextYear);
  }, []);

  const goBackToMonthPicker = useCallback(() => {
    setPickerMode('month');
  }, []);

  const handleRequestClose = useCallback(() => {
    if (pickerMode === 'year') {
      goBackToMonthPicker();
      return;
    }
    onDismiss();
  }, [goBackToMonthPicker, onDismiss, pickerMode]);

  const handleConfirm = useCallback(() => {
    onConfirm(draftMonth, draftYear);
    onDismiss();
  }, [draftMonth, draftYear, onConfirm, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={resolvedCancel}
          onPress={dismissOnBackdropPress ? onDismiss : undefined}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <Text style={styles.title}>{resolvedTitle}</Text>

            {pickerMode === 'year' ? (
              <>
                <View style={styles.pickerModeHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('modals.monthPicker.backToMonth', {
                      defaultValue: 'Back to month picker',
                    })}
                    onPress={goBackToMonthPicker}
                    style={styles.pickerModeBackBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary} />
                  </Pressable>
                  <Text style={styles.pickerModeTitle}>{resolvedSelectYear}</Text>
                  <View style={styles.pickerModeBackBtn} />
                </View>
                <YearWheelPicker
                  years={yearsList}
                  selectedYear={draftYear}
                  onSelectedYearChange={handleDraftYearChange}
                  resetToken={yearWheelResetToken}
                />
              </>
            ) : (
              <>
                <View style={styles.pickerModeHeader}>
                  <View style={styles.pickerModeBackBtn} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={resolvedSelectYear}
                    onPress={openYearPicker}
                    style={({ pressed }) => [
                      styles.yearSelectorBtn,
                      pressed && styles.yearSelectorBtnPressed,
                    ]}>
                    <Text style={styles.yearSelectorText}>{draftYear}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.primary} />
                  </Pressable>
                  <View style={styles.pickerModeBackBtn} />
                </View>
                <View style={styles.pickerGrid}>
                  {[0, 1, 2, 3].map(rowIdx => (
                    <View key={rowIdx} style={styles.pickerRow}>
                      {[1, 2, 3].map(colIdx => {
                        const monthIndex = rowIdx * 3 + colIdx;
                        const isActive = monthIndex === draftMonth;
                        const label = monthLabels[monthIndex - 1] ?? String(monthIndex);
                        return (
                          <Pressable
                            key={monthIndex}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                            onPress={() => setDraftMonth(monthIndex)}
                            style={({ pressed }) => [
                              styles.monthPickCell,
                              isActive && styles.monthPickCellActive,
                              pressed && !isActive && styles.monthPickCellPressed,
                            ]}>
                            <Text
                              style={[
                                styles.monthPickText,
                                isActive && styles.monthPickTextActive,
                              ]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.cancelBtn,
                  pressed && styles.footerBtnPressed,
                ]}>
                <Text style={styles.cancelLabel}>{resolvedCancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.confirmBtn,
                  pressed && styles.footerBtnPressed,
                ]}>
                <Text style={styles.confirmLabel}>{resolvedConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
