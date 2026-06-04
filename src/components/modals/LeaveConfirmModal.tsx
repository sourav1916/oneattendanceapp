import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

export type LeaveConfirmModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onConfirmLeave: () => void;
  title: string;
  message: string;
  stayLabel: string;
  leaveLabel: string;
};

export type LeaveConfirmPresentConfig = {
  title: string;
  message: string;
  stayLabel: string;
  leaveLabel: string;
  onConfirmLeave: () => void;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 22,
      backgroundColor: colors.surface,
      paddingTop: 28,
      paddingHorizontal: 24,
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: dark ? 0.42 : 0.12,
          shadowRadius: 32,
        },
        android: { elevation: 18 },
      }),
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
      backgroundColor: dark ? 'rgba(251,191,36,0.14)' : '#fff7ed',
      borderWidth: 1,
      borderColor: dark ? 'rgba(251,191,36,0.28)' : '#ffedd5',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 22,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 10,
    },
    stayBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
      backgroundColor: colors.primary,
    },
    leaveBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
      backgroundColor: dark ? 'rgba(239,68,68,0.14)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(239,68,68,0.38)' : '#fecaca',
    },
    stayText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    leaveText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.danger,
    },
    btnPressed: {
      opacity: 0.88,
    },
  });
}

export function LeaveConfirmModal({
  visible,
  onDismiss,
  onConfirmLeave,
  title,
  message,
  stayLabel,
  leaveLabel,
}: LeaveConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const dark = resolvedScheme === 'dark';
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 80,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleLeave = useCallback(() => {
    onConfirmLeave();
    onDismiss();
  }, [onConfirmLeave, onDismiss]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconRing}>
            <MaterialCommunityIcons
              name="door-open"
              size={36}
              color={dark ? '#fbbf24' : '#ea580c'}
            />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.divider} />
          <View style={styles.btnRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.stayBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.stayText}>{stayLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleLeave}
              style={({ pressed }) => [
                styles.leaveBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.leaveText}>{leaveLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function useLeaveConfirmModal() {
  const [visible, setVisible] = useState(false);
  const onConfirmLeaveRef = useRef<() => void>(() => {});
  const [copy, setCopy] = useState({
    title: '',
    message: '',
    stayLabel: '',
    leaveLabel: '',
  });

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const present = useCallback((config: LeaveConfirmPresentConfig) => {
    onConfirmLeaveRef.current = config.onConfirmLeave;
    setCopy({
      title: config.title,
      message: config.message,
      stayLabel: config.stayLabel,
      leaveLabel: config.leaveLabel,
    });
    setVisible(true);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    onConfirmLeaveRef.current();
  }, []);

  const props = useMemo(
    (): LeaveConfirmModalProps => ({
      visible,
      onDismiss: dismiss,
      onConfirmLeave: handleConfirmLeave,
      title: copy.title,
      message: copy.message,
      stayLabel: copy.stayLabel,
      leaveLabel: copy.leaveLabel,
    }),
    [copy, dismiss, handleConfirmLeave, visible],
  );

  return { props, present, dismiss, visible };
}
