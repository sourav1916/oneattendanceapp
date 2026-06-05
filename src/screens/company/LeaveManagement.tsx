import { HeaderBackButton } from '@react-navigation/elements';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import React, { useCallback, useMemo, useRef, useState } from 'react';

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



import { attendanceApi } from '@src/api/attendanceApi';

import { leaveApi } from '@src/api/leaveApi';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';

import { CreateManagementLeaveModal } from '@src/components/modals/CreateManagementLeaveModal';

import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';

import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';

import { useAuth } from '@src/context/AuthContext';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';

import type { HomeStackParamList } from '@src/navigation/types';

import type { AppThemeColors } from '@src/theme/palettes';

import type { CreateManagementLeavePayload } from '@src/types/leaveManagement';

import type { LeaveConfigEntry } from '@src/types/markAttendance';

import { readApiError } from '@src/utils/readApiError';



type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveManagement'>;



type MenuTheme = {

  accent: string;

  tint: string;

  border: string;

};



type LeaveMenuItem = {

  id: string;

  iconName: IconProps['name'];

  itemKey:

  | 'createLeave'

  | 'leaveRequests'

  | 'leaveBalances'

  | 'leaveConfigs';

  theme: MenuTheme;

};



const MENU_THEMES: Record<string, MenuTheme> = {

  create: { accent: '#2563eb', tint: '#dbeafe', border: '#bfdbfe' },

  requests: { accent: '#0891b2', tint: '#cffafe', border: '#a5f3fc' },

  balances: { accent: '#059669', tint: '#d1fae5', border: '#a7f3d0' },

  configs: { accent: '#7c3aed', tint: '#ede9fe', border: '#ddd6fe' },

};



const MENU_ITEMS: LeaveMenuItem[] = [

  {

    id: 'create',

    iconName: 'calendar-plus',

    itemKey: 'createLeave',

    theme: MENU_THEMES.create,

  },

  {

    id: 'requests',

    iconName: 'clipboard-text-clock-outline',

    itemKey: 'leaveRequests',

    theme: MENU_THEMES.requests,

  },

  {

    id: 'balances',

    iconName: 'scale-balance',

    itemKey: 'leaveBalances',

    theme: MENU_THEMES.balances,

  },

  {

    id: 'configs',

    iconName: 'file-cog-outline',

    itemKey: 'leaveConfigs',

    theme: MENU_THEMES.configs,

  },

];



const T = 'home.leaveManagement.createModal.';



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



type LeaveMenuRowProps = {

  item: LeaveMenuItem;

  styles: MenuRowStyles;

  colors: AppThemeColors;

  title: string;

  hint: string;

  scheme: 'light' | 'dark';

  isFirst: boolean;

  onPress: () => void;

};



const LeaveMenuRow = React.memo(function LeaveMenuRow({

  item,

  styles,

  colors,

  title,

  hint,

  scheme,

  isFirst,

  onPress,

}: LeaveMenuRowProps) {

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



export function LeaveManagementScreen({ navigation }: Props) {

  const { t, i18n } = useTranslation();

  const colors = useThemeColors();

  const { resolvedScheme } = useAppTheme();

  const { selectedCompany } = useAuth();

  const companyId = selectedCompany?.id ?? null;

  const styles = useMemo(

    () => buildStyles(colors, resolvedScheme),

    [colors, resolvedScheme],

  );

  const { props: confirmProps, present } = useConfirmAlert();

  const { props: statusProps, presentError, presentSuccess } = useStatusAlert();



  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [leaveConfigs, setLeaveConfigs] = useState<LeaveConfigEntry[]>([]);

  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const pendingPayloadRef = useRef<CreateManagementLeavePayload | null>(null);

  const pendingEmployeeNameRef = useRef('');



  const loadLeaveConfigs = useCallback(async () => {

    if (companyId == null) {

      setLeaveConfigs([]);

      return;

    }

    setLoadingConfigs(true);

    try {

      const res = await attendanceApi.fetchLeaveConfigs(companyId);

      setLeaveConfigs(res.data ?? []);

    } catch (e) {

      setLeaveConfigs([]);

      presentError({

        title: t(`${T}errorTitle`),

        message: readApiError(e),

      });

    } finally {

      setLoadingConfigs(false);

    }

  }, [companyId, presentError, t]);



  const openCreateModal = useCallback(() => {

    if (companyId == null) {

      presentError({

        title: t(`${T}errorTitle`),

        message: t(`${T}noCompany`),

      });

      return;

    }

    setCreateModalVisible(true);

    loadLeaveConfigs().catch(() => {});

  }, [companyId, loadLeaveConfigs, presentError, t]);



  const submitCreateLeave = useCallback(

    async (payload: CreateManagementLeavePayload) => {

      if (companyId == null) {

        return;

      }

      setSubmitting(true);

      try {

        const res = await leaveApi.createManagementLeave(companyId, payload);

        if (!res.success) {

          throw new Error(res.message?.trim() || t(`${T}errorTitle`));

        }

        setCreateModalVisible(false);

        presentSuccess({

          title: t(`${T}successTitle`),

          message: res.message?.trim() || t(`${T}successTitle`),

        });

      } catch (e) {

        presentError({

          title: t(`${T}errorTitle`),

          message: readApiError(e),

        });

      } finally {

        setSubmitting(false);

        pendingPayloadRef.current = null;

        pendingEmployeeNameRef.current = '';

      }

    },

    [companyId, presentError, presentSuccess, t],

  );



  const handleCreateSubmit = useCallback(

    (payload: CreateManagementLeavePayload, employeeName: string) => {

      pendingPayloadRef.current = payload;

      pendingEmployeeNameRef.current = employeeName;

      present({

        title: t(`${T}confirmTitle`),

        message: t(`${T}confirmMessage`, { name: employeeName }),

        buttons: [

          { text: t('home.leaveRequests.actions.confirm.cancel'), variant: 'secondary' },

          {

            text: t('home.leaveRequests.actions.confirm.confirm'),

            variant: 'primary',

            onPress: () => {

              const pending = pendingPayloadRef.current;

              if (pending) {

                submitCreateLeave(pending).catch(() => {});

              }

            },

          },

        ],

      });

    },

    [present, submitCreateLeave, t],

  );



  const handleItemPress = useCallback(

    (itemId: string) => {

      if (itemId === 'requests') {

        navigation.navigate('LeaveRequests');

        return;

      }

      if (itemId === 'create') {

        openCreateModal();

        return;

      }

      if (itemId === 'balances') {

        navigation.navigate('LeaveBalance');

        return;

      }

      if (itemId === 'configs') {

        navigation.navigate('LeaveConfig');

      }

    },

    [navigation, openCreateModal],

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

          accessibilityLabel={t('home.leaveManagement.back')}

        />

        <Text

          style={styles.stackHeaderTitle}

          numberOfLines={1}

          accessibilityRole="header">

          {t('home.leaveManagement.title')}

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

            <LeaveMenuRow

              key={item.id}

              item={item}

              styles={styles}

              colors={colors}

              scheme={resolvedScheme}

              isFirst={index === 0}

              title={t(`home.leaveManagement.items.${item.itemKey}.title`)}

              hint={t(`home.leaveManagement.items.${item.itemKey}.hint`)}

              onPress={() => handleItemPress(item.id)}

            />

          ))}

        </View>

      </ScrollView>



      <CreateManagementLeaveModal

        visible={createModalVisible}

        companyId={companyId}

        leaveConfigs={leaveConfigs}

        loadingConfigs={loadingConfigs}

        submitting={submitting}

        locale={i18n.language}

        onDismiss={() => {

          if (!submitting) {

            setCreateModalVisible(false);

          }

        }}

        onSubmit={handleCreateSubmit}

      />

      <ConfirmAlert {...confirmProps} />

      <StatusAlert {...statusProps} />

    </SafeAreaView>

  );

}

