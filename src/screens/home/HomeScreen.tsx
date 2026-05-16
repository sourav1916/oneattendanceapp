/**
 * @format
 */
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { MainTopBar } from '@src/components/MainTopBar';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList, MainTabParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

const H_PAD = 20;
const GRID_GAP = 10;
const GRID_COLS = 3;

type HomeMainNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<MainTabParamList>
>;

type ActionCard = {
  id: string;
  iconName: IconProps['name'];
  title: string;
  onPress: () => void;
};

export function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeMainNavigation>();
  const { name, email } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildHomeStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { props: confirmProps, present } = useConfirmAlert();

  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = useMemo(() => {
    const inner = windowWidth - H_PAD * 2;
    const gaps = GRID_GAP * (GRID_COLS - 1);
    return (inner - gaps) / GRID_COLS;
  }, [windowWidth]);

  const initials = useMemo(() => getInitials(name, email), [name, email]);

  const openComingSoon = useCallback(() => {
    present({
      title: t('settings.alerts.comingSoonTitle'),
      message: t('settings.alerts.comingSoonMessage'),
      buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
    });
  }, [present, t]);

  const actionCards = useMemo<ActionCard[]>(
    () => [
      {
        id: 'attendance',
        iconName: 'calendar-clock-outline',
        title: t('home.menu.attendance'),
        onPress: () => navigation.navigate('Attendance'),
      },
      {
        id: 'calendar',
        iconName: 'calendar-month-outline',
        title: t('home.menu.calendar'),
        onPress: openComingSoon,
      },
      {
        id: 'staff',
        iconName: 'account-group-outline',
        title: t('home.menu.staffManagement'),
        onPress: () => navigation.navigate('StaffManagement'),
      },
      {
        id: 'leaveReq',
        iconName: 'file-document-edit-outline',
        title: t('home.menu.leaveRequest'),
        onPress: () => navigation.navigate('LeaveRequest'),
      },
      {
        id: 'leaveMgmt',
        iconName: 'clipboard-list-outline',
        title: t('home.menu.leaveManagement'),
        onPress: openComingSoon,
      },
    ],
    [navigation, openComingSoon, t],
  );

  return (
    <View style={styles.root}>
      <MainTopBar />
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            {t('home.title')}
          </Text>

          <View style={styles.welcomeCard}>
            <View style={styles.welcomeAccent} />
            <View style={styles.welcomeAvatar}>
              <Text style={styles.welcomeAvatarText}>{initials}</Text>
            </View>
            <View style={styles.welcomeTextCol}>
              <Text style={styles.welcomeEyebrow}>{t('home.welcomeEyebrow')}</Text>
              <Text style={styles.welcomeGreeting} numberOfLines={2}>
                {t('home.greeting', { name: name || t('home.guest') })}
              </Text>
              {email ? (
                <Text style={styles.welcomeEmail} numberOfLines={2}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.grid}>
            {actionCards.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.optionCard,
                  { width: cardWidth },
                  pressed && styles.optionCardPressed,
                ]}>
                <View style={styles.iconBubble}>
                  <MaterialCommunityIcons
                    name={item.iconName}
                    size={22}
                    color={colors.primary}
                    accessibilityElementsHidden
                  />
                </View>
                <Text style={styles.optionTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <ConfirmAlert {...confirmProps} />
      </SafeAreaView>
    </View>
  );
}

function getInitials(displayName: string | null, emailFallback: string | null): string {
  const fromName = displayName?.trim();
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) {
        return `${a}${b}`.toUpperCase();
      }
    }
    const ch = fromName[0];
    return ch ? ch.toUpperCase() : '?';
  }
  const e = emailFallback?.trim();
  if (e && e.length > 0) {
    return e[0]!.toUpperCase();
  }
  return '?';
}

function buildHomeStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingHorizontal: H_PAD,
      paddingTop: 12,
      paddingBottom: 32,
    },
    pageTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 12,
      marginLeft: 2,
    },
    welcomeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 18,
      paddingHorizontal: 16,
      marginBottom: 22,
      overflow: 'hidden',
      gap: 14,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: scheme === 'dark' ? 0.35 : 0.08,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
      }),
    },
    welcomeAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.primary,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    welcomeAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
      borderWidth: 2,
      borderColor: colors.surface,
      ...Platform.select({
        android: { elevation: 1 },
        ios: {},
      }),
    },
    welcomeAvatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#fff',
    },
    welcomeTextCol: {
      flex: 1,
      minWidth: 0,
    },
    welcomeEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    welcomeGreeting: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 26,
      marginBottom: 4,
    },
    welcomeEmail: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    optionCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 102,
    },
    optionCardPressed: {
      backgroundColor: colors.secondaryButton,
      opacity: 0.96,
    },
    iconBubble: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    optionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 15,
    },
  });
}
