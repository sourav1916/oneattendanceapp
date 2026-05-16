import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
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

function userInitials(displayName: string | null, emailFallback: string | null) {
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
      ...Platform.select({
        android: { elevation: 1 },
        ios: {},
      }),
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

export function MainTopBar() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildMainTopBarStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const navigation = useNavigation<TabNav>();
  const { name, email, profileRole, selectedCompany, selectCompany } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const eligibleCompanies = useMemo(
    () => companiesFromProfileRole(profileRole?.data?.companies ?? {}),
    [profileRole],
  );

  const showCompanySwitcher = eligibleCompanies.length > 0;
  useEffect(() => {
    if (!showCompanySwitcher && switcherOpen) {
      setSwitcherOpen(false);
    }
  }, [showCompanySwitcher, switcherOpen]);

  const displayName = selectedCompany?.name ?? COMPANY_DISPLAY_NAME;
  const letter = displayName.trim()[0]?.toUpperCase() ?? '?';

  const initials = userInitials(name, email);

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
            {showCompanySwitcher ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show companies"
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
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </Pressable>
      </View>

      <CompanySwitcher
        visible={switcherOpen}
        companies={eligibleCompanies}
        selectedId={selectedCompany?.id ?? null}
        onClose={() => setSwitcherOpen(false)}
        onSelectCompany={c => {
          void selectCompany(c);
        }}
      />
    </View>
  );
}
