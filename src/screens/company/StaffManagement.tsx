import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = NativeStackScreenProps<HomeStackParamList, 'StaffManagement'>;

type StaffMenuItem = {
  id: string;
  iconName: IconProps['name'];
  itemKey: 'addStaff' | 'staffList' | 'staffShift' | 'salary' | 'reports';
};

const MENU_ITEMS: StaffMenuItem[] = [
  { id: 'add', iconName: 'account-plus-outline', itemKey: 'addStaff' },
  { id: 'list', iconName: 'format-list-bulleted', itemKey: 'staffList' },
  { id: 'shift', iconName: 'calendar-clock-outline', itemKey: 'staffShift' },
  { id: 'salary', iconName: 'cash-multiple', itemKey: 'salary' },
  { id: 'reports', iconName: 'chart-box-outline', itemKey: 'reports' },
];

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fill: {
      flex: 1,
    },
    stackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 52,
      maxHeight: 52,
    },
    stackHeaderTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 2,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    lead: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: 18,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: scheme === 'dark' ? 0.2 : 0.06,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    menuRowPressed: {
      backgroundColor: colors.secondaryButton,
      opacity: 0.96,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
      minWidth: 0,
    },
    menuTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    menuHint: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}

export function StaffManagementScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const { props: confirmProps, present } = useConfirmAlert();

  const openComingSoon = useCallback(() => {
    present({
      title: t('settings.alerts.comingSoonTitle'),
      message: t('settings.alerts.comingSoonMessage'),
      buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
    });
  }, [present, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.staffManagement.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('home.staffManagement.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('home.staffManagement.lead')}</Text>

        {MENU_ITEMS.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={t(`home.staffManagement.items.${item.itemKey}.title`)}
            onPress={() => {
              if (item.id === 'list') {
                navigation.navigate('StaffList');
                return;
              }
              openComingSoon();
            }}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={item.iconName} size={22} color={colors.primary} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.menuTitle}>{t(`home.staffManagement.items.${item.itemKey}.title`)}</Text>
              <Text style={styles.menuHint}>{t(`home.staffManagement.items.${item.itemKey}.hint`)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
