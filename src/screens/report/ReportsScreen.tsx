import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
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

import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = NativeStackScreenProps<HomeStackParamList, 'Reports'>;

type MenuTheme = {
  accent: string;
  tint: string;
  border: string;
};

type ReportMenuItem = {
  id: string;
  route: keyof Pick<HomeStackParamList, 'Ledger' | 'MySalary' | 'MyCalendar' | 'BankAccounts'>;
  iconName: IconProps['name'];
  titleKey: string;
  subtitleKey: string;
  theme: MenuTheme;
};

const REPORT_ITEMS: ReportMenuItem[] = [
  {
    id: 'calendar',
    route: 'MyCalendar',
    iconName: 'calendar-month-outline',
    titleKey: 'home.reports.calendarTitle',
    subtitleKey: 'home.reports.calendarSubtitle',
    theme: { accent: '#ea580c', tint: '#ffedd5', border: '#fed7aa' },
  },
  {
    id: 'ledger',
    route: 'Ledger',
    iconName: 'book-account-outline',
    titleKey: 'home.reports.ledgerTitle',
    subtitleKey: 'home.reports.ledgerSubtitle',
    theme: { accent: '#b45309', tint: '#fef3c7', border: '#fde68a' },
  },
  {
    id: 'mySalary',
    route: 'MySalary',
    iconName: 'cash-multiple',
    titleKey: 'home.reports.mySalaryTitle',
    subtitleKey: 'home.reports.mySalarySubtitle',
    theme: { accent: '#0891b2', tint: '#cffafe', border: '#a5f3fc' },
  },
  {
    id: 'bankAccounts',
    route: 'BankAccounts',
    iconName: 'bank-outline',
    titleKey: 'home.reports.bankAccountsTitle',
    subtitleKey: 'home.reports.bankAccountsSubtitle',
    theme: { accent: '#059669', tint: '#d1fae5', border: '#a7f3d0' },
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
      paddingTop: 16,
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

type ReportMenuRowProps = {
  item: ReportMenuItem;
  styles: MenuRowStyles;
  colors: AppThemeColors;
  title: string;
  hint: string;
  scheme: 'light' | 'dark';
  isFirst: boolean;
  onPress: () => void;
};

const ReportMenuRow = React.memo(function ReportMenuRow({
  item,
  styles,
  colors,
  title,
  hint,
  scheme,
  isFirst,
  onPress,
}: ReportMenuRowProps) {
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
        <Text style={styles.menuTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.menuHint} numberOfLines={2}>
          {hint}
        </Text>
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

export function ReportsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.reports.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('home.reports.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.menuCard}>
          {REPORT_ITEMS.map((item, index) => (
            <ReportMenuRow
              key={item.id}
              item={item}
              styles={styles}
              colors={colors}
              scheme={resolvedScheme}
              isFirst={index === 0}
              title={t(item.titleKey)}
              hint={t(item.subtitleKey)}
              onPress={() => navigation.navigate(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
