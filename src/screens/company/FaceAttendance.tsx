import { HeaderBackButton } from '@react-navigation/elements';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import React, { useCallback, useMemo, useState } from 'react';

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



import { FaceAttendanceCaptureModal } from '@src/components/modals/FaceAttendanceCaptureModal';

import { FaceAttendanceCheckDeniedModal } from '@src/components/modals/FaceAttendanceCheckDeniedModal';

import {

  StatusAlert,

  useStatusAlert,

} from '@src/components/modals/StatusAlert';

import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';

import type { FaceAttendancePendingDenied } from '@src/navigation/faceCaptureNavigation';

import type { FaceAttendanceFlowParamList } from '@src/navigation/types';

import type { AppThemeColors } from '@src/theme/palettes';

import type { FaceAttendanceActionType } from '@src/types/faceAttendance';

import {

  FACE_ATTENDANCE_ACTIONS,

  faceAttendanceActionHint,

  faceAttendanceActionLabel,

} from '@src/utils/faceAttendanceActions';



type Props = NativeStackScreenProps<
  FaceAttendanceFlowParamList,
  'FaceAttendance'
>;



type ActionTheme = {

  accent: string;

  tint: string;

  border: string;

  icon: IconProps['name'];

};



const ACTION_THEMES: Record<FaceAttendanceActionType, ActionTheme> = {

  'punch in': {

    accent: '#059669',

    tint: '#d1fae5',

    border: '#a7f3d0',

    icon: 'login',

  },

  'punch out': {

    accent: '#dc2626',

    tint: '#fee2e2',

    border: '#fecaca',

    icon: 'logout',

  },

  'break start': {

    accent: '#d97706',

    tint: '#ffedd5',

    border: '#fed7aa',

    icon: 'coffee-outline',

  },

  'break end': {

    accent: '#2563eb',

    tint: '#dbeafe',

    border: '#bfdbfe',

    icon: 'coffee-off-outline',

  },

};



function buildStyles(colors: AppThemeColors) {

  return StyleSheet.create({

    safe: { flex: 1, backgroundColor: colors.background },

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

    lead: {

      fontSize: 14,

      color: colors.textMuted,

      lineHeight: 20,

      marginBottom: 16,

    },

    menuCard: {

      backgroundColor: colors.surface,

      borderRadius: 12,

      borderWidth: 1,

      borderColor: colors.border,

      overflow: 'hidden',

      marginBottom: 16,

    },

    menuRow: {

      flexDirection: 'row',

      alignItems: 'center',

      gap: 12,

      paddingVertical: 14,

      paddingHorizontal: 14,

      minHeight: 60,

    },

    menuRowBorder: {

      borderTopWidth: StyleSheet.hairlineWidth,

      borderTopColor: colors.border,

    },

    menuRowPressed: {

      backgroundColor: colors.secondaryButton,

    },

    iconWrap: {

      width: 44,

      height: 44,

      borderRadius: 12,

      alignItems: 'center',

      justifyContent: 'center',

      borderWidth: 1,

    },

    textCol: { flex: 1, minWidth: 0 },

    menuTitle: {

      fontSize: 16,

      fontWeight: '700',

      color: colors.text,

    },

    menuHint: {

      marginTop: 3,

      fontSize: 13,

      color: colors.textMuted,

      lineHeight: 18,

    },

    enrollLink: {

      flexDirection: 'row',

      alignItems: 'center',

      gap: 10,

      paddingVertical: 14,

      paddingHorizontal: 14,

      borderRadius: 12,

      borderWidth: 1,

      borderColor: colors.border,

      backgroundColor: colors.surface,

    },

    enrollLinkPressed: { opacity: 0.88 },

    enrollTitle: {

      flex: 1,

      fontSize: 15,

      fontWeight: '600',

      color: colors.primary,

    },

  });

}



export function FaceAttendanceScreen({ navigation }: Props) {

  const { t } = useTranslation();

  const colors = useThemeColors();

  const { resolvedScheme } = useAppTheme();

  const dark = resolvedScheme === 'dark';

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const { props: statusProps, presentError, presentWarning, presentSuccess } =

    useStatusAlert();

  const [captureAction, setCaptureAction] =

    useState<FaceAttendanceActionType | null>(null);

  const [checkDenied, setCheckDenied] =

    useState<FaceAttendancePendingDenied | null>(null);



  const openCapture = useCallback((action: FaceAttendanceActionType) => {

    setCaptureAction(action);

  }, []);



  const closeCapture = useCallback(() => {

    setCaptureAction(null);

  }, []);



  const handleCheckDenied = useCallback((denied: FaceAttendancePendingDenied) => {

    setCheckDenied(denied);

  }, []);



  const handleCaptureAlert = useCallback(

    (alert: {

      tone: 'error' | 'warning' | 'success';

      title: string;

      message?: string;

    }) => {

      const config = {

        title: alert.title,

        message: alert.message,

        showMessage: true,

      };

      if (alert.tone === 'error') {

        presentError(config);

        return;

      }

      if (alert.tone === 'warning') {

        presentWarning(config);

        return;

      }

      presentSuccess(config);

    },

    [presentError, presentSuccess, presentWarning],

  );



  const deniedActionLabel = useMemo(

    () =>

      checkDenied != null

        ? faceAttendanceActionLabel(t, checkDenied.action)

        : undefined,

    [checkDenied, t],

  );



  return (

    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>

      <View style={styles.stackHeader}>

        {navigation.canGoBack() ? (
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            tintColor={colors.primary}
            displayMode="minimal"
            accessibilityLabel={t('home.faceAttendance.back')}
          />
        ) : null}

        <Text style={styles.stackHeaderTitle} numberOfLines={1}>

          {t('home.faceAttendance.title')}

        </Text>

      </View>



      <ScrollView

        contentContainerStyle={styles.scroll}

        showsVerticalScrollIndicator={false}

      >

        <Text style={styles.lead}>{t('home.faceAttendance.lead')}</Text>



        <View style={styles.menuCard}>

          {FACE_ATTENDANCE_ACTIONS.map((action, index) => {

            const theme = ACTION_THEMES[action];

            const iconBg = dark ? `${theme.accent}22` : theme.tint;

            const iconBorder = dark ? `${theme.accent}44` : theme.border;

            return (

              <Pressable

                key={action}

                accessibilityRole="button"

                onPress={() => openCapture(action)}

                style={({ pressed }) => [

                  styles.menuRow,

                  index > 0 && styles.menuRowBorder,

                  pressed && styles.menuRowPressed,

                ]}

              >

                <View

                  style={[

                    styles.iconWrap,

                    { backgroundColor: iconBg, borderColor: iconBorder },

                  ]}

                >

                  <MaterialCommunityIcons

                    name={theme.icon}

                    size={24}

                    color={theme.accent}

                  />

                </View>

                <View style={styles.textCol}>

                  <Text style={styles.menuTitle}>

                    {faceAttendanceActionLabel(t, action)}

                  </Text>

                  <Text style={styles.menuHint}>

                    {faceAttendanceActionHint(t, action)}

                  </Text>

                </View>

                <MaterialCommunityIcons

                  name="chevron-right"

                  size={22}

                  color={colors.textMuted}

                />

              </Pressable>

            );

          })}

        </View>



        <Pressable

          accessibilityRole="button"

          onPress={() => navigation.navigate('FaceEnroll')}

          style={({ pressed }) => [

            styles.enrollLink,

            pressed && styles.enrollLinkPressed,

          ]}

        >

          <MaterialCommunityIcons

            name="face-recognition"

            size={22}

            color={colors.primary}

          />

          <Text style={styles.enrollTitle}>

            {t('home.faceAttendance.manageEnrollment')}

          </Text>

          <MaterialCommunityIcons

            name="chevron-right"

            size={22}

            color={colors.textMuted}

          />

        </Pressable>

      </ScrollView>



      {captureAction != null ? (

        <FaceAttendanceCaptureModal

          visible

          action={captureAction}

          onDismiss={closeCapture}

          onCheckDenied={handleCheckDenied}

          onAlert={handleCaptureAlert}

        />

      ) : null}



      <StatusAlert {...statusProps} />

      <FaceAttendanceCheckDeniedModal

        visible={checkDenied != null}

        employee={checkDenied?.employee ?? null}

        message={checkDenied?.message ?? ''}

        actionLabel={deniedActionLabel}

        onDismiss={() => {

          setCheckDenied(null);

        }}

      />

    </SafeAreaView>

  );

}


