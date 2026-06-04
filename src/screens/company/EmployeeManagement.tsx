import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = NativeStackScreenProps<HomeStackParamList, 'EmployeeManagement'>;

type MenuTheme = {
  accent: string;
  tint: string;
  border: string;
};

type EmployeeMenuItem = {
  id: string;
  iconName: IconProps['name'];
  itemKey:
  | 'addEmployee'
  | 'employeeList'
  | 'invitePackages'
  | 'companyInvites'
  | 'permissions'
  | 'faceEnrollList'
  | 'companyLedger'
  | 'employeeShift'
  | 'salary'
  | 'reports';
  theme: MenuTheme;
};

const MENU_THEMES: Record<string, MenuTheme> = {
  add: { accent: '#2563eb', tint: '#dbeafe', border: '#bfdbfe' },
  invites: { accent: '#d946ef', tint: '#fae8ff', border: '#f5d0fe' },
  list: { accent: '#059669', tint: '#d1fae5', border: '#a7f3d0' },
  packages: { accent: '#ea580c', tint: '#ffedd5', border: '#fed7aa' },
  salary: { accent: '#0891b2', tint: '#cffafe', border: '#a5f3fc' },
  shift: { accent: '#4f46e5', tint: '#eef2ff', border: '#c7d2fe' },
  reports: { accent: '#7c3aed', tint: '#ede9fe', border: '#ddd6fe' },
  permissions: { accent: '#0d9488', tint: '#ccfbf1', border: '#99f6e4' },
  face: { accent: '#7c3aed', tint: '#ede9fe', border: '#ddd6fe' },
  ledger: { accent: '#0d9488', tint: '#ccfbf1', border: '#99f6e4' },
};

const MENU_ITEMS: EmployeeMenuItem[] = [
  {
    id: 'add',
    iconName: 'account-plus-outline',
    itemKey: 'addEmployee',
    theme: MENU_THEMES.add,
  },
  {
    id: 'invites',
    iconName: 'email-send-outline',
    itemKey: 'companyInvites',
    theme: MENU_THEMES.invites,
  },
  {
    id: 'list',
    iconName: 'format-list-bulleted',
    itemKey: 'employeeList',
    theme: MENU_THEMES.list,
  },
  {
    id: 'packages',
    iconName: 'package-variant-closed',
    itemKey: 'invitePackages',
    theme: MENU_THEMES.packages,
  },
  {
    id: 'salary',
    iconName: 'cash-multiple',
    itemKey: 'salary',
    theme: MENU_THEMES.salary,
  },
  {
    id: 'shift',
    iconName: 'calendar-clock-outline',
    itemKey: 'employeeShift',
    theme: MENU_THEMES.shift,
  },
  {
    id: 'reports',
    iconName: 'chart-box-outline',
    itemKey: 'reports',
    theme: MENU_THEMES.reports,
  },
  {
    id: 'permissions',
    iconName: 'shield-key-outline',
    itemKey: 'permissions',
    theme: MENU_THEMES.permissions,
  },
  {
    id: 'face',
    iconName: 'face-recognition',
    itemKey: 'faceEnrollList',
    theme: MENU_THEMES.face,
  },
  {
    id: 'ledger',
    iconName: 'book-open-variant',
    itemKey: 'companyLedger',
    theme: MENU_THEMES.ledger,
  },
];

function buildStyles(colors: AppThemeColors, _scheme: 'light' | 'dark') {
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
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 32,
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
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minHeight: 56,
    },
    menuRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    menuRowPressed: {
      backgroundColor: colors.secondaryButton,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 11,
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
    },
    menuHint: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}

type MenuRowStyles = ReturnType<typeof buildStyles>;

type EmployeeMenuRowProps = {
  item: EmployeeMenuItem;
  styles: MenuRowStyles;
  colors: AppThemeColors;
  title: string;
  hint: string;
  scheme: 'light' | 'dark';
  isFirst: boolean;
  onPress: () => void;
};

const EmployeeMenuRow = React.memo(function EmployeeMenuRow({
  item,
  styles,
  colors,
  title,
  hint,
  scheme,
  isFirst,
  onPress,
}: EmployeeMenuRowProps) {
  const dark = scheme === 'dark';
  const { theme } = item;
  const iconBg = dark ? `${theme.accent}22` : theme.tint;
  const iconBorder = dark ? `${theme.accent}44` : theme.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !isFirst && styles.menuRowBorder,
        pressed && styles.menuRowPressed,
      ]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconBg, borderColor: iconBorder },
        ]}>
        <MaterialCommunityIcons
          name={item.iconName}
          size={24}
          color={theme.accent}
          accessibilityElementsHidden
        />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.menuTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.menuHint} numberOfLines={2}>{hint}</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={dark ? colors.textMuted : '#94a3b8'}
        accessibilityElementsHidden
      />
    </Pressable>
  );
});

export function EmployeeManagementScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { props: confirmProps, present } = useConfirmAlert();

  const openComingSoon = useCallback(() => {
    present({
      title: t('settings.alerts.comingSoonTitle'),
      message: t('settings.alerts.comingSoonMessage'),
      buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
    });
  }, [present, t]);

  const handleItemPress = useCallback(
    (itemId: string) => {
      if (itemId === 'add') {
        navigation.navigate('CreateEmployee');
        return;
      }
      if (itemId === 'list') {
        navigation.navigate('EmployeeList');
        return;
      }
      if (itemId === 'packages') {
        navigation.navigate('InvitePackages');
        return;
      }
      if (itemId === 'invites') {
        navigation.navigate('CompanyInvites');
        return;
      }
      if (itemId === 'permissions') {
        navigation.navigate('PermissionManagement');
        return;
      }
      if (itemId === 'face') {
        navigation.navigate('FaceEnrollList');
        return;
      }
      if (itemId === 'ledger') {
        navigation.navigate('CompanyLedger');
        return;
      }
      openComingSoon();
    },
    [navigation, openComingSoon],
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.employeeManagement.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header">
          {t('home.employeeManagement.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <EmployeeMenuRow
              key={item.id}
              item={item}
              styles={styles}
              colors={colors}
              scheme={resolvedScheme}
              isFirst={index === 0}
              title={t(`home.employeeManagement.items.${item.itemKey}.title`)}
              hint={t(`home.employeeManagement.items.${item.itemKey}.hint`)}
              onPress={() => handleItemPress(item.id)}
            />
          ))}
        </View>
      </ScrollView>
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
