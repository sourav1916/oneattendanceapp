import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

export type AttendanceMutationEndpoint = 'in' | 'out' | 'break-in' | 'break-out';

const THUMB_SIZE = 52;
const TRACK_HEIGHT = 56;
const TRACK_PAD = 4;
const SWIPE_CONFIRM_THRESHOLD = 0.88;
const TRACK_RADIUS = TRACK_HEIGHT / 2;

function springThumbToStart(translateX: Animated.Value): void {
  Animated.spring(translateX, {
    toValue: 0,
    useNativeDriver: true,
    friction: 7,
    tension: 72,
    velocity: 0,
  }).start();
}

type Props = {
  visible: boolean;
  endpoint: AttendanceMutationEndpoint | null;
  onDismiss: () => void;
  /** Runs after a full swipe; return `{ ok: true }` only when the action succeeded. */
  onConfirmSwipe: () => Promise<{ ok: boolean }>;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
      paddingHorizontal: 20,
    },
    sheet: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: 20,
    },
    trackWrap: {
      marginBottom: 16,
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_RADIUS,
      backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    trackHint: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: THUMB_SIZE + 8,
      paddingRight: 12,
      zIndex: 1,
    },
    trackHintText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    thumb: {
      position: 'absolute',
      left: TRACK_PAD,
      /** Percent + half-size offset = exact vertical center inside track (incl. borders). */
      top: '50%',
      marginTop: -THUMB_SIZE / 2,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: { elevation: 4 },
      }),
    },
    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 12,
    },
    cancelBtnPressed: {
      backgroundColor: colors.secondaryButton,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    loadingRow: {
      alignItems: 'center',
      paddingVertical: 12,
      gap: 10,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}

function endpointTitleKey(endpoint: AttendanceMutationEndpoint): string {
  switch (endpoint) {
    case 'in':
      return 'attendance.swipeConfirm.titlePunchIn';
    case 'out':
      return 'attendance.swipeConfirm.titlePunchOut';
    case 'break-in':
      return 'attendance.swipeConfirm.titleBreakStart';
    case 'break-out':
      return 'attendance.swipeConfirm.titleBreakEnd';
  }
}

function endpointMessageKey(endpoint: AttendanceMutationEndpoint): string {
  switch (endpoint) {
    case 'in':
      return 'attendance.swipeConfirm.messagePunchIn';
    case 'out':
      return 'attendance.swipeConfirm.messagePunchOut';
    case 'break-in':
      return 'attendance.swipeConfirm.messageBreakStart';
    case 'break-out':
      return 'attendance.swipeConfirm.messageBreakEnd';
  }
}

export function AttendanceSwipeConfirmModal({
  visible,
  endpoint,
  onDismiss,
  onConfirmSwipe,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [trackWidth, setTrackWidth] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const thumbX = useRef(new Animated.Value(0)).current;
  const slideStartRef = useRef(0);
  const maxSlideRef = useRef(0);

  useEffect(() => {
    const inner = Math.max(0, trackWidth - TRACK_PAD * 2 - THUMB_SIZE);
    maxSlideRef.current = inner;
    thumbX.stopAnimation(x => {
      if (x > inner) {
        thumbX.setValue(inner);
      }
    });
  }, [trackWidth, thumbX]);

  useEffect(() => {
    if (!visible) {
      thumbX.stopAnimation();
      thumbX.setValue(0);
      setSubmitting(false);
    }
  }, [visible, thumbX]);

  const clamp = useCallback((x: number) => {
    const max = maxSlideRef.current;
    return Math.max(0, Math.min(max, x));
  }, []);

  const runConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      const { ok } = await onConfirmSwipe();
      if (ok) {
        onDismiss();
      } else {
        springThumbToStart(thumbX);
      }
    } finally {
      setSubmitting(false);
    }
  }, [onConfirmSwipe, onDismiss]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !submitting,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          thumbX.stopAnimation(v => {
            slideStartRef.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          thumbX.setValue(clamp(slideStartRef.current + g.dx));
        },
        onPanResponderRelease: () => {
          thumbX.stopAnimation(x => {
            const max = maxSlideRef.current;
            if (max > 0 && x >= max * SWIPE_CONFIRM_THRESHOLD) {
              thumbX.setValue(max);
              void runConfirm();
            } else {
              springThumbToStart(thumbX);
            }
          });
        },
      }),
    [clamp, runConfirm, submitting, thumbX],
  );

  const title = endpoint ? t(endpointTitleKey(endpoint)) : '';
  const message = endpoint ? t(endpointMessageKey(endpoint)) : '';

  const maxSlide = useMemo(
    () => Math.max(0, trackWidth - TRACK_PAD * 2 - THUMB_SIZE),
    [trackWidth],
  );

  const hintOpacity = useMemo(
    () =>
      thumbX.interpolate({
        inputRange: [0, Math.max(1, maxSlide)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [thumbX, maxSlide],
  );

  return (
    <Modal
      transparent
      visible={visible && endpoint != null}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={submitting ? undefined : onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('attendance.swipeConfirm.cancel')}
          style={styles.backdrop}
          disabled={submitting}
          onPress={onDismiss}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {submitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{t('attendance.swipeConfirm.submitting')}</Text>
              </View>
            ) : (
              <View style={styles.trackWrap}>
                <View
                  style={styles.track}
                  onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
                  <View style={styles.trackHint} pointerEvents="none">
                    <Animated.Text style={[styles.trackHintText, { opacity: hintOpacity }]}>
                      {t('attendance.swipeConfirm.hint')}
                    </Animated.Text>
                  </View>
                  <Animated.View
                    style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}
                    {...panResponder.panHandlers}>
                    <MaterialCommunityIcons name="chevron-double-right" size={26} color="#fff" />
                  </Animated.View>
                </View>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              disabled={submitting}
              style={({ pressed }) => [styles.cancelBtn, pressed && !submitting && styles.cancelBtnPressed]}>
              <Text style={styles.cancelText}>{t('attendance.swipeConfirm.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
