import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanySwitcher } from '@src/components/modals/CompanySwitcher';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { MainTabParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { COMPANY_DISPLAY_NAME } from '@src/utils/config';
import { companiesFromProfileRole } from '@src/utils/companiesFromProfileRole';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';
import {
  displayEmailFromSources,
  displayNameFromSources,
  initialsFromDisplayName,
  profilePictureFromSources,
} from '@src/utils/userDisplay';

type TabNav = BottomTabNavigationProp<MainTabParamList>;

function buildMainTopBarStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      minHeight: 48,
      paddingBottom: 8,
      paddingTop: 4,
    },
    brand: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
      gap: 10,
      minWidth: 0,
    },
    nameAndArrow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      gap: 6,
    },
    brandLogo: {
      width: 34,
      height: 34,
      borderRadius: 8,
      flexShrink: 0,
    },
    brandLogoPlaceholder: {
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#dbeafe',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    brandLogoLetter: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    company: {
      flexShrink: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      minWidth: 0,
    },
    arrowBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    arrowBtnPressed: {
      opacity: 0.85,
      backgroundColor: colors.secondaryButton,
    },
    arrowIcon: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    arrowIconOpen: {
      transform: [{ rotate: '180deg' }],
    },
    profileHit: {
      borderRadius: 999,
      padding: 2,
      flexShrink: 0,
    },
    profileHitPressed: {
      opacity: 0.75,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        android: { elevation: 1 },
        ios: {},
      }),
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

export function MainTopBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildMainTopBarStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const navigation = useNavigation<TabNav>();
  const {
    name,
    email,
    profileRole,
    cachedUserProfile,
    profileRoleUser,
    selectedCompany,
    selectCompany,
    refreshProfileRole,
  } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherRefreshing, setSwitcherRefreshing] = useState(false);

  const eligibleCompanies = useMemo(
    () => companiesFromProfileRole(profileRole?.data?.companies ?? {}),
    [profileRole],
  );

  const hasCompanies = eligibleCompanies.length > 0;
  /** Arrow when user has companies, or when profile-role loaded with none (refresh to pick up new/joined companies). */
  const showCompanyArrow = hasCompanies || profileRole != null;

  useEffect(() => {
    if (!switcherOpen) {
      setSwitcherRefreshing(false);
      return;
    }
    let cancelled = false;
    setSwitcherRefreshing(true);
    void refreshProfileRole({ silent: true }).finally(() => {
      if (!cancelled) {
        setSwitcherRefreshing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [switcherOpen, refreshProfileRole]);

  const displayName = selectedCompany?.name ?? COMPANY_DISPLAY_NAME;
  const letter = displayName.trim()[0]?.toUpperCase() ?? '?';

  const userDisplayName = useMemo(
    () => displayNameFromSources(name, email, cachedUserProfile, profileRoleUser),
    [name, email, cachedUserProfile, profileRoleUser],
  );
  const userEmail = useMemo(
    () => displayEmailFromSources(email, cachedUserProfile, profileRoleUser),
    [email, cachedUserProfile, profileRoleUser],
  );
  const profilePhotoUrl = useMemo(() => {
    const raw = profilePictureFromSources(cachedUserProfile, profileRoleUser);
    return raw ? resolveMediaUrl(raw) : '';
  }, [cachedUserProfile, profileRoleUser]);
  const profileInitials = useMemo(
    () => initialsFromDisplayName(userDisplayName, userEmail),
    [userDisplayName, userEmail],
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
            },
            android: { elevation: 2 },
          }),
        },
      ]}>
      <View style={styles.row}>
        <View style={styles.brand}>
          {selectedCompany?.logo_url ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: selectedCompany.logo_url }}
              style={styles.brandLogo}
            />
          ) : selectedCompany ? (
            <View style={[styles.brandLogo, styles.brandLogoPlaceholder]}>
              <Text style={styles.brandLogoLetter}>{letter}</Text>
            </View>
          ) : null}
          <View style={styles.nameAndArrow}>
            <Text style={styles.company} numberOfLines={1}>
              {displayName}
            </Text>
            {showCompanyArrow ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.companySwitcher.showCompanies')}
                accessibilityState={{ expanded: switcherOpen }}
                hitSlop={10}
                onPress={() => setSwitcherOpen(true)}
                style={({ pressed }) => [
                  styles.arrowBtn,
                  pressed && styles.arrowBtnPressed,
                ]}>
                <Text style={[styles.arrowIcon, switcherOpen && styles.arrowIconOpen]}>
                  ▼
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile and settings"
          onPress={() => navigation.navigate('Settings')}
          style={({ pressed }) => [styles.profileHit, pressed && styles.profileHitPressed]}>
          <View style={styles.avatar}>
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={styles.avatarImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={styles.avatarText}>{profileInitials}</Text>
            )}
          </View>
        </Pressable>
      </View>

      <CompanySwitcher
        visible={switcherOpen}
        companies={eligibleCompanies}
        selectedId={selectedCompany?.id ?? null}
        refreshing={switcherRefreshing}
        onClose={() => setSwitcherOpen(false)}
        onSelectCompany={c => {
          void selectCompany(c);
        }}
      />
    </View>
  );
}
