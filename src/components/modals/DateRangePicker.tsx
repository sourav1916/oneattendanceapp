import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { todayIso } from '@src/utils/attendanceListDisplay';
import {
  buildMonthRangeGrid,
  compareIso,
  daysInMonth,
  shiftMonth,
  toIsoDateParts,
  viewFromIso,
  weekdayLabels,
  type RangeCalendarCell,
} from '@src/utils/datePicker';
import { formatLedgerShortDate } from '@src/utils/ledgerFormat';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.82, 560);
const SWIPE_THRESHOLD = 50;
const CALENDAR_SWIPE_MS = 280;
const FADE_IN_MS = 220;
const FADE_OUT_MS = 180;

type PickerMode = 'calendar' | 'month' | 'year';

const YEAR_RANGE_BACK = 100;
const YEAR_RANGE_FORWARD = 5;
const YEAR_ITEM_HEIGHT = 48;
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type DateRangePickerProps = {
  visible: boolean;
  fromDate: string | null;
  toDate: string | null;
  onDismiss: () => void;
  onConfirm: (fromDate: string, toDate: string) => void;
  /** Clears the applied range and typically closes the picker. */
  onClear?: () => void;
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  clearLabel?: string;
  minDate?: string;
  maxDate?: string;
  locale?: string;
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
      marginBottom: 6,
      paddingHorizontal: 2,
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewCol: { flex: 1, minWidth: 0 },
    previewLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 2,
    },
    previewValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    previewArrow: {
      opacity: 0.5,
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
    monthNavBtnDisabled: {
      opacity: 0.35,
    },
    monthNavBtnPressed: {
      opacity: 0.7,
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
    calendarSwipeArea: {
      marginBottom: 14,
      overflow: 'hidden',
    },
    calendarStrip: {
      flexDirection: 'row',
    },
    calendarPage: {
      flex: 1,
    },
    grid: {},
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
    rangeTrack: {
      position: 'absolute',
      top: '50%',
      marginTop: -16,
      height: 32,
      backgroundColor: `${colors.primary}16`,
    },
    rangeTrackStart: {
      left: '50%',
      right: 0,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    rangeTrackEnd: {
      left: 0,
      right: '50%',
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
    rangeTrackMiddle: {
      left: 0,
      right: 0,
    },
    dayInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    dayInnerSelected: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.32,
      shadowRadius: 4,
      elevation: 3,
    },
    dayInnerToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
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
      fontWeight: '700',
    },
    dayTextInRange: {
      color: colors.primary,
      fontWeight: '700',
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
    yearItemDisabled: {
      opacity: 0.3,
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
      justifyContent: 'space-between',
      marginBottom: 12,
      minHeight: 40,
    },
    pickerModeBackBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    pickerModeTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
    pickerModeTitlePressable: {
      flex: 1,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    footerBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    clearBtn: {
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtn: {
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
    },
    confirmBtnDisabled: {
      opacity: 0.45,
    },
    footerBtnPressed: {
      opacity: 0.88,
    },
    clearLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    cancelLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    confirmLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

export function DateRangePicker({
  visible,
  fromDate,
  toDate,
  onDismiss,
  onConfirm,
  onClear,
  title,
  cancelLabel,
  confirmLabel,
  clearLabel,
  minDate,
  maxDate,
  locale: localeProp,
  weekStartsOn = 0,
  dismissOnBackdropPress = true,
}: DateRangePickerProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const locale = localeProp ?? i18n.language;
  const today = useMemo(() => todayIso(), []);

  const resolvedTitle = title ?? t('modals.dateRangePicker.title');
  const resolvedCancel = cancelLabel ?? t('modals.dateRangePicker.cancel');
  const resolvedConfirm = confirmLabel ?? t('modals.dateRangePicker.confirm');
  const resolvedClear = clearLabel ?? t('modals.dateRangePicker.clear');

  const effectiveMax = maxDate;
  const fallbackView = useMemo(
    () =>
      viewFromIso(fromDate ?? toDate ?? today, {
        y: new Date().getFullYear(),
        m: new Date().getMonth() + 1,
      }),
    [fromDate, toDate, today],
  );

  const [renderModal, setRenderModal] = useState(visible);
  const [draftFrom, setDraftFrom] = useState<string | null>(fromDate);
  const [draftTo, setDraftTo] = useState<string | null>(toDate);
  const [viewYear, setViewYear] = useState(fallbackView.y);
  const [viewMonth, setViewMonth] = useState(fallbackView.m);
  const [pickerMode, setPickerMode] = useState<PickerMode>('calendar');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const slideOffset = useRef(new Animated.Value(0)).current;
  const calendarWidthAnim = useRef(new Animated.Value(0)).current;
  const isMonthTransitioning = useRef(false);
  const yearListRef = useRef<FlatList<number>>(null);
  const [calendarWidth, setCalendarWidth] = useState(0);

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
    if (visible) {
      setRenderModal(true);
      fadeAnim.setValue(0);
      sheetAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: FADE_IN_MS,
          useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: 1,
          duration: FADE_IN_MS,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRenderModal(false);
      }
    });
  }, [fadeAnim, sheetAnim, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraftFrom(fromDate);
    setDraftTo(toDate);
    const view = viewFromIso(fromDate ?? toDate ?? today, fallbackView);
    setViewYear(view.y);
    setViewMonth(view.m);
    setPickerMode('calendar');
  }, [visible, fromDate, toDate, today, fallbackView]);

  const scrollToYear = useCallback(
    (targetYear: number) => {
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
    },
    [currentYear, yearsList.length],
  );

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

  const monthLabels = useMemo(
    () =>
      MONTH_NAMES_EN.map((_, i) => {
        const d = new Date(viewYear, i, 1);
        return d.toLocaleDateString(locale, { month: 'short' });
      }),
    [locale, viewYear],
  );

  const isMonthDisabled = useCallback(
    (month: number) => {
      const firstOfMonth = toIsoDateParts(viewYear, month, 1);
      const lastOfMonth = toIsoDateParts(
        viewYear,
        month,
        daysInMonth(viewYear, month),
      );
      if (minDate && compareIso(lastOfMonth, minDate) < 0) {
        return true;
      }
      return effectiveMax != null && compareIso(firstOfMonth, effectiveMax) > 0;
    },
    [effectiveMax, minDate, viewYear],
  );

  const isYearDisabled = useCallback(
    (year: number) => {
      const firstOfYear = toIsoDateParts(year, 1, 1);
      const lastOfYear = toIsoDateParts(year, 12, 31);
      if (minDate && compareIso(lastOfYear, minDate) < 0) {
        return true;
      }
      return effectiveMax != null && compareIso(firstOfYear, effectiveMax) > 0;
    },
    [effectiveMax, minDate],
  );

  const weekdays = useMemo(
    () => weekdayLabels(locale, weekStartsOn),
    [locale, weekStartsOn],
  );

  const cells = useMemo(
    () =>
      buildMonthRangeGrid({
        viewYear,
        viewMonth,
        startIso: draftFrom,
        endIso: draftTo,
        todayIso: today,
        minDate,
        maxDate: effectiveMax,
        weekStartsOn,
      }),
    [
      draftFrom,
      draftTo,
      effectiveMax,
      minDate,
      today,
      viewMonth,
      viewYear,
      weekStartsOn,
    ],
  );

  const prevView = useMemo(
    () => shiftMonth(viewYear, viewMonth, -1),
    [viewMonth, viewYear],
  );
  const nextView = useMemo(
    () => shiftMonth(viewYear, viewMonth, 1),
    [viewMonth, viewYear],
  );

  const buildGridCells = useCallback(
    (year: number, month: number) =>
      buildMonthRangeGrid({
        viewYear: year,
        viewMonth: month,
        startIso: draftFrom,
        endIso: draftTo,
        todayIso: today,
        minDate,
        maxDate: effectiveMax,
        weekStartsOn,
      }),
    [draftFrom, draftTo, effectiveMax, minDate, today, weekStartsOn],
  );

  const prevCells = useMemo(
    () => buildGridCells(prevView.y, prevView.m),
    [buildGridCells, prevView.m, prevView.y],
  );
  const nextCells = useMemo(
    () => buildGridCells(nextView.y, nextView.m),
    [buildGridCells, nextView.m, nextView.y],
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
    if (effectiveMax == null) {
      return true;
    }
    const { y, m } = shiftMonth(viewYear, viewMonth, 1);
    const firstNext = toIsoDateParts(y, m, 1);
    return compareIso(firstNext, effectiveMax) <= 0;
  }, [effectiveMax, viewMonth, viewYear]);

  const applyMonthShift = useCallback((direction: 'prev' | 'next') => {
    const next =
      direction === 'prev'
        ? shiftMonth(viewYear, viewMonth, -1)
        : shiftMonth(viewYear, viewMonth, 1);
    setViewYear(next.y);
    setViewMonth(next.m);
  }, [viewMonth, viewYear]);

  const animateMonthChange = useCallback(
    (direction: 'prev' | 'next') => {
      if (isMonthTransitioning.current) {
        return;
      }
      if (direction === 'prev' && !canPrevMonth) {
        return;
      }
      if (direction === 'next' && !canNextMonth) {
        return;
      }

      const width = calendarWidth;
      if (width <= 0) {
        applyMonthShift(direction);
        return;
      }

      isMonthTransitioning.current = true;
      const toValue = direction === 'next' ? -width : width;

      Animated.timing(slideOffset, {
        toValue,
        duration: CALENDAR_SWIPE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          applyMonthShift(direction);
        }
        slideOffset.setValue(0);
        isMonthTransitioning.current = false;
      });
    },
    [applyMonthShift, calendarWidth, canNextMonth, canPrevMonth, slideOffset],
  );

  const goPrevMonth = useCallback(() => {
    animateMonthChange('prev');
  }, [animateMonthChange]);

  const goNextMonth = useCallback(() => {
    animateMonthChange('next');
  }, [animateMonthChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          pickerMode === 'calendar' &&
          !isMonthTransitioning.current &&
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          if (isMonthTransitioning.current) {
            return;
          }
          let dx = gesture.dx;
          const width = calendarWidth;
          if (dx < 0 && !canNextMonth) {
            dx *= 0.2;
          } else if (dx > 0 && !canPrevMonth) {
            dx *= 0.2;
          } else if (width > 0) {
            dx = Math.max(-width, Math.min(width, dx));
          }
          slideOffset.setValue(dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (isMonthTransitioning.current) {
            return;
          }
          if (gesture.dx <= -SWIPE_THRESHOLD && canNextMonth) {
            animateMonthChange('next');
            return;
          }
          if (gesture.dx >= SWIPE_THRESHOLD && canPrevMonth) {
            animateMonthChange('prev');
            return;
          }
          Animated.spring(slideOffset, {
            toValue: 0,
            useNativeDriver: true,
            tension: 140,
            friction: 16,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(slideOffset, {
            toValue: 0,
            useNativeDriver: true,
            tension: 140,
            friction: 16,
          }).start();
        },
      }),
    [
      animateMonthChange,
      calendarWidth,
      canNextMonth,
      canPrevMonth,
      pickerMode,
      slideOffset,
    ],
  );

  const canConfirm = draftFrom != null && draftTo != null;

  const hintText = useMemo(() => {
    if (draftFrom == null) {
      return t('modals.dateRangePicker.selectStart');
    }
    if (draftTo == null) {
      return t('modals.dateRangePicker.selectEnd');
    }
    return t('modals.dateRangePicker.adjustHint');
  }, [draftFrom, draftTo, t]);

  const handleDayPress = useCallback(
    (iso: string) => {
      if (effectiveMax != null && compareIso(iso, effectiveMax) > 0) {
        return;
      }
      if (minDate && compareIso(iso, minDate) < 0) {
        return;
      }
      if (draftFrom == null || (draftFrom != null && draftTo != null)) {
        setDraftFrom(iso);
        setDraftTo(null);
        return;
      }
      if (compareIso(iso, draftFrom) < 0) {
        setDraftTo(draftFrom);
        setDraftFrom(iso);
        return;
      }
      setDraftTo(iso);
    },
    [draftFrom, draftTo, effectiveMax, minDate],
  );

  const handleClear = useCallback(() => {
    setDraftFrom(null);
    setDraftTo(null);
    onClear?.();
  }, [onClear]);

  const handleConfirm = useCallback(() => {
    if (draftFrom == null || draftTo == null) {
      return;
    }
    onConfirm(draftFrom, draftTo);
  }, [draftFrom, draftTo, onConfirm]);

  const calendarTranslateX = useMemo(
    () => Animated.subtract(slideOffset, calendarWidthAnim),
    [calendarWidthAnim, slideOffset],
  );

  const handleCalendarLayout = useCallback(
    (width: number) => {
      setCalendarWidth(width);
      calendarWidthAnim.setValue(width);
    },
    [calendarWidthAnim],
  );

  const renderMonthGrid = useCallback(
    (gridCells: RangeCalendarCell[]) => (
      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(gridCells.length / 7) }, (_, ri) => (
          <View key={ri} style={styles.weekRow}>
            {gridCells.slice(ri * 7, ri * 7 + 7).map(cell => {
              const isEndpoint = cell.isRangeStart || cell.isRangeEnd;
              const isSingleDay =
                cell.isRangeStart &&
                cell.isRangeEnd &&
                draftFrom != null &&
                draftTo != null &&
                draftFrom === draftTo;
              const isPendingStart = cell.isRangeStart && draftTo == null;
              const showRangeTrack =
                cell.inRange &&
                !isSingleDay &&
                !isPendingStart &&
                draftTo != null;
              const rangeTrackStyle = cell.isRangeStart
                ? styles.rangeTrackStart
                : cell.isRangeEnd
                  ? styles.rangeTrackEnd
                  : styles.rangeTrackMiddle;
              const showInRangeText =
                cell.inRange && !isEndpoint && !isPendingStart;

              return (
                <Pressable
                  key={cell.iso}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: isEndpoint,
                    disabled: cell.disabled,
                  }}
                  disabled={cell.disabled}
                  onPress={() => handleDayPress(cell.iso)}
                  style={styles.dayCell}
                >
                  {showRangeTrack ? (
                    <View style={[styles.rangeTrack, rangeTrackStyle]} />
                  ) : null}
                  <View
                    style={[
                      styles.dayInner,
                      (isEndpoint || isPendingStart) && styles.dayInnerSelected,
                      cell.isToday &&
                        !isEndpoint &&
                        !isPendingStart &&
                        !cell.inRange &&
                        styles.dayInnerToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !cell.inMonth && styles.dayTextMuted,
                        (isEndpoint || isPendingStart) && styles.dayTextSelected,
                        showInRangeText && styles.dayTextInRange,
                        cell.disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    ),
    [draftFrom, draftTo, handleDayPress, styles],
  );

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  if (!renderModal) {
    return null;
  }

  return (
    <Modal
      visible={renderModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.safe, { opacity: fadeAnim }]}>
        <Pressable
          accessibilityRole="button"
          style={styles.backdrop}
          onPress={dismissOnBackdropPress ? onDismiss : undefined}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: sheetAnim,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <Text style={styles.title}>{resolvedTitle}</Text>
            <Text style={styles.hint}>{hintText}</Text>

            <View style={styles.previewRow}>
              <View style={styles.previewCol}>
                <Text style={styles.previewLabel}>
                  {t('modals.dateRangePicker.fromLabel')}
                </Text>
                <Text style={styles.previewValue} numberOfLines={1}>
                  {draftFrom != null ? formatLedgerShortDate(draftFrom) : '—'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={colors.textMuted}
                style={styles.previewArrow}
              />
              <View style={styles.previewCol}>
                <Text style={styles.previewLabel}>
                  {t('modals.dateRangePicker.toLabel')}
                </Text>
                <Text style={styles.previewValue} numberOfLines={1}>
                  {draftTo != null ? formatLedgerShortDate(draftTo) : '—'}
                </Text>
              </View>
            </View>

            {pickerMode === 'calendar' ? (
              <>
                <View style={styles.monthHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('modals.datePicker.prevMonth')}
                    disabled={!canPrevMonth}
                    onPress={goPrevMonth}
                    style={({ pressed }) => [
                      styles.monthNavBtn,
                      !canPrevMonth && styles.monthNavBtnDisabled,
                      pressed && canPrevMonth && styles.monthNavBtnPressed,
                    ]}
                  >
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
                      ]}
                    >
                      <Text style={styles.monthText}>
                        {new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(
                          locale,
                          { month: 'long' },
                        )}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={openYearPicker}
                      style={({ pressed }) => [
                        styles.monthTitleTouchable,
                        pressed && styles.monthTitleTouchablePressed,
                      ]}
                    >
                      <Text style={styles.yearText}>{viewYear}</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('modals.datePicker.nextMonth')}
                    disabled={!canNextMonth}
                    onPress={goNextMonth}
                    style={({ pressed }) => [
                      styles.monthNavBtn,
                      !canNextMonth && styles.monthNavBtnDisabled,
                      pressed && canNextMonth && styles.monthNavBtnPressed,
                    ]}
                  >
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

                <View
                  style={styles.calendarSwipeArea}
                  onLayout={event => handleCalendarLayout(event.nativeEvent.layout.width)}
                  {...panResponder.panHandlers}
                >
                  <Animated.View
                    style={[
                      styles.calendarStrip,
                      calendarWidth > 0 && { width: calendarWidth * 3 },
                      { transform: [{ translateX: calendarTranslateX }] },
                    ]}
                  >
                    <View style={[styles.calendarPage, calendarWidth > 0 && { width: calendarWidth }]}>
                      {renderMonthGrid(prevCells)}
                    </View>
                    <View style={[styles.calendarPage, calendarWidth > 0 && { width: calendarWidth }]}>
                      {renderMonthGrid(cells)}
                    </View>
                    <View style={[styles.calendarPage, calendarWidth > 0 && { width: calendarWidth }]}>
                      {renderMonthGrid(nextCells)}
                    </View>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {pickerMode === 'year' ? (
              <>
                <View style={styles.pickerModeHeader}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPickerMode('calendar')}
                    style={({ pressed }) => [
                      styles.pickerModeBackBtn,
                      pressed && styles.monthNavBtnPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>
                  <Text style={styles.pickerModeTitle}>
                    {t('modals.datePicker.selectYear', {
                      defaultValue: 'Select Year',
                    })}
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
                          disabled && styles.yearItemDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.yearItemText,
                            isActive && styles.yearItemTextActive,
                          ]}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            ) : null}

            {pickerMode === 'month' ? (
              <>
                <View style={styles.pickerModeHeader}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPickerMode('calendar')}
                    style={({ pressed }) => [
                      styles.pickerModeBackBtn,
                      pressed && styles.monthNavBtnPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openYearPicker}
                    style={({ pressed }) => [
                      styles.pickerModeTitlePressable,
                      pressed && styles.monthTitleTouchablePressed,
                    ]}
                  >
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
                              pressed &&
                                !isActive &&
                                styles.monthPickCellPressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.monthPickText,
                                isActive && styles.monthPickTextActive,
                                disabled && styles.monthPickTextDisabled,
                              ]}
                            >
                              {monthLabels[month - 1]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={handleClear}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.clearBtn,
                  pressed && styles.footerBtnPressed,
                ]}
              >
                <Text style={styles.clearLabel}>{resolvedClear}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.cancelBtn,
                  pressed && styles.footerBtnPressed,
                ]}
              >
                <Text style={styles.cancelLabel}>{resolvedCancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canConfirm}
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.confirmBtn,
                  !canConfirm && styles.confirmBtnDisabled,
                  pressed && canConfirm && styles.footerBtnPressed,
                ]}
              >
                <Text style={styles.confirmLabel}>{resolvedConfirm}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}
