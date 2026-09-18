/**
 * @format
 */
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { createCompany } from '@src/api/createCompany';
import { MainTopBar } from '@src/components/MainTopBar';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { CreateCompany, type CreateCompanyFormPayload } from '@src/components/modals/CreateCompany';
import { TAB_SCREEN_SCROLL_PADDING_BOTTOM } from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList, MainTabParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { companiesFromProfileRole } from '@src/utils/companiesFromProfileRole';
import { checkModuleAccess, type ModuleKey } from '@src/utils/moduleAccess';
import { readApiError } from '@src/utils/readApiError';
import {
  displayEmailFromSources,
  displayNameFromSources,
  initialsFromDisplayName,
  profilePictureFromSources,
} from '@src/utils/userDisplay';

const H_PAD = 20;
const GRID_GAP = 10;
const GRID_COLS = 3;

type HomeGridMetrics = {
  hPad: number;
  gridGap: number;
  cardWidth: number;
  iconSize: number;
  iconBubbleSize: number;
  titleSize: number;
  titleLineHeight: number;
  cardPadV: number;
  cardPadH: number;
  cardMinH: number;
};

function getHomeGridMetrics(windowWidth: number): HomeGridMetrics {
  const compact = windowWidth < 392;
  const hPad = compact ? 14 : H_PAD;
  const gridGap = compact ? 8 : GRID_GAP;
  const inner = windowWidth - hPad * 2;
  const gaps = gridGap * (GRID_COLS - 1);
  // Floor so three cards + gaps never exceed the row width on any device.
  const cardWidth = Math.floor((inner - gaps) / GRID_COLS);

  return {
    hPad,
    gridGap,
    cardWidth,
    iconSize: compact ? 20 : 22,
    iconBubbleSize: compact ? 38 : 44,
    titleSize: compact ? 10 : 12,
    titleLineHeight: compact ? 13 : 15,
    cardPadV: compact ? 8 : 12,
    cardPadH: compact ? 2 : 6,
    cardMinH: compact ? 84 : 102,
  };
}

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
  id: ModuleKey;
  icon: ActionCardIcon;
  title: string;
  onPress: () => void;
  allowed: boolean;
  lockReason?: 'no_company' | 'no_permission' | 'allowed';
};

const HOME_MENU_ICONS: Record<ModuleKey, ActionCardIcon> = {
  createCompany: {
    name: 'office-building-plus',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  attendance: {
    name: 'calendar-clock-outline',
    color: '#059669',
    backgroundColor: '#d1fae5',
  },
  attendanceMgmt: {
    name: 'clipboard-text-clock-outline',
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
  },
  company: {
    name: 'office-building-outline',
    color: '#0d9488',
    backgroundColor: '#ccfbf1',
  },
  employee: {
    name: 'account-group-outline',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  leaveReq: {
    name: 'file-document-edit-outline',
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
  },
  leaveMgmt: {
    name: 'clipboard-list-outline',
    color: '#0891b2',
    backgroundColor: '#cffafe',
  },
  report: {
    name: 'chart-box-outline',
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  faceAttendance: {
    name: 'face-recognition',
    color: '#0d9488',
    backgroundColor: '#ccfbf1',
  },
  onboarding: {
    name: 'email-open-outline',
    color: '#d946ef',
    backgroundColor: '#fae8ff',
  },
};

export function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeMainNavigation>();
  const {
    name,
    email,
    cachedUserProfile,
    profileRoleUser,
    profileRole,
    refreshProfileRole,
    selectedCompany,
    selectCompany,
  } = useAuth();

  const isOwnerCompany = selectedCompany?.relation === 'owned';
  const hasCompany = selectedCompany != null;
  const [refreshing, setRefreshing] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const { props: alertProps, present } = useConfirmAlert();

  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildHomeStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { width: windowWidth } = useWindowDimensions();
  const gridMetrics = useMemo(
    () => getHomeGridMetrics(windowWidth),
    [windowWidth],
  );

  const eligibleCompanies = useMemo(
    () => companiesFromProfileRole(profileRole?.data?.companies ?? {}),
    [profileRole],
  );

  // Auto-select company if user has joined/owned companies but none is currently active
  useEffect(() => {
    if (!selectedCompany && eligibleCompanies.length > 0) {
      void selectCompany(eligibleCompanies[0]);
    }
  }, [selectedCompany, eligibleCompanies, selectCompany]);

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

  const handleLockedCardPress = useCallback(
    (lockReason?: 'no_company' | 'no_permission' | 'allowed') => {
      if (lockReason === 'no_company') {
        present({
          title: t('home.lockedModal.noCompanyTitle'),
          message: t('home.lockedModal.noCompanyMessage'),
          showMessage: true,
          buttons: [
            {
              text: t('home.noCompanyBanner.button'),
              variant: 'primary',
              onPress: () => setCreateCompanyOpen(true),
            },
            {
              text: t('settings.alerts.cancel', 'Cancel'),
              variant: 'secondary',
            },
          ],
        });
        return;
      }
      if (lockReason === 'no_permission') {
        present({
          title: t('home.lockedModal.noPermissionTitle'),
          message: t('home.lockedModal.noPermissionMessage'),
          showMessage: true,
          buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
        });
      }
    },
    [present, t],
  );

  const handleCreateSubmit = useCallback(
    async (payload: CreateCompanyFormPayload) => {
      const res = await createCompany(payload);
      if (!res.success) {
        throw new Error(
          res.message?.trim() || t('home.companyList.createModal.errors.createFailed'),
        );
      }

      const role = await refreshProfileRole({ silent: true });
      const next = companiesFromProfileRole(role?.data?.companies ?? {});
      const nameKey = payload.name.trim().toLowerCase();
      const match =
        next.find(c => c.name.trim().toLowerCase() === nameKey) ??
        next.find(c => c.relation === 'owned') ??
        next[0];

      if (match) {
        await selectCompany(match);
      }

      setCreateCompanyOpen(false);
      present({
        title: t('home.companyList.createModal.successTitle'),
        message: res.message?.trim() || t('home.companyList.createModal.successTitle'),
        showMessage: true,
        buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
      });
    },
    [present, refreshProfileRole, selectCompany, t],
  );

  const onCreateSubmit = useCallback(
    (payload: CreateCompanyFormPayload) => {
      return handleCreateSubmit(payload).catch((e: unknown) => {
        present({
          title: t('home.companyList.createModal.title'),
          message:
            e instanceof Error && e.message
              ? e.message
              : readApiError(e) || t('home.companyList.createModal.errors.createFailed'),
          buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
        });
        throw e;
      });
    },
    [handleCreateSubmit, present, t],
  );

  const actionCards = useMemo((): ActionCard[] => {
    const rawItems: Array<{
      id: ModuleKey;
      title: string;
      onPress: () => void;
    }> = [
      // Create Company is always shown as a primary shortcut
      {
        id: 'createCompany',
        title: t('home.menu.createCompany'),
        onPress: () => setCreateCompanyOpen(true),
      },
      {
        id: isOwnerCompany ? 'attendanceMgmt' : 'attendance',
        title: isOwnerCompany
          ? t('home.menu.attendanceManagement')
          : t('home.menu.attendance'),
        onPress: () => {
          if (isOwnerCompany) {
            navigation.getParent()?.navigate('AttendanceManagement');
            return;
          }
          navigation.navigate('Attendance');
        },
      },
      {
        id: 'company',
        title: t('home.menu.company'),
        onPress: () => navigation.navigate('CompanyList'),
      },
      {
        id: 'report',
        title: t('home.menu.report'),
        onPress: () => navigation.navigate('Reports'),
      },
      ...(isOwnerCompany
        ? []
        : [
            {
              id: 'attendanceMgmt' as ModuleKey,
              title: t('home.menu.attendanceManagement'),
              onPress: () => navigation.navigate('AttendanceManagement'),
            },
          ]),
      {
        id: 'faceAttendance',
        title: t('home.menu.faceAttendance'),
        onPress: () => navigation.navigate('FaceAttendance'),
      },
      {
        id: 'employee',
        title: t('home.menu.employeeManagement'),
        onPress: () => navigation.navigate('EmployeeManagement'),
      },
      {
        id: 'leaveReq',
        title: t('home.menu.leaveRequest'),
        onPress: () => navigation.navigate('LeaveRequest'),
      },
      {
        id: 'leaveMgmt',
        title: t('home.menu.leaveManagement'),
        onPress: () => navigation.navigate('LeaveManagement'),
      },
      {
        id: 'onboarding',
        title: t('home.menu.onboarding'),
        onPress: () => navigation.navigate('OnboardingRequest'),
      },
    ];

    return rawItems.map(item => {
      const access = checkModuleAccess(item.id, selectedCompany, profileRole);
      return {
        id: item.id,
        title: item.title,
        icon: HOME_MENU_ICONS[item.id] ?? {
          name: 'apps',
          color: '#64748b',
          backgroundColor: '#f1f5f9',
        },
        allowed: access.allowed,
        lockReason: access.reason,
        onPress: access.allowed ? item.onPress : () => handleLockedCardPress(access.reason),
      };
    });
  }, [
    handleLockedCardPress,
    isOwnerCompany,
    navigation,
    profileRole,
    selectedCompany,
    t,
  ]);

  return (
    <View style={styles.root}>
      <MainTopBar />
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: gridMetrics.hPad },
          ]}
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

          {/* Prompt banner shown specifically when user has not yet created or joined a company */}
          {!hasCompany && (
            <View style={styles.noCompanyBanner}>
              <View style={styles.noCompanyBannerHeader}>
                <View style={styles.noCompanyBannerIconWrap}>
                  <MaterialCommunityIcons
                    name="office-building-plus"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.noCompanyBannerTextCol}>
                  <Text style={styles.noCompanyBannerTitle}>
                    {t('home.noCompanyBanner.title')}
                  </Text>
                  <Text style={styles.noCompanyBannerMessage}>
                    {t('home.noCompanyBanner.message')}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.noCompanyBanner.button')}
                style={({ pressed }) => [
                  styles.createCompanyBtn,
                  pressed && styles.createCompanyBtnPressed,
                ]}
                onPress={() => setCreateCompanyOpen(true)}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.createCompanyBtnText}>
                  {t('home.noCompanyBanner.button')}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.grid, { gap: gridMetrics.gridGap }]}>
            {actionCards.map(item => {
              const isLocked = !item.allowed;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityState={{ disabled: isLocked }}
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      width: gridMetrics.cardWidth,
                      minHeight: gridMetrics.cardMinH,
                      paddingVertical: gridMetrics.cardPadV,
                      paddingHorizontal: gridMetrics.cardPadH,
                    },
                    isLocked && styles.optionCardLocked,
                    pressed && (isLocked ? styles.optionCardLockedPressed : styles.optionCardPressed),
                  ]}>
                  {isLocked && (
                    <View style={styles.lockBadge}>
                      <MaterialCommunityIcons
                        name="lock"
                        size={11}
                        color={colors.textMuted}
                        accessibilityElementsHidden
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.iconBubble,
                      {
                        width: gridMetrics.iconBubbleSize,
                        height: gridMetrics.iconBubbleSize,
                        backgroundColor: isLocked ? colors.secondaryButton : item.icon.backgroundColor,
                      },
                      isLocked && styles.iconBubbleLocked,
                    ]}>
                    <MaterialCommunityIcons
                      name={item.icon.name}
                      size={gridMetrics.iconSize}
                      color={isLocked ? colors.textMuted : item.icon.color}
                      accessibilityElementsHidden
                    />
                  </View>
                  <Text
                    style={[
                      styles.optionTitle,
                      {
                        fontSize: gridMetrics.titleSize,
                        lineHeight: gridMetrics.titleLineHeight,
                      },
                      isLocked && styles.optionTitleLocked,
                    ]}
                    numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      <CreateCompany
        visible={createCompanyOpen}
        onDismiss={() => setCreateCompanyOpen(false)}
        onSubmit={onCreateSubmit}
      />

      <ConfirmAlert {...alertProps} />
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
      marginBottom: 16,
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
    noCompanyBanner: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary + '33',
      padding: 16,
      marginBottom: 18,
      gap: 14,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: scheme === 'dark' ? 0.3 : 0.08,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    noCompanyBannerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    noCompanyBannerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    noCompanyBannerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    noCompanyBannerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    noCompanyBannerMessage: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    createCompanyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    createCompanyBtnPressed: {
      opacity: 0.88,
    },
    createCompanyBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    optionCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
      position: 'relative',
    },
    optionCardLocked: {
      opacity: 0.48,
      backgroundColor: scheme === 'dark' ? '#161e2e' : '#f8fafc',
      borderColor: colors.border,
    },
    optionCardPressed: {
      backgroundColor: colors.secondaryButton,
      opacity: 0.96,
    },
    optionCardLockedPressed: {
      opacity: 0.65,
    },
    lockBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    iconBubble: {
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    iconBubbleLocked: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionTitle: {
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    optionTitleLocked: {
      color: colors.textMuted,
    },
  });
}
