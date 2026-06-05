/**
 * @format
 */
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
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
import { TAB_SCREEN_SCROLL_PADDING_BOTTOM } from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList, MainTabParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import {
  displayEmailFromSources,
  displayNameFromSources,
  initialsFromDisplayName,
  profilePictureFromSources,
} from '@src/utils/userDisplay';

const H_PAD = 20;
const GRID_GAP = 10;
const GRID_COLS = 3;

type HomeMainNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<MainTabParamList>
>;

type ActionCardIcon = {
  name: IconProps['name'];
  color: string;
  backgroundColor: string;
};

type ActionCard = {
  id: string;
  icon: ActionCardIcon;
  title: string;
  onPress: () => void;
};

const HOME_MENU_ICONS: Record<string, ActionCardIcon> = {
  attendance: { name: 'calendar-clock-outline', color: '#059669', backgroundColor: '#d1fae5' },
  attendanceMgmt: {
    name: 'clipboard-text-clock-outline',
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
  },
  calendar: { name: 'calendar-month-outline', color: '#ea580c', backgroundColor: '#ffedd5' },
  company: { name: 'office-building-outline', color: '#0d9488', backgroundColor: '#ccfbf1' },
  employee: { name: 'account-group-outline', color: '#2563eb', backgroundColor: '#dbeafe' },
  leaveReq: { name: 'file-document-edit-outline', color: '#7c3aed', backgroundColor: '#ede9fe' },
  leaveMgmt: { name: 'clipboard-list-outline', color: '#0891b2', backgroundColor: '#cffafe' },
  ledger: { name: 'book-account-outline', color: '#b45309', backgroundColor: '#fef3c7' },
  faceAttendance: { name: 'face-recognition', color: '#0d9488', backgroundColor: '#ccfbf1' },
  onboarding: { name: 'email-open-outline', color: '#d946ef', backgroundColor: '#fae8ff' },
};

function actionCardWithIcon(id: string, title: string, onPress: () => void): ActionCard {
  return {
    id,
    title,
    onPress,
    icon: HOME_MENU_ICONS[id] ?? {
      name: 'apps',
      color: '#64748b',
      backgroundColor: '#f1f5f9',
    },
  };
}

export function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeMainNavigation>();
  const { name, email, cachedUserProfile, profileRoleUser, refreshProfileRole, selectedCompany } =
    useAuth();
  const isOwnerCompany = selectedCompany?.relation === 'owned';
  const [refreshing, setRefreshing] = useState(false);
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildHomeStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = useMemo(() => {
    const inner = windowWidth - H_PAD * 2;
    const gaps = GRID_GAP * (GRID_COLS - 1);
    return (inner - gaps) / GRID_COLS;
  }, [windowWidth]);

  const displayName = useMemo(
    () => displayNameFromSources(name, email, cachedUserProfile, profileRoleUser),
    [name, email, cachedUserProfile, profileRoleUser],
  );
  const displayEmail = useMemo(
    () => displayEmailFromSources(email, cachedUserProfile, profileRoleUser),
    [email, cachedUserProfile, profileRoleUser],
  );
  const profilePhotoUrl = useMemo(
    () => profilePictureFromSources(cachedUserProfile, profileRoleUser),
    [cachedUserProfile, profileRoleUser],
  );
  const initials = useMemo(
    () => initialsFromDisplayName(displayName, displayEmail),
    [displayName, displayEmail],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfileRole({ silent: true });
    } catch {
      // Pull-to-refresh: keep existing profile data on failure.
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfileRole]);

  const actionCards = useMemo((): ActionCard[] => {
    return [
      actionCardWithIcon(
        isOwnerCompany ? 'attendanceMgmt' : 'attendance',
        isOwnerCompany
          ? t('home.menu.attendanceManagement')
          : t('home.menu.attendance'),
        () => {
          if (isOwnerCompany) {
            navigation.getParent()?.navigate('AttendanceManagement');
            return;
          }
          navigation.navigate('Attendance');
        },
      ),
      actionCardWithIcon(
        'calendar',
        t('home.menu.calendar'),
        () => navigation.navigate('MyCalendar'),
      ),
      actionCardWithIcon(
        'company',
        t('home.menu.company'),
        () => navigation.navigate('CompanyList'),
      ),
      actionCardWithIcon(
        'ledger',
        t('home.menu.ledger'),
        () => navigation.navigate('Ledger'),
      ),
      ...(isOwnerCompany
        ? []
        : [
            actionCardWithIcon(
              'attendanceMgmt',
              t('home.menu.attendanceManagement'),
              () => navigation.navigate('AttendanceManagement'),
            ),
          ]),
      actionCardWithIcon(
        'faceAttendance',
        t('home.menu.faceAttendance'),
        () => navigation.navigate('FaceAttendance'),
      ),
      actionCardWithIcon(
        'employee',
        t('home.menu.employeeManagement'),
        () => navigation.navigate('EmployeeManagement'),
      ),
      actionCardWithIcon(
        'leaveReq',
        t('home.menu.leaveRequest'),
        () => navigation.navigate('LeaveRequest'),
      ),
      actionCardWithIcon(
        'leaveMgmt',
        t('home.menu.leaveManagement'),
        () => navigation.navigate('LeaveManagement'),
      ),
      actionCardWithIcon(
        'onboarding',
        t('home.menu.onboarding'),
        () => navigation.navigate('OnboardingRequest'),
      ),
    ];
  }, [isOwnerCompany, navigation, t]);

  return (
    <View style={styles.root}>
      <MainTopBar />
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void onRefresh();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeAccent} />
            <View style={styles.welcomeAvatar}>
              {profilePhotoUrl ? (
                <Image
                  source={{ uri: profilePhotoUrl }}
                  style={styles.welcomeAvatarImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Text style={styles.welcomeAvatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.welcomeTextCol}>
              <Text style={styles.welcomeEyebrow}>{t('home.welcomeEyebrow')}</Text>
              <Text style={styles.welcomeGreeting} numberOfLines={2}>
                {t('home.greeting', { name: displayName || t('home.guest') })}
              </Text>
              {displayEmail ? (
                <Text style={styles.welcomeEmail} numberOfLines={2}>
                  {displayEmail}
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
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: item.icon.backgroundColor },
                  ]}>
                  <MaterialCommunityIcons
                    name={item.icon.name}
                    size={22}
                    color={item.icon.color}
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
      </SafeAreaView>
    </View>
  );
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
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
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
      overflow: 'hidden',
      ...Platform.select({
        android: { elevation: 1 },
        ios: {},
      }),
    },
    welcomeAvatarImage: {
      width: '100%',
      height: '100%',
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
