import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { todayIso } from '@src/utils/attendanceListDisplay';
import {
    buildMonthGrid,
    compareIso,
    daysInMonth,
    parseIsoDate,
    shiftMonth,
    toIsoDateParts,
    viewFromIso,
    weekdayLabels,
} from '@src/utils/datePicker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, 520);

type PickerMode = 'calendar' | 'month' | 'year';

const YEAR_RANGE_BACK = 100;
const YEAR_RANGE_FORWARD = 5;
const YEAR_ITEM_HEIGHT = 48;
const MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export type DatePickerProps = {
    visible: boolean;
    /** Current value `YYYY-MM-DD`. */
    value: string;
    onDismiss: () => void;
    /** Called when user confirms; receives `YYYY-MM-DD`. */
    onConfirm: (isoDate: string) => void;

    title?: string;
    cancelLabel?: string;
    confirmLabel?: string;
    prevMonthAccessibilityLabel?: string;
    nextMonthAccessibilityLabel?: string;

    /** Inclusive bounds (`YYYY-MM-DD`). */
    minDate?: string;
    maxDate?: string;

    locale?: string;
    /** 0 = Sunday, 1 = Monday */
    weekStartsOn?: 0 | 1;

    dismissOnBackdropPress?: boolean;
};

function buildStyles(colors: AppThemeColors) {
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
        monthHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        monthNavBtn: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
        },
        monthTitleWrap: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
        },
        monthTitleTouchable: {
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 6,
        },
        monthTitleTouchablePressed: {
            backgroundColor: colors.secondaryButton,
        },
        monthText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.primary,
        },
        yearText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.primary,
        },
        monthTextSep: {
            fontSize: 16,
            fontWeight: '400',
            color: colors.textMuted,
        },
        weekdayRow: {
            flexDirection: 'row',
            marginBottom: 8,
        },
        weekdayCell: {
            flex: 1,
            alignItems: 'center',
        },
        weekdayText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
        },
        grid: {
            marginBottom: 14,
        },
        weekRow: {
            flexDirection: 'row',
        },
        dayCell: {
            flex: 1,
            aspectRatio: 1,
            maxHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2,
        },
        dayInner: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dayInnerSelected: {
            backgroundColor: colors.primary,
        },
        dayInnerToday: {
            borderWidth: 1,
            borderColor: colors.primary,
        },
        dayInnerPressed: {
            opacity: 0.85,
        },
        dayText: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        dayTextMuted: {
            color: colors.textMuted,
            opacity: 0.45,
        },
        dayTextSelected: {
            color: '#fff',
        },
        dayTextDisabled: {
            opacity: 0.28,
        },
        pickerGrid: {
            marginBottom: 14,
        },
        pickerRow: {
            flexDirection: 'row',
        },
        monthPickCell: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            margin: 3,
            borderRadius: 10,
            backgroundColor: colors.secondaryButton,
        },
        monthPickCellActive: {
            backgroundColor: colors.primary,
        },
        monthPickCellPressed: {
            opacity: 0.8,
        },
        monthPickText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        monthPickTextActive: {
            color: '#fff',
            fontWeight: '700',
        },
        monthPickTextDisabled: {
            opacity: 0.3,
        },
        yearList: {
            marginBottom: 14,
        },
        yearItem: {
            height: YEAR_ITEM_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            marginVertical: 2,
            marginHorizontal: 4,
        },
        yearItemActive: {
            backgroundColor: colors.primary,
        },
        yearItemCurrent: {
            borderWidth: 1,
            borderColor: colors.primary,
        },
        yearItemPressed: {
            backgroundColor: colors.secondaryButton,
        },
        yearItemText: {
            fontSize: 17,
            fontWeight: '600',
            color: colors.text,
        },
        yearItemTextActive: {
            color: '#fff',
            fontWeight: '700',
        },
        pickerModeHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            gap: 4,
        },
        pickerModeBackBtn: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
        },
        pickerModeTitle: {
            flex: 1,
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
        },
        footer: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
        },
        footerBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
        },
        cancelBtn: {
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        confirmBtn: {
            backgroundColor: colors.primary,
        },
        footerBtnPressed: {
            opacity: 0.88,
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

export function DatePicker({
    visible,
    value,
    onDismiss,
    onConfirm,
    title,
    cancelLabel,
    confirmLabel,
    prevMonthAccessibilityLabel,
    nextMonthAccessibilityLabel,
    minDate,
    maxDate,
    locale: localeProp,
    weekStartsOn = 0,
    dismissOnBackdropPress = true,
}: DatePickerProps): React.JSX.Element {
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => buildStyles(colors), [colors]);
    const locale = localeProp ?? i18n.language;
    const today = useMemo(() => todayIso(), []);

    const resolvedTitle = title ?? t('modals.datePicker.title');
    const resolvedCancel = cancelLabel ?? t('modals.datePicker.cancel');
    const resolvedConfirm = confirmLabel ?? t('modals.datePicker.confirm');
    const prevMonthA11y = prevMonthAccessibilityLabel ?? t('modals.datePicker.prevMonth');
    const nextMonthA11y = nextMonthAccessibilityLabel ?? t('modals.datePicker.nextMonth');

    const effectiveMax = maxDate ?? today;

    const [draftIso, setDraftIso] = useState(value);
    const [viewYear, setViewYear] = useState(() => viewFromIso(value, { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }).y);
    const [viewMonth, setViewMonth] = useState(() => viewFromIso(value, { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }).m);
    const [pickerMode, setPickerMode] = useState<PickerMode>('calendar');
    const yearListRef = useRef<FlatList<number>>(null);

    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const yearsList = useMemo(() => {
        const startYear = currentYear - YEAR_RANGE_BACK;
        const endYear = currentYear + YEAR_RANGE_FORWARD;
        const years: number[] = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return years;
    }, [currentYear]);

    useEffect(() => {
        if (!visible) {
            return;
        }
        setDraftIso(value);
        const v = viewFromIso(value, { y: new Date().getFullYear(), m: new Date().getMonth() + 1 });
        setViewYear(v.y);
        setViewMonth(v.m);
        setPickerMode('calendar');
    }, [visible, value]);

    const scrollToYear = useCallback((targetYear: number) => {
        const startYear = currentYear - YEAR_RANGE_BACK;
        const idx = targetYear - startYear;
        if (idx >= 0 && idx < yearsList.length) {
            setTimeout(() => {
                yearListRef.current?.scrollToIndex({
                    index: Math.max(0, idx - 2),
                    animated: false,
                });
            }, 100);
        }
    }, [currentYear, yearsList.length]);

    const openYearPicker = useCallback(() => {
        setPickerMode('year');
        scrollToYear(viewYear);
    }, [scrollToYear, viewYear]);

    const openMonthPicker = useCallback(() => {
        setPickerMode('month');
    }, []);

    const selectYear = useCallback((year: number) => {
        setViewYear(year);
        setPickerMode('month');
    }, []);

    const selectMonth = useCallback((month: number) => {
        setViewMonth(month);
        setPickerMode('calendar');
    }, []);

    const monthLabels = useMemo(() => {
        return MONTH_NAMES_EN.map((_, i) => {
            const d = new Date(viewYear, i, 1);
            return d.toLocaleDateString(locale, { month: 'short' });
        });
    }, [locale, viewYear]);

    const isMonthDisabled = useCallback((month: number) => {
        const firstOfMonth = toIsoDateParts(viewYear, month, 1);
        const lastOfMonth = toIsoDateParts(viewYear, month, daysInMonth(viewYear, month));
        if (minDate && compareIso(lastOfMonth, minDate) < 0) {
            return true;
        }
        if (compareIso(firstOfMonth, effectiveMax) > 0) {
            return true;
        }
        return false;
    }, [effectiveMax, minDate, viewYear]);

    const isYearDisabled = useCallback((year: number) => {
        const firstOfYear = toIsoDateParts(year, 1, 1);
        const lastOfYear = toIsoDateParts(year, 12, 31);
        if (minDate && compareIso(lastOfYear, minDate) < 0) {
            return true;
        }
        if (compareIso(firstOfYear, effectiveMax) > 0) {
            return true;
        }
        return false;
    }, [effectiveMax, minDate]);

    const weekdays = useMemo(() => weekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);

    const cells = useMemo(
        () =>
            buildMonthGrid({
                viewYear,
                viewMonth,
                selectedIso: draftIso,
                todayIso: today,
                minDate,
                maxDate: effectiveMax,
                weekStartsOn,
            }),
        [draftIso, effectiveMax, minDate, today, viewMonth, viewYear, weekStartsOn],
    );

    const canPrevMonth = useMemo(() => {
        if (!minDate) {
            return true;
        }
        const { y, m } = shiftMonth(viewYear, viewMonth, -1);
        const lastDayPrev = toIsoDateParts(y, m, daysInMonth(y, m));
        return compareIso(lastDayPrev, minDate) >= 0;
    }, [minDate, viewMonth, viewYear]);

    const canNextMonth = useMemo(() => {
        const { y, m } = shiftMonth(viewYear, viewMonth, 1);
        const firstNext = toIsoDateParts(y, m, 1);
        return compareIso(firstNext, effectiveMax) <= 0;
    }, [effectiveMax, viewMonth, viewYear]);

    const goPrevMonth = useCallback(() => {
        if (!canPrevMonth) {
            return;
        }
        const next = shiftMonth(viewYear, viewMonth, -1);
        setViewYear(next.y);
        setViewMonth(next.m);
    }, [canPrevMonth, viewMonth, viewYear]);

    const goNextMonth = useCallback(() => {
        if (!canNextMonth) {
            return;
        }
        const next = shiftMonth(viewYear, viewMonth, 1);
        setViewYear(next.y);
        setViewMonth(next.m);
    }, [canNextMonth, viewMonth, viewYear]);

    const handleConfirm = useCallback(() => {
        if (!parseIsoDate(draftIso)) {
            return;
        }
        if (minDate && compareIso(draftIso, minDate) < 0) {
            return;
        }
        if (compareIso(draftIso, effectiveMax) > 0) {
            return;
        }
        onConfirm(draftIso);
        onDismiss();
    }, [draftIso, effectiveMax, minDate, onConfirm, onDismiss]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}>
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

                        {pickerMode === 'calendar' && (
                            <>
                                <View style={styles.monthHeader}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={prevMonthA11y}
                                        disabled={!canPrevMonth}
                                        onPress={goPrevMonth}
                                        style={({ pressed }) => [
                                            styles.monthNavBtn,
                                            !canPrevMonth && { opacity: 0.35 },
                                            pressed && canPrevMonth && { opacity: 0.7 },
                                        ]}>
                                        <MaterialCommunityIcons
                                            name="chevron-left"
                                            size={26}
                                            color={canPrevMonth ? colors.primary : colors.textMuted}
                                        />
                                    </Pressable>
                                    <View style={styles.monthTitleWrap}>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={openMonthPicker}
                                            style={({ pressed }) => [
                                                styles.monthTitleTouchable,
                                                pressed && styles.monthTitleTouchablePressed,
                                            ]}>
                                            <Text style={styles.monthText}>
                                                {new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(locale, { month: 'long' })}
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={openYearPicker}
                                            style={({ pressed }) => [
                                                styles.monthTitleTouchable,
                                                pressed && styles.monthTitleTouchablePressed,
                                            ]}>
                                            <Text style={styles.yearText}>{viewYear}</Text>
                                        </Pressable>
                                    </View>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={nextMonthA11y}
                                        disabled={!canNextMonth}
                                        onPress={goNextMonth}
                                        style={({ pressed }) => [
                                            styles.monthNavBtn,
                                            !canNextMonth && { opacity: 0.35 },
                                            pressed && canNextMonth && { opacity: 0.7 },
                                        ]}>
                                        <MaterialCommunityIcons
                                            name="chevron-right"
                                            size={26}
                                            color={canNextMonth ? colors.primary : colors.textMuted}
                                        />
                                    </Pressable>
                                </View>

                                <View style={styles.weekdayRow}>
                                    {weekdays.map(label => (
                                        <View key={label} style={styles.weekdayCell}>
                                            <Text style={styles.weekdayText}>{label}</Text>
                                        </View>
                                    ))}
                                </View>

                                <View style={styles.grid}>
                                    {Array.from(
                                        { length: Math.ceil(cells.length / 7) },
                                        (_, ri) => (
                                            <View key={ri} style={styles.weekRow}>
                                                {cells.slice(ri * 7, ri * 7 + 7).map(cell => (
                                                    <Pressable
                                                        key={cell.iso}
                                                        accessibilityRole="button"
                                                        accessibilityState={{ selected: cell.isSelected, disabled: cell.disabled }}
                                                        disabled={cell.disabled}
                                                        onPress={() => setDraftIso(cell.iso)}
                                                        style={styles.dayCell}>
                                                        <View
                                                            style={[
                                                                styles.dayInner,
                                                                cell.isSelected && styles.dayInnerSelected,
                                                                cell.isToday && !cell.isSelected && styles.dayInnerToday,
                                                            ]}>
                                                            <Text
                                                                style={[
                                                                    styles.dayText,
                                                                    !cell.inMonth && styles.dayTextMuted,
                                                                    cell.isSelected && styles.dayTextSelected,
                                                                    cell.disabled && styles.dayTextDisabled,
                                                                ]}>
                                                                {cell.day}
                                                            </Text>
                                                        </View>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        ),
                                    )}
                                </View>
                            </>
                        )}

                        {pickerMode === 'year' && (
                            <>
                                <View style={styles.pickerModeHeader}>
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => setPickerMode('calendar')}
                                        style={styles.pickerModeBackBtn}>
                                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary} />
                                    </Pressable>
                                    <Text style={styles.pickerModeTitle}>
                                        {t('modals.datePicker.selectYear', { defaultValue: 'Select Year' })}
                                    </Text>
                                    <View style={styles.pickerModeBackBtn} />
                                </View>
                                <FlatList
                                    ref={yearListRef}
                                    data={yearsList}
                                    keyExtractor={item => String(item)}
                                    style={styles.yearList}
                                    getItemLayout={(_, index) => ({
                                        length: YEAR_ITEM_HEIGHT + 4,
                                        offset: (YEAR_ITEM_HEIGHT + 4) * index,
                                        index,
                                    })}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item: year }) => {
                                        const isActive = year === viewYear;
                                        const isCurrent = year === currentYear;
                                        const disabled = isYearDisabled(year);
                                        return (
                                            <Pressable
                                                accessibilityRole="button"
                                                disabled={disabled}
                                                onPress={() => selectYear(year)}
                                                style={({ pressed }) => [
                                                    styles.yearItem,
                                                    isActive && styles.yearItemActive,
                                                    !isActive && isCurrent && styles.yearItemCurrent,
                                                    pressed && !isActive && styles.yearItemPressed,
                                                    disabled && { opacity: 0.3 },
                                                ]}>
                                                <Text
                                                    style={[
                                                        styles.yearItemText,
                                                        isActive && styles.yearItemTextActive,
                                                    ]}>
                                                    {year}
                                                </Text>
                                            </Pressable>
                                        );
                                    }}
                                />
                            </>
                        )}

                        {pickerMode === 'month' && (
                            <>
                                <View style={styles.pickerModeHeader}>
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => setPickerMode('calendar')}
                                        style={styles.pickerModeBackBtn}>
                                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary} />
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={openYearPicker}
                                        style={({ pressed }) => [
                                            styles.monthTitleTouchable,
                                            pressed && styles.monthTitleTouchablePressed,
                                        ]}>
                                        <Text style={styles.pickerModeTitle}>{viewYear}</Text>
                                    </Pressable>
                                    <View style={styles.pickerModeBackBtn} />
                                </View>
                                <View style={styles.pickerGrid}>
                                    {[0, 1, 2, 3].map(rowIdx => (
                                        <View key={rowIdx} style={styles.pickerRow}>
                                            {[1, 2, 3].map(colIdx => {
                                                const month = rowIdx * 3 + colIdx;
                                                const isActive = month === viewMonth;
                                                const disabled = isMonthDisabled(month);
                                                return (
                                                    <Pressable
                                                        key={month}
                                                        accessibilityRole="button"
                                                        disabled={disabled}
                                                        onPress={() => selectMonth(month)}
                                                        style={({ pressed }) => [
                                                            styles.monthPickCell,
                                                            isActive && styles.monthPickCellActive,
                                                            pressed && !isActive && styles.monthPickCellPressed,
                                                        ]}>
                                                        <Text
                                                            style={[
                                                                styles.monthPickText,
                                                                isActive && styles.monthPickTextActive,
                                                                disabled && styles.monthPickTextDisabled,
                                                            ]}>
                                                            {monthLabels[month - 1]}
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

export type UseDatePickerOptions = {
    initialValue?: string;
    onConfirm?: (isoDate: string) => void;
};

/** Local state helper for {@link DatePicker}. */
export function useDatePicker(options: UseDatePickerOptions = {}) {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState(options.initialValue ?? todayIso());

    const present = useCallback(() => setVisible(true), []);
    const dismiss = useCallback(() => setVisible(false), []);

    const onConfirmCallback = options.onConfirm;

    const onConfirm = useCallback(
        (iso: string) => {
            setValue(iso);
            onConfirmCallback?.(iso);
            setVisible(false);
        },
        [onConfirmCallback],
    );

    const pickerProps: DatePickerProps = {
        visible,
        value,
        onDismiss: dismiss,
        onConfirm,
    };

    return {
        value,
        setValue,
        visible,
        present,
        dismiss,
        pickerProps,
    };
}
