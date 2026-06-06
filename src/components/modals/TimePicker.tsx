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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useKeyboardCenteredSheet } from '@src/hooks/useKeyboardCenteredSheet';
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
  minTime?: string;
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
    sheetWrap: { flex: 1, paddingHorizontal: 20 },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
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
    sheetInner: {
      paddingTop: 20,
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 6,
    },
    inputBox: {
      width: 68,
      height: 60,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputBoxFocused: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff',
    },
    inputTextInput: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      width: '100%',
      height: '100%',
      padding: 0,
    },
    inputColon: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textMuted,
    },
    periodRow: {
      marginLeft: 10,
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
    inputLabels: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 14,
      gap: 6,
    },
    inputLabelBox: { width: 68, alignItems: 'center' },
    inputLabelText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    inputLabelSpacer: { width: 18 },

    wheelsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
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
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
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

  const selectedIdx = useMemo(() => {
    const idx = data.indexOf(selected);
    return idx >= 0 ? idx : 0;
  }, [data, selected]);

  useEffect(() => {
    if (!isUserScrolling.current) {
      ref.current?.scrollToOffset({
        offset: selectedIdx * ITEM_H,
        animated: true,
      });
    }
  }, [selectedIdx]);

  const scrollToSelected = useCallback(() => {
    ref.current?.scrollToOffset({
      offset: selectedIdx * ITEM_H,
      animated: false,
    });
  }, [selectedIdx]);

  const handleBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  const handleEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      isUserScrolling.current = false;
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(data.length - 1, idx));
      const val = data[clamped];
      if (val !== undefined && val !== selected) {
        onSelect(val);
      }
    },
    [data, onSelect, selected],
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
        decelerationRate="normal"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleBegin}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
        onLayout={scrollToSelected}
        contentContainerStyle={{ paddingVertical: CENTER_PAD }}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
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
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { layout, sheetSizeStyle } = useKeyboardCenteredSheet(visible, {
    minSheetHeight: 320,
    maxHeight: 480,
  });

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

  const [hourText, setHourText] = useState('09');
  const [minuteText, setMinuteText] = useState('00');
  const [hourFocused, setHourFocused] = useState(false);
  const [minuteFocused, setMinuteFocused] = useState(false);

  const minuteInputRef = useRef<TextInput>(null);

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
      setMinuteText(pad2(nearest));
      if (use24Hour) {
        setHour24Direct(parsed[0]);
        setHourText(pad2(parsed[0]));
      } else {
        const conv = from24(parsed[0]);
        setHour12(conv.h12);
        setPeriod(conv.period);
        setHourText(String(conv.h12));
      }
    } else {
      setMinute(0);
      setMinuteText('00');
      if (use24Hour) {
        setHour24Direct(9);
        setHourText('09');
      } else {
        setHour12(9);
        setPeriod('AM');
        setHourText('9');
      }
    }
  }, [visible, value, minutes, use24Hour]);

  useEffect(() => {
    if (!hourFocused) {
      setHourText(use24Hour ? pad2(hour24Direct) : String(hour12));
    }
  }, [hour12, hour24Direct, hourFocused, use24Hour]);

  useEffect(() => {
    if (!minuteFocused) {
      setMinuteText(pad2(minute));
    }
  }, [minute, minuteFocused]);

  const hour24 = useMemo(
    () => (use24Hour ? hour24Direct : to24(hour12, period)),
    [hour12, hour24Direct, period, use24Hour],
  );

  const totalMinutes = useMemo(
    () => hour24 * 60 + minute,
    [hour24, minute],
  );

  const minTotal = useMemo(
    () => (minParsed ? minParsed[0] * 60 + minParsed[1] : 0),
    [minParsed],
  );
  const maxTotal = useMemo(
    () => (maxParsed ? maxParsed[0] * 60 + maxParsed[1] : 23 * 60 + 59),
    [maxParsed],
  );

  const isInRange = totalMinutes >= minTotal && totalMinutes <= maxTotal;

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

  const handleHourTextChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, 2);
      setHourText(digits);
      const num = parseInt(digits, 10);
      if (use24Hour) {
        if (num >= 0 && num <= 23) {
          setHour24Direct(num);
        }
      } else if (num >= 1 && num <= 12) {
        setHour12(num);
      }
    },
    [use24Hour],
  );

  const handleMinuteTextChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, 2);
      setMinuteText(digits);
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num >= 0 && num <= 59) {
        const nearest = minutes.reduce((best, m) =>
          Math.abs(m - num) < Math.abs(best - num) ? m : best,
        );
        setMinute(nearest);
      }
    },
    [minutes],
  );

  const commitHourText = useCallback(() => {
    setHourFocused(false);
    const num = parseInt(hourText, 10);
    if (use24Hour) {
      if (isNaN(num) || num < 0 || num > 23) {
        setHourText(pad2(hour24Direct));
      } else {
        setHour24Direct(num);
        setHourText(pad2(num));
      }
    } else if (isNaN(num) || num < 1 || num > 12) {
      setHourText(String(hour12));
    } else {
      setHour12(num);
      setHourText(String(num));
    }
  }, [hour12, hour24Direct, hourText, use24Hour]);

  const commitMinuteText = useCallback(() => {
    setMinuteFocused(false);
    const num = parseInt(minuteText, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      setMinuteText(pad2(minute));
    } else {
      const nearest = minutes.reduce((best, m) =>
        Math.abs(m - num) < Math.abs(best - num) ? m : best,
      );
      setMinute(nearest);
      setMinuteText(pad2(nearest));
    }
  }, [minute, minuteText, minutes]);

  const handleHourSubmit = useCallback(() => {
    commitHourText();
    minuteInputRef.current?.focus();
  }, [commitHourText]);

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={resolvedCancel}
          onPress={dismissOnBackdropPress ? onDismiss : undefined}
        />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={[styles.sheet, sheetSizeStyle]}>
            <View style={styles.sheetInner}>
            <Text style={styles.title}>{resolvedTitle}</Text>

            <View style={styles.inputRow}>
              <View style={[styles.inputBox, hourFocused && styles.inputBoxFocused]}>
                <TextInput
                  value={hourText}
                  onChangeText={handleHourTextChange}
                  onFocus={() => setHourFocused(true)}
                  onBlur={commitHourText}
                  onSubmitEditing={handleHourSubmit}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  returnKeyType="next"
                  style={styles.inputTextInput}
                />
              </View>
              <Text style={styles.inputColon}>:</Text>
              <View style={[styles.inputBox, minuteFocused && styles.inputBoxFocused]}>
                <TextInput
                  ref={minuteInputRef}
                  value={minuteText}
                  onChangeText={handleMinuteTextChange}
                  onFocus={() => setMinuteFocused(true)}
                  onBlur={commitMinuteText}
                  onSubmitEditing={commitMinuteText}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  returnKeyType="done"
                  style={styles.inputTextInput}
                />
              </View>
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
                    <Text style={[
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
                    <Text style={[
                      styles.periodText,
                      period === 'PM' && styles.periodTextActive,
                    ]}>
                      {t('modals.timePicker.pm')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.inputLabels}>
              <View style={styles.inputLabelBox}>
                <Text style={styles.inputLabelText}>
                  {t('modals.timePicker.hour')}
                </Text>
              </View>
              <View style={styles.inputLabelSpacer} />
              <View style={styles.inputLabelBox}>
                <Text style={styles.inputLabelText}>
                  {t('modals.timePicker.minute')}
                </Text>
              </View>
            </View>

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
            </View>

            {rangeErrorText ? (
              <Text style={styles.rangeError}>{rangeErrorText}</Text>
            ) : null}

            <View style={styles.footer}>
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
  };

  return { value, setValue, visible, present, dismiss, pickerProps };
}
