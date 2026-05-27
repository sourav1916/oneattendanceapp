import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { IconProps } from 'react-native-vector-icons/Icon';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { LanguagePicker } from '@src/components/modals/LanguagePicker';
import { ThemePicker } from '@src/components/modals/ThemePicker';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { setAppLanguage } from '@src/i18n';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type SettingsScreenProps = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

type MenuRowIcon = {
  name: IconProps['name'];
  color: string;
  backgroundColor: string;
};

type MenuRow = {
  id: string;
  title: string;
  subtitle?: string;
  icon: MenuRowIcon;
};

const MENU_ROW_ICONS: Record<string, MenuRowIcon> = {
  profile: { name: 'account-circle-outline', color: '#2563eb', backgroundColor: '#dbeafe' },
  sessions: { name: 'cellphone-link', color: '#7c3aed', backgroundColor: '#ede9fe' },
  security: { name: 'shield-lock-outline', color: '#059669', backgroundColor: '#d1fae5' },
  calendar: { name: 'calendar-month-outline', color: '#ea580c', backgroundColor: '#ffedd5' },
  leaves: { name: 'clipboard-list-outline', color: '#0891b2', backgroundColor: '#cffafe' },
  theme: { name: 'theme-light-dark', color: '#6366f1', backgroundColor: '#e0e7ff' },
  language: { name: 'translate', color: '#db2777', backgroundColor: '#fce7f3' },
  notifications: { name: 'bell-outline', color: '#ca8a04', backgroundColor: '#fef9c3' },
  help: { name: 'lifebuoy', color: '#4f46e5', backgroundColor: '#e0e7ff' },
  about: { name: 'information-outline', color: '#64748b', backgroundColor: '#f1f5f9' },
  logout: { name: 'logout', color: '#dc2626', backgroundColor: '#fee2e2' },
};

function menuRowWithIcon(
  id: string,
  title: string,
  subtitle?: string,
): MenuRow {
  return {
    id,
    title,
    subtitle,
    icon: MENU_ROW_ICONS[id] ?? {
      name: 'cog-outline',
      color: '#64748b',
      backgroundColor: '#f1f5f9',
    },
  };
}

type MenuSection = {
  title: string;
  rows: MenuRow[];
};

function buildSettingsStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 32,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 20,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 28,
      gap: 14,
    },
    summaryAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    summaryAvatarText: {
      fontSize: 22,
      fontWeight: '700',
      color: '#fff',
    },
    summaryAvatarImage: {
      width: '100%',
      height: '100%',
    },
    summaryText: {
      flex: 1,
      minWidth: 0,
    },
    summaryName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    summaryEmail: {
      fontSize: 15,
      color: colors.textMuted,
    },
    section: {
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
      marginLeft: 4,
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      minHeight: 56,
      gap: 12,
    },
    menuRowIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuRowFirst: {},
    menuRowLast: {},
    menuRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    menuRowPressed: {
      backgroundColor: colors.secondaryButton,
    },
    menuRowText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    menuRowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    menuRowTitleDanger: {
      color: colors.danger,
    },
    menuRowSubtitle: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}

function SettingsMenuRow({
  row,
  isFirst,
  isLast,
  onPress,
  ms,
  colors,
}: {
  row: MenuRow;
  isFirst: boolean;
  isLast: boolean;
  onPress: (id: string) => void;
  ms: ReturnType<typeof buildSettingsStyles>;
  colors: AppThemeColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={() => onPress(row.id)}
      style={({ pressed }) => [
        ms.menuRow,
        !isFirst && ms.menuRowBorder,
        isFirst && ms.menuRowFirst,
        isLast && ms.menuRowLast,
        pressed && ms.menuRowPressed,
      ]}>
      <View style={[ms.menuRowIconWrap, { backgroundColor: row.icon.backgroundColor }]}>
        <MaterialCommunityIcons name={row.icon.name} size={22} color={row.icon.color} />
      </View>
      <View style={ms.menuRowText}>
        <Text style={ms.menuRowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text style={ms.menuRowSubtitle} numberOfLines={2}>
            {row.subtitle}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.textMuted}
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const { name, email, signOut, cachedUserProfile } = useAuth();
  const { props: confirmProps, present } = useConfirmAlert();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const colors = useThemeColors();
  const { preference, setPreference } = useAppTheme();
  const ms = useMemo(() => buildSettingsStyles(colors), [colors]);

  const themeSubtitle =
    preference === 'light'
      ? t('settings.theme.modeLight')
      : preference === 'dark'
        ? t('settings.theme.modeDark')
        : t('settings.theme.modeSystem');

  const sections = useMemo<MenuSection[]>(
    () => [
      {
        title: t('settings.account'),
        rows: [
          menuRowWithIcon(
            'profile',
            t('settings.rows.profile.title'),
            t('settings.rows.profile.subtitle'),
          ),
          menuRowWithIcon(
            'sessions',
            t('settings.rows.sessions.title'),
            t('settings.rows.sessions.subtitle'),
          ),
          menuRowWithIcon(
            'security',
            t('settings.rows.security.title'),
            t('settings.rows.security.subtitle'),
          ),
        ],
      },
      {
        title: t('settings.preferences'),
        rows: [
          menuRowWithIcon('theme', t('settings.rows.theme.title'), themeSubtitle),
          menuRowWithIcon(
            'language',
            t('settings.rows.language.title'),
            t('settings.rows.language.subtitle'),
          ),
          menuRowWithIcon(
            'notifications',
            t('settings.rows.notifications.title'),
            t('settings.rows.notifications.subtitle'),
          ),
        ],
      },
      {
        title: t('settings.support'),
        rows: [
          menuRowWithIcon(
            'help',
            t('settings.rows.help.title'),
            t('settings.rows.help.subtitle'),
          ),
          menuRowWithIcon(
            'about',
            t('settings.rows.about.title'),
            t('settings.rows.about.subtitle'),
          ),
        ],
      },
    ],
    [t, i18n.language, themeSubtitle],
  );

  const handleRowPress = useCallback(
    (id: string) => {
      if (id === 'language') {
        setLanguagePickerOpen(true);
        return;
      }
      if (id === 'theme') {
        setThemePickerOpen(true);
        return;
      }
      if (id === 'sessions') {
        navigation.navigate('Sessions');
        return;
      }
      if (id === 'profile') {
        navigation.navigate('Profile');
        return;
      }
      if (id === 'security') {
        navigation.navigate('ChangePassword');
        return;
      }
      if (id === 'help') {
        navigation.navigate('Support');
        return;
      }
      present({
        title: t('settings.alerts.comingSoonTitle'),
        message: t('settings.alerts.comingSoonMessage'),
        buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
      });
    },
    [navigation, present, t],
  );

  const summaryName = (name?.trim() || cachedUserProfile?.name?.trim() || '').trim();
  const summaryEmail = (email?.trim() || cachedUserProfile?.email?.trim() || '').trim();
  const summaryPhotoUrl = (cachedUserProfile?.profilePictureUrl?.trim() || '').trim();

  const handleLogoutPress = useCallback(() => {
    present({
      title: t('settings.alerts.signOutTitle'),
      message: t('settings.alerts.signOutMessage'),
      buttons: [
        { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
        {
          key: 'signout',
          text: t('settings.alerts.signOutConfirm'),
          variant: 'danger',
          onPress: () => {
            signOut().catch(() => {
              /* noop */
            });
          },
        },
      ],
    });
  }, [present, signOut, t]);

  return (
    <>
      <SafeAreaView style={ms.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={ms.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <Text style={ms.screenTitle}>{t('settings.screenTitle')}</Text>

          <View style={ms.summaryCard}>
            <View style={ms.summaryAvatar}>
              {summaryPhotoUrl ? (
                <Image source={{ uri: summaryPhotoUrl }} style={ms.summaryAvatarImage} resizeMode="cover" />
              ) : (
                <Text style={ms.summaryAvatarText}>
                  {(summaryName || summaryEmail || '?')[0]?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>
            <View style={ms.summaryText}>
              <Text style={ms.summaryName} numberOfLines={1}>
                {summaryName || t('settings.account')}
              </Text>
              <Text style={ms.summaryEmail} numberOfLines={1}>
                {summaryEmail}
              </Text>
            </View>
          </View>

          {sections.map(section => (
            <View key={section.title} style={ms.section}>
              <Text style={ms.sectionTitle}>{section.title}</Text>
              <View style={ms.menuCard}>
                {section.rows.map((row, index) => (
                  <SettingsMenuRow
                    key={row.id}
                    row={row}
                    isFirst={index === 0}
                    isLast={index === section.rows.length - 1}
                    onPress={handleRowPress}
                    ms={ms}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          ))}

          <View style={ms.section}>
            <Text style={ms.sectionTitle}>{t('settings.session')}</Text>
            <View style={ms.menuCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.logout')}
                onPress={handleLogoutPress}
                style={({ pressed }) => [
                  ms.menuRow,
                  ms.menuRowFirst,
                  ms.menuRowLast,
                  pressed && ms.menuRowPressed,
                ]}>
                <View
                  style={[
                    ms.menuRowIconWrap,
                    { backgroundColor: MENU_ROW_ICONS.logout.backgroundColor },
                  ]}>
                  <MaterialCommunityIcons
                    name={MENU_ROW_ICONS.logout.name}
                    size={22}
                    color={MENU_ROW_ICONS.logout.color}
                  />
                </View>
                <View style={ms.menuRowText}>
                  <Text style={[ms.menuRowTitle, ms.menuRowTitleDanger]}>
                    {t('settings.logout')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <ConfirmAlert {...confirmProps} />
      <LanguagePicker
        visible={languagePickerOpen}
        title={t('settings.language.pickerTitle')}
        cancelLabel={t('settings.language.cancel')}
        currentLanguage={i18n.language}
        onDismiss={() => setLanguagePickerOpen(false)}
        onSelectLanguage={lang => setAppLanguage(lang)}
      />
      <ThemePicker
        visible={themePickerOpen}
        title={t('settings.theme.pickerTitle')}
        cancelLabel={t('settings.theme.cancel')}
        labels={{
          light: t('settings.theme.light'),
          dark: t('settings.theme.dark'),
          system: t('settings.theme.system'),
        }}
        currentPreference={preference}
        onDismiss={() => setThemePickerOpen(false)}
        onSelectTheme={pref => setPreference(pref)}
      />
    </>
  );
}
