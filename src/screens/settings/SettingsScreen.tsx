import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { LanguagePicker } from '@src/components/modals/LanguagePicker';
import { ThemePicker } from '@src/components/modals/ThemePicker';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { setAppLanguage } from '@src/i18n';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type SettingsScreenProps = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

type MenuRow = {
  id: string;
  title: string;
  subtitle?: string;
};

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
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 52,
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
    menuChevron: {
      fontSize: 22,
      color: colors.textMuted,
      fontWeight: '300',
    },
  });
}

function SettingsMenuRow({
  row,
  isFirst,
  isLast,
  onPress,
  ms,
}: {
  row: MenuRow;
  isFirst: boolean;
  isLast: boolean;
  onPress: (id: string) => void;
  ms: ReturnType<typeof buildSettingsStyles>;
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
      <Text style={ms.menuChevron} accessibilityElementsHidden>
        ›
      </Text>
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
          {
            id: 'profile',
            title: t('settings.rows.profile.title'),
            subtitle: t('settings.rows.profile.subtitle'),
          },
          {
            id: 'sessions',
            title: t('settings.rows.sessions.title'),
            subtitle: t('settings.rows.sessions.subtitle'),
          },
          {
            id: 'security',
            title: t('settings.rows.security.title'),
            subtitle: t('settings.rows.security.subtitle'),
          },
        ],
      },
      {
        title: t('settings.work'),
        rows: [
          {
            id: 'calendar',
            title: t('settings.rows.calendar.title'),
            subtitle: t('settings.rows.calendar.subtitle'),
          },
          {
            id: 'leaves',
            title: t('settings.rows.leaves.title'),
            subtitle: t('settings.rows.leaves.subtitle'),
          },
        ],
      },
      {
        title: t('settings.preferences'),
        rows: [
          {
            id: 'theme',
            title: t('settings.rows.theme.title'),
            subtitle: themeSubtitle,
          },
          {
            id: 'language',
            title: t('settings.rows.language.title'),
            subtitle: t('settings.rows.language.subtitle'),
          },
          {
            id: 'notifications',
            title: t('settings.rows.notifications.title'),
            subtitle: t('settings.rows.notifications.subtitle'),
          },
        ],
      },
      {
        title: t('settings.support'),
        rows: [
          {
            id: 'help',
            title: t('settings.rows.help.title'),
            subtitle: t('settings.rows.help.subtitle'),
          },
          {
            id: 'about',
            title: t('settings.rows.about.title'),
            subtitle: t('settings.rows.about.subtitle'),
          },
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
                <Text style={[ms.menuRowTitle, ms.menuRowTitleDanger]}>
                  {t('settings.logout')}
                </Text>
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
