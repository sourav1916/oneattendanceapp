import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

const ITEM_H = 52;
const VISIBLE = 5;
const LIST_H = ITEM_H * VISIBLE;
const CENTER_PAD = ITEM_H * Math.floor(VISIBLE / 2);

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);

function minuteData(step: number): number[] {
  const r: number[] = [];
  for (let i = 0; i < 60; i += step) {
    r.push(i);
  }
  return r;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

type Period = 'AM' | 'PM';

function to24(h12: number, period: Period): number {
  if (period === 'AM') {
    return h12 === 12 ? 0 : h12;
  }
  return h12 === 12 ? 12 : h12 + 12;
}

function from24(h24: number): { h12: number; period: Period } {
  if (h24 === 0) {
    return { h12: 12, period: 'AM' };
  }
  if (h24 < 12) {
    return { h12: h24, period: 'AM' };
  }
  if (h24 === 12) {
    return { h12: 12, period: 'PM' };
  }
  return { h12: h24 - 12, period: 'PM' };
}

function parseHHmm(s: string | undefined): [number, number] | null {
  if (!s) {
    return null;
  }
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return [h, m];
}

function toTotalMinutes(h24: number, minute: number): number {
  return h24 * 60 + minute;
}

export function formatTime12h(hhmm: string): string {
  const parsed = parseHHmm(hhmm);
  if (!parsed) {
    return hhmm;
  }
  const { h12, period } = from24(parsed[0]);
  return `${h12}:${pad2(parsed[1])} ${period}`;
}

export function formatTime24h(hhmm: string): string {
  const parsed = parseHHmm(hhmm);
  if (!parsed) {
    return hhmm;
  }
  return `${pad2(parsed[0])}:${pad2(parsed[1])}`;
}

export type TimePickerProps = {
  visible: boolean;
  value: string;
  onDismiss: () => void;
  onConfirm: (hhmm: string) => void;
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Inclusive lower bound (`HH:mm`). */
  minTime?: string;
  /** Inclusive upper bound (`HH:mm`). */
  maxTime?: string;
  minuteStep?: number;
  dismissOnBackdropPress?: boolean;
  /** 24-hour wheels without AM/PM (HH:mm). */
  use24Hour?: boolean;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      flexDirection: 'column',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
          shadowRadius: 16,
        },
        android: { elevation: 10 },
      }),
    },
    sheetBody: {
      flexShrink: 1,
      paddingTop: 20,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    selectedTime: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    selectedTimeInvalid: {
      color: colors.danger,
    },
    periodRow: {
      marginLeft: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    periodBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    periodBtnActive: {
      backgroundColor: colors.primary,
    },
    periodBtnTop: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    periodText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    periodTextActive: {
      color: '#fff',
    },
    wheelsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    wheelOuter: {
      width: 76,
      height: LIST_H,
      overflow: 'hidden',
      borderRadius: 14,
    },
    highlightBand: {
      position: 'absolute',
      top: CENTER_PAD,
      left: 0,
      right: 0,
      height: ITEM_H,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)',
      zIndex: 1,
    },
    fadeTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: CENTER_PAD,
      backgroundColor: colors.surface,
      opacity: 0.6,
      zIndex: 2,
    },
    fadeBottom: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: CENTER_PAD,
      backgroundColor: colors.surface,
      opacity: 0.6,
      zIndex: 2,
    },
    wheelItem: {
      height: ITEM_H,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
    },
    wheelTextDisabled: {
      color: colors.textMuted,
      opacity: 0.3,
    },
    colonSpacer: {
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colonText: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textMuted,
    },
    rangeError: {
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
      marginTop: 4,
      marginBottom: 4,
      paddingHorizontal: 8,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
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
    confirmBtnDisabled: {
      opacity: 0.4,
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

type WheelProps = {
  data: number[];
  selected: number;
  onSelect: (val: number) => void;
  formatItem?: (val: number) => string;
  isDisabled?: (val: number) => boolean;
  styles: ReturnType<typeof buildStyles>;
};

function Wheel({
  data,
  selected,
  onSelect,
  formatItem,
  isDisabled,
  styles,
}: WheelProps) {
  const ref = useRef<FlatList<number>>(null);
  const isUserScrolling = useRef(false);
  const lastScrollValue = useRef<number | null>(null);

  const selectedIdx = useMemo(() => {
    const idx = data.indexOf(selected);
    return idx >= 0 ? idx : 0;
  }, [data, selected]);

  const indexFromOffset = useCallback(
    (y: number) => {
      const idx = Math.round(y / ITEM_H);
      return Math.max(0, Math.min(data.length - 1, idx));
    },
    [data.length],
  );

  const valueAtOffset = useCallback(
    (y: number) => {
      const idx = indexFromOffset(y);
      return data[idx];
    },
    [data, indexFromOffset],
  );

  const snapToOffset = useCallback(
    (y: number, animated: boolean) => {
      const idx = indexFromOffset(y);
      ref.current?.scrollToOffset({
        offset: idx * ITEM_H,
        animated,
      });
      return data[idx];
    },
    [data, indexFromOffset],
  );

  const reportSelection = useCallback(
    (val: number | undefined) => {
      if (val !== undefined && val !== lastScrollValue.current) {
        lastScrollValue.current = val;
        onSelect(val);
      }
    },
    [onSelect],
  );

  useEffect(() => {
    if (!isUserScrolling.current) {
      lastScrollValue.current = selected;
      ref.current?.scrollToOffset({
        offset: selectedIdx * ITEM_H,
        animated: false,
      });
    }
  }, [selected, selectedIdx]);

  const scrollToSelected = useCallback(() => {
    lastScrollValue.current = selected;
    ref.current?.scrollToOffset({
      offset: selectedIdx * ITEM_H,
      animated: false,
    });
  }, [selected, selectedIdx]);

  const handleBegin = useCallback(() => {
    isUserScrolling.current = true;
    lastScrollValue.current = selected;
  }, [selected]);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (!isUserScrolling.current) {
        return;
      }
      const val = valueAtOffset(e.nativeEvent.contentOffset.y);
      reportSelection(val);
    },
    [reportSelection, valueAtOffset],
  );

  const finalizeScroll = useCallback(
    (y: number) => {
      isUserScrolling.current = false;
      const val = snapToOffset(y, true);
      reportSelection(val);
    },
    [reportSelection, snapToOffset],
  );

  const handleScrollEndDrag = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; velocity?: { y?: number } } }) => {
      const velocityY = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(velocityY) > 0.25) {
        return;
      }
      finalizeScroll(e.nativeEvent.contentOffset.y);
    },
    [finalizeScroll],
  );

  const handleMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      finalizeScroll(e.nativeEvent.contentOffset.y);
    },
    [finalizeScroll],
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const disabled = isDisabled?.(item) ?? false;
      return (
        <View style={styles.wheelItem}>
          <Text
            style={[
              styles.wheelText,
              disabled && styles.wheelTextDisabled,
            ]}>
            {formatItem ? formatItem(item) : pad2(item)}
          </Text>
        </View>
      );
    },
    [formatItem, isDisabled, styles],
  );

  const getLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_H,
      offset: ITEM_H * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.wheelOuter}>
      <View style={styles.highlightBand} pointerEvents="none" />
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={String}
        renderItem={renderItem}
        getItemLayout={getLayout}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleBegin}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onLayout={scrollToSelected}
        contentContainerStyle={{ paddingVertical: CENTER_PAD }}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

export function TimePicker({
  visible,
  value,
  onDismiss,
  onConfirm,
  title: titleProp,
  cancelLabel: cancelProp,
  confirmLabel: confirmProp,
  minTime,
  maxTime,
  minuteStep = 1,
  dismissOnBackdropPress = true,
  use24Hour = false,
}: TimePickerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const sheetMaxHeight = Math.min(520, windowHeight * 0.85 - insets.top - 16);

  const resolvedTitle = titleProp ?? t('modals.timePicker.title');
  const resolvedCancel = cancelProp ?? t('modals.timePicker.cancel');
  const resolvedConfirm = confirmProp ?? t('modals.timePicker.confirm');

  const minutes = useMemo(() => minuteData(minuteStep), [minuteStep]);
  const minParsed = useMemo(() => parseHHmm(minTime), [minTime]);
  const maxParsed = useMemo(() => parseHHmm(maxTime), [maxTime]);

  const [hour12, setHour12] = useState(9);
  const [hour24Direct, setHour24Direct] = useState(9);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<Period>('AM');

  useEffect(() => {
    if (!visible) {
      return;
    }
    const parsed = parseHHmm(value);
    if (parsed) {
      const nearest = minutes.reduce((best, m) =>
        Math.abs(m - parsed[1]) < Math.abs(best - parsed[1]) ? m : best,
      );
      setMinute(nearest);
      if (use24Hour) {
        setHour24Direct(parsed[0]);
      } else {
        const conv = from24(parsed[0]);
        setHour12(conv.h12);
        setPeriod(conv.period);
      }
    } else {
      setMinute(0);
      if (use24Hour) {
        setHour24Direct(9);
      } else {
        setHour12(9);
        setPeriod('AM');
      }
    }
  }, [visible, value, minutes, use24Hour]);

  const hour24 = useMemo(
    () => (use24Hour ? hour24Direct : to24(hour12, period)),
    [hour12, hour24Direct, period, use24Hour],
  );

  const totalMinutes = useMemo(
    () => toTotalMinutes(hour24, minute),
    [hour24, minute],
  );

  const isInRange = useMemo(() => {
    if (minParsed) {
      const minTotal = toTotalMinutes(minParsed[0], minParsed[1]);
      if (totalMinutes < minTotal) {
        return false;
      }
    }
    if (maxParsed) {
      const maxTotal = toTotalMinutes(maxParsed[0], maxParsed[1]);
      if (totalMinutes > maxTotal) {
        return false;
      }
    }
    return true;
  }, [maxParsed, minParsed, totalMinutes]);

  const rangeErrorText = useMemo(() => {
    if (isInRange) {
      return null;
    }
    const minDisplay = minParsed
      ? use24Hour
        ? formatTime24h(`${pad2(minParsed[0])}:${pad2(minParsed[1])}`)
        : formatTime12h(`${pad2(minParsed[0])}:${pad2(minParsed[1])}`)
      : '';
    const maxDisplay = maxParsed
      ? use24Hour
        ? formatTime24h(`${pad2(maxParsed[0])}:${pad2(maxParsed[1])}`)
        : formatTime12h(`${pad2(maxParsed[0])}:${pad2(maxParsed[1])}`)
      : '';
    if (minParsed && maxParsed) {
      return t('modals.timePicker.rangeError', { min: minDisplay, max: maxDisplay });
    }
    if (minParsed) {
      return t('modals.timePicker.rangeErrorMin', { min: minDisplay });
    }
    if (maxParsed) {
      return t('modals.timePicker.rangeErrorMax', { max: maxDisplay });
    }
    return null;
  }, [isInRange, maxParsed, minParsed, t, use24Hour]);

  const isHourDisabled = useCallback(
    (hourVal: number) => {
      const h24 = use24Hour ? hourVal : to24(hourVal, period);
      if (minParsed && h24 < minParsed[0]) {
        return true;
      }
      if (maxParsed && h24 > maxParsed[0]) {
        return true;
      }
      return false;
    },
    [maxParsed, minParsed, period, use24Hour],
  );

  const isMinuteDisabled = useCallback(
    (m: number) => {
      if (minParsed && hour24 === minParsed[0] && m < minParsed[1]) {
        return true;
      }
      if (maxParsed && hour24 === maxParsed[0] && m > maxParsed[1]) {
        return true;
      }
      return false;
    },
    [hour24, maxParsed, minParsed],
  );

  const formatHourItem = useCallback(
    (val: number) => (use24Hour ? pad2(val) : String(val)),
    [use24Hour],
  );

  const handleConfirm = useCallback(() => {
    if (!isInRange) {
      return;
    }
    onConfirm(`${pad2(hour24)}:${pad2(minute)}`);
    onDismiss();
  }, [hour24, isInRange, minute, onConfirm, onDismiss]);

  const selectedTimeLabel = useMemo(() => {
    const hhmm = `${pad2(hour24)}:${pad2(minute)}`;
    return use24Hour ? formatTime24h(hhmm) : formatTime12h(hhmm);
  }, [hour24, minute, use24Hour]);

  const footerBottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={resolvedCancel}
          onPress={dismissOnBackdropPress ? onDismiss : undefined}
        />
        <View
          style={[
            styles.sheetWrap,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
          pointerEvents="box-none">
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
            <View style={styles.sheetBody}>
              <Text style={styles.title}>{resolvedTitle}</Text>
              <Text
                style={[
                  styles.selectedTime,
                  !isInRange && styles.selectedTimeInvalid,
                ]}
                accessibilityRole="text"
                accessibilityLabel={selectedTimeLabel}>
                {selectedTimeLabel}
              </Text>

              <View style={styles.wheelsRow}>
                <Wheel
                  data={use24Hour ? HOURS_24 : HOURS_12}
                  selected={use24Hour ? hour24Direct : hour12}
                  onSelect={use24Hour ? setHour24Direct : setHour12}
                  formatItem={formatHourItem}
                  isDisabled={isHourDisabled}
                  styles={styles}
                />
                <View style={styles.colonSpacer}>
                  <Text style={styles.colonText}>:</Text>
                </View>
                <Wheel
                  data={minutes}
                  selected={minute}
                  onSelect={setMinute}
                  isDisabled={isMinuteDisabled}
                  styles={styles}
                />
                {!use24Hour ? (
                  <View style={styles.periodRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: period === 'AM' }}
                      onPress={() => setPeriod('AM')}
                      style={[
                        styles.periodBtn,
                        styles.periodBtnTop,
                        period === 'AM' && styles.periodBtnActive,
                      ]}>
                      <Text
                        style={[
                          styles.periodText,
                          period === 'AM' && styles.periodTextActive,
                        ]}>
                        {t('modals.timePicker.am')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: period === 'PM' }}
                      onPress={() => setPeriod('PM')}
                      style={[
                        styles.periodBtn,
                        period === 'PM' && styles.periodBtnActive,
                      ]}>
                      <Text
                        style={[
                          styles.periodText,
                          period === 'PM' && styles.periodTextActive,
                        ]}>
                        {t('modals.timePicker.pm')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {rangeErrorText ? (
                <Text style={styles.rangeError}>{rangeErrorText}</Text>
              ) : null}
            </View>

            <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.cancelBtn,
                  pressed && { opacity: 0.88 },
                ]}>
                <Text style={styles.cancelLabel}>{resolvedCancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !isInRange }}
                onPress={handleConfirm}
                disabled={!isInRange}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.confirmBtn,
                  !isInRange && styles.confirmBtnDisabled,
                  pressed && isInRange && { opacity: 0.88 },
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

export type UseTimePickerOptions = {
  initialValue?: string;
  onConfirm?: (time: string) => void;
  use24Hour?: boolean;
  title?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  minuteStep?: number;
  minTime?: string;
  maxTime?: string;
};

export function useTimePicker(opts: UseTimePickerOptions = {}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(opts.initialValue ?? '09:00');

  const onConfirmRef = useRef(opts.onConfirm);
  onConfirmRef.current = opts.onConfirm;

  const present = useCallback(() => setVisible(true), []);
  const dismiss = useCallback(() => setVisible(false), []);

  const handleConfirm = useCallback((time: string) => {
    setValue(time);
    onConfirmRef.current?.(time);
    setVisible(false);
  }, []);

  const pickerProps: TimePickerProps = {
    visible,
    value,
    onDismiss: dismiss,
    onConfirm: handleConfirm,
    use24Hour: opts.use24Hour,
    title: opts.title,
    cancelLabel: opts.cancelLabel,
    confirmLabel: opts.confirmLabel,
    minuteStep: opts.minuteStep,
    minTime: opts.minTime,
    maxTime: opts.maxTime,
  };

  return { value, setValue, visible, present, dismiss, pickerProps };
}
