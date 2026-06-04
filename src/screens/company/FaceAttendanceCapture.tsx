import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera } from 'react-native-vision-camera';

import { FaceCaptureCameraToolbar } from '@src/components/face/FaceCaptureCameraToolbar';
import { postFaceAttendance } from '@src/api/postFaceAttendance';
import { postFaceAttendanceCheck } from '@src/api/postFaceAttendanceCheck';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useFaceCaptureCamera } from '@src/hooks/useFaceCaptureCamera';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import {
  uploadFileToOneSaas,
  type UploadableFile,
} from '@src/utils/FileUpload';
import { faceAttendanceActionLabel } from '@src/utils/faceAttendanceActions';
import { humanizeLedgerKey } from '@src/utils/ledgerFormat';
import {
  faceAttendanceCheckFromAxiosError,
  parseFaceAttendanceCheckResponse,
  type FaceAttendanceMatchedEmployee,
} from '@src/utils/parseFaceAttendanceCheck';
import { readApiError } from '@src/utils/readApiError';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';
import { saveCameraPhotoForUpload } from '@src/utils/saveCameraPhotoForUpload';

type Props = NativeStackScreenProps<HomeStackParamList, 'FaceAttendanceCapture'>;

const ACCENT = '#0d9488';
const CONFIRM_COUNTDOWN_SEC = 5;
const AVATAR_SIZE = 80;

type ScreenPhase = 'camera' | 'confirm';

type PendingMatch = FaceAttendanceMatchedEmployee & { imageUrl: string };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    if (a && b) {
      return `${a}${b}`.toUpperCase();
    }
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function uploadableFileFromLocalPath(path: string): UploadableFile {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  return {
    uri,
    mimeType: 'image/jpeg',
    fileName: `face-attendance-${Date.now()}.jpg`,
  };
}

function buildCameraStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#000' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 52,
      maxHeight: 52,
    },
    headerTitleWrap: { flex: 1 },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    headerSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    cameraWrap: { flex: 1, backgroundColor: '#000' },
    overlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guide: {
      width: 240,
      height: 300,
      borderRadius: 120,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      marginTop: -56,
    },
    guideReady: { borderColor: '#4ade80' },
    guideMultiple: { borderColor: '#fbbf24' },
    bottomPanel: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Platform.OS === 'ios' ? 28 : 20,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 12,
    },
    hint: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
    hintMuted: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    primaryBtn: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: ACCENT,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnPressed: { opacity: 0.9 },
    primaryBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
    modelsOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      gap: 10,
      paddingHorizontal: 24,
    },
    modelsOverlayText: {
      color: '#e2e8f0',
      fontSize: 14,
      textAlign: 'center',
    },
    noDeviceBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#000',
    },
    noDeviceText: {
      fontSize: 15,
      color: '#e2e8f0',
      textAlign: 'center',
      marginTop: 12,
    },
    permissionBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    permissionText: {
      fontSize: 15,
      color: colors.text,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    secondaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: dark ? '#334155' : colors.secondaryButton,
    },
    secondaryBtnLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
  });
}

function buildConfirmStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 52,
      maxHeight: 52,
    },
    headerTitleWrap: { flex: 1 },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    headerSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    scroll: { flex: 1 },
    content: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
      justifyContent: 'space-between',
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: dark ? 'rgba(13,148,136,0.2)' : '#ccfbf1',
      borderWidth: 1,
      borderColor: dark ? 'rgba(13,148,136,0.4)' : '#99f6e4',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      overflow: 'hidden',
    },
    avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
    avatarInitials: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.primary,
    },
    employeeName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    meta: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 4,
    },
    detailsBlock: {
      alignSelf: 'stretch',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 8,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    detailTextWrap: { flex: 1 },
    detailLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 1,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    timerRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 3,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginVertical: 16,
    },
    timerText: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.primary,
    },
    timerHint: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 14,
    },
    btnRow: { flexDirection: 'row', gap: 10 },
    retakeBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPressed: { opacity: 0.88 },
    btnDisabled: { opacity: 0.5 },
    retakeText: { fontSize: 15, fontWeight: '700', color: colors.text },
    confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}

type DetailRowProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
  styles: ReturnType<typeof buildConfirmStyles>;
  colors: AppThemeColors;
};

function DetailRow({ icon, label, value, styles, colors }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.textMuted} />
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function FaceAttendanceCaptureScreen({ navigation, route }: Props) {
  const { action } = route.params;
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const cameraStyles = useMemo(
    () => buildCameraStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const confirmStyles = useMemo(
    () => buildConfirmStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const {
    props: statusProps,
    presentError,
    presentSuccess,
    presentWarning,
  } = useStatusAlert();

  const [phase, setPhase] = useState<ScreenPhase>('camera');
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [pipelineStage, setPipelineStage] = useState<
    'idle' | 'photo' | 'upload' | 'api'
  >('idle');
  const [marking, setMarking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_COUNTDOWN_SEC);

  const captureBusyRef = useRef(false);
  const pipelineStageRef = useRef<'photo' | 'upload' | 'api'>('photo');
  const markingInFlightRef = useRef(false);
  const autoConfirmRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pipelineBusy = pipelineStage !== 'idle';
  const captureBusy = pipelineBusy;

  const exitToFaceAttendanceHub = useCallback(() => {
    navigation.navigate('FaceAttendance');
  }, [navigation]);

  const faceCamera = useFaceCaptureCamera({
    captureBusy,
    cameraEnabled: phase === 'camera',
  });
  const {
    photoOutput,
    device,
    cameraOutputs,
    cameraPosition,
    torchOn,
    canUseTorch,
    cameraRef,
    hasPermission,
    canRequestPermission,
    requestPermission,
    preferenceLoaded,
    previewReady,
    cameraActive,
    faceReady,
    multipleFaces,
    canCapture,
    handleCameraLayout,
    toggleCameraPosition,
    toggleTorch,
    capturePhotoSettings,
  } = faceCamera;

  const actionLabel = useMemo(
    () => faceAttendanceActionLabel(t, action),
    [action, t],
  );

  const resetConfirmTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    autoConfirmRef.current = false;
    setSecondsLeft(CONFIRM_COUNTDOWN_SEC);
  }, []);

  const retakePhoto = useCallback(() => {
    resetConfirmTimer();
    setPendingMatch(null);
    setPhase('camera');
    setMarking(false);
    markingInFlightRef.current = false;
  }, [resetConfirmTimer]);

  useEffect(() => {
    if (phase !== 'confirm' || marking) {
      return;
    }
    resetConfirmTimer();
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [marking, phase, resetConfirmTimer]);

  captureBusyRef.current = captureBusy;

  const pipelineOverlayMessage = useMemo(() => {
    if (pipelineStage === 'photo') {
      return t('home.faceAttendance.preparingPhoto');
    }
    if (pipelineStage === 'upload') {
      return t('home.faceAttendance.uploadingImage');
    }
    if (pipelineStage === 'api') {
      return t('home.faceAttendance.checkingFace');
    }
    return '';
  }, [pipelineStage, t]);

  const runFaceCheck = useCallback(
    async (imageUrl: string) => {
      if (companyId == null) {
        return;
      }
      let res;
      try {
        res = await postFaceAttendanceCheck(companyId, {
          type: action,
          image: imageUrl,
        });
      } catch (err) {
        const fromAxios = faceAttendanceCheckFromAxiosError(err);
        if (fromAxios) {
          res = fromAxios;
        } else {
          throw err;
        }
      }
      const parsed = parseFaceAttendanceCheckResponse(res);
      if (parsed.kind === 'allowed') {
        setPendingMatch({ ...parsed.employee, imageUrl });
        setPhase('confirm');
        return;
      }
      if (parsed.kind === 'not_allowed') {
        presentWarning({
          title: t('home.faceAttendance.errors.notAllowedTitle'),
          message: parsed.message,
          showMessage: true,
          onAfterDismiss: exitToFaceAttendanceHub,
        });
        return;
      }
      presentError({
        title: t('home.faceAttendance.errors.identifyFailedTitle'),
        message:
          parsed.message ||
          t('home.faceAttendance.errors.identifyFailedMessage'),
        showMessage: true,
        onAfterDismiss: exitToFaceAttendanceHub,
      });
    },
    [action, companyId, exitToFaceAttendanceHub, presentError, presentWarning, t],
  );

  const handleCapturePress = useCallback(() => {
    if (!canCapture || captureBusyRef.current) {
      return;
    }
    captureBusyRef.current = true;
    pipelineStageRef.current = 'photo';
    photoOutput
      .capturePhoto(capturePhotoSettings, {})
      .then(photo => {
        setPipelineStage('photo');
        return saveCameraPhotoForUpload(photo);
      })
      .then(path => {
        pipelineStageRef.current = 'upload';
        setPipelineStage('upload');
        return uploadFileToOneSaas(uploadableFileFromLocalPath(path));
      })
      .then(imageUrl => {
        pipelineStageRef.current = 'api';
        setPipelineStage('api');
        return runFaceCheck(imageUrl);
      })
      .catch(err => {
        const stage = pipelineStageRef.current;
        const message = readApiError(err);
        const captureFailed =
          stage === 'photo' ||
          /abortRequests|Camera is closed|ImageCapture/i.test(message);
        presentError({
          title: captureFailed
            ? t('home.faceAttendance.errors.captureTitle')
            : stage === 'upload'
              ? t('home.faceAttendance.errors.uploadTitle')
              : t('home.faceAttendance.errors.identifyFailedTitle'),
          message: captureFailed
            ? t('home.faceAttendance.errors.captureMessage')
            : message,
          showMessage: true,
          onAfterDismiss: exitToFaceAttendanceHub,
        });
      })
      .finally(() => {
        captureBusyRef.current = false;
        pipelineStageRef.current = 'photo';
        setPipelineStage('idle');
      });
  }, [
    canCapture,
    capturePhotoSettings,
    exitToFaceAttendanceHub,
    photoOutput,
    presentError,
    runFaceCheck,
    t,
  ]);

  const markAttendance = useCallback(async () => {
    if (
      companyId == null ||
      pendingMatch == null ||
      markingInFlightRef.current
    ) {
      return;
    }
    markingInFlightRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setMarking(true);
    try {
      const res = await postFaceAttendance(companyId, {
        type: action,
        image: pendingMatch.imageUrl,
        employee_id: pendingMatch.employeeId,
      });
      if (!res.success) {
        presentError({
          title: t('home.faceAttendance.errors.markFailedTitle'),
          message:
            res.message?.trim() ||
            t('home.faceAttendance.errors.markFailedMessage'),
          showMessage: true,
          onAfterDismiss: exitToFaceAttendanceHub,
        });
        return;
      }
      const detail = res.data
        ? t('home.faceAttendance.successDetail', {
            date: res.data.attendance_date,
            time: res.data.time,
          })
        : '';
      const message = res.message?.trim()
        ? detail
          ? `${res.message.trim()}\n${detail}`
          : res.message.trim()
        : detail || t('home.faceAttendance.successMessage');
      presentSuccess({
        title: t('home.faceAttendance.successTitle'),
        message,
        showMessage: true,
        onAfterDismiss: () => navigation.navigate('FaceAttendance'),
      });
    } catch (err) {
      presentError({
        title: t('home.faceAttendance.errors.markFailedTitle'),
        message: readApiError(err),
        showMessage: true,
        onAfterDismiss: exitToFaceAttendanceHub,
      });
    } finally {
      markingInFlightRef.current = false;
      setMarking(false);
    }
  }, [
    action,
    companyId,
    exitToFaceAttendanceHub,
    navigation,
    pendingMatch,
    presentError,
    presentSuccess,
    t,
  ]);

  useEffect(() => {
    if (
      phase === 'confirm' &&
      secondsLeft === 0 &&
      !autoConfirmRef.current &&
      !markingInFlightRef.current &&
      pendingMatch != null
    ) {
      autoConfirmRef.current = true;
      markAttendance().catch(() => {});
    }
  }, [markAttendance, marking, pendingMatch, phase, secondsLeft]);

  const handleBack = useCallback(() => {
    if (phase === 'confirm') {
      retakePhoto();
      return;
    }
    navigation.goBack();
  }, [navigation, phase, retakePhoto]);

  if (companyId == null) {
    return (
      <SafeAreaView style={cameraStyles.safe} edges={['top', 'bottom']}>
        <View style={cameraStyles.header}>
          <HeaderBackButton
            tintColor={colors.text}
            onPress={() => navigation.goBack()}
          />
          <Text style={cameraStyles.headerTitle}>
            {t('home.faceAttendance.captureTitle')}
          </Text>
        </View>
        <View style={cameraStyles.permissionBox}>
          <Text style={cameraStyles.permissionText}>
            {t('home.faceAttendance.noCompany')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'confirm' && pendingMatch != null) {
    const avatarUri = resolveMediaUrl(pendingMatch.profilePictureUrl) || null;
    const designationLabel = pendingMatch.designation
      ? humanizeLedgerKey(pendingMatch.designation)
      : null;
    const similarityLabel =
      pendingMatch.similarity != null && Number.isFinite(pendingMatch.similarity)
        ? t('home.faceAttendance.similarity', {
            value: (pendingMatch.similarity * 100).toFixed(0),
          })
        : null;

    return (
      <SafeAreaView style={confirmStyles.safe} edges={['top', 'bottom']}>
        <View style={confirmStyles.header}>
          <HeaderBackButton
            tintColor={colors.text}
            onPress={handleBack}
            accessibilityLabel={t('home.faceAttendance.back')}
          />
          <View style={confirmStyles.headerTitleWrap}>
            <Text style={confirmStyles.headerTitle} numberOfLines={1}>
              {t('home.faceAttendance.confirmTitle')}
            </Text>
            <Text style={confirmStyles.headerSub} numberOfLines={1}>
              {actionLabel}
            </Text>
          </View>
        </View>

        <ScrollView
          style={confirmStyles.scroll}
          contentContainerStyle={confirmStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={confirmStyles.heroCard}>
            <View style={confirmStyles.avatarWrap}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={confirmStyles.avatarImage}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Text style={confirmStyles.avatarInitials}>
                  {getInitials(pendingMatch.employeeName)}
                </Text>
              )}
            </View>
            <Text style={confirmStyles.employeeName}>
              {pendingMatch.employeeName}
            </Text>
            <Text style={confirmStyles.meta}>
              {t('home.faceAttendance.employeeId', {
                id: pendingMatch.employeeId,
              })}
            </Text>
            {similarityLabel ? (
              <Text style={confirmStyles.meta}>{similarityLabel}</Text>
            ) : null}
            <View style={confirmStyles.detailsBlock}>
              {designationLabel ? (
                <DetailRow
                  icon="briefcase-outline"
                  label={t('home.faceAttendance.designation')}
                  value={designationLabel}
                  styles={confirmStyles}
                  colors={colors}
                />
              ) : null}
              {pendingMatch.email ? (
                <DetailRow
                  icon="email-outline"
                  label={t('home.faceAttendance.email')}
                  value={pendingMatch.email}
                  styles={confirmStyles}
                  colors={colors}
                />
              ) : null}
              {pendingMatch.mobile ? (
                <DetailRow
                  icon="phone-outline"
                  label={t('home.faceAttendance.mobile')}
                  value={pendingMatch.mobile}
                  styles={confirmStyles}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>

          <View>
            <View style={confirmStyles.timerRing}>
              {marking ? (
                <ActivityIndicator color={colors.primary} size="large" />
              ) : (
                <Text style={confirmStyles.timerText}>{secondsLeft}</Text>
              )}
            </View>
            <Text style={confirmStyles.timerHint}>
              {marking
                ? t('home.faceAttendance.marking')
                : t('home.faceAttendance.confirmHint')}
            </Text>
            <View style={confirmStyles.btnRow}>
              <Pressable
                accessibilityRole="button"
                disabled={marking}
                onPress={retakePhoto}
                style={({ pressed }) => [
                  confirmStyles.retakeBtn,
                  marking && confirmStyles.btnDisabled,
                  pressed && !marking && confirmStyles.btnPressed,
                ]}
              >
                <Text style={confirmStyles.retakeText}>
                  {t('home.faceAttendance.retake')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={marking}
                onPress={() => {
                  markAttendance().catch(() => {});
                }}
                style={({ pressed }) => [
                  confirmStyles.confirmBtn,
                  marking && confirmStyles.btnDisabled,
                  pressed && !marking && confirmStyles.btnPressed,
                ]}
              >
                {marking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={confirmStyles.confirmText}>
                    {t('home.faceAttendance.confirm')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <StatusAlert {...statusProps} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={cameraStyles.safe} edges={['top', 'bottom']}>
      <View style={cameraStyles.header}>
        <HeaderBackButton
          tintColor={colors.text}
          onPress={handleBack}
          accessibilityLabel={t('home.faceAttendance.back')}
        />
        <View style={cameraStyles.headerTitleWrap}>
          <Text style={cameraStyles.headerTitle} numberOfLines={1}>
            {t('home.faceAttendance.captureTitle')}
          </Text>
          <Text style={cameraStyles.headerSub} numberOfLines={1}>
            {actionLabel}
          </Text>
        </View>
      </View>

      {!hasPermission ? (
        <View style={cameraStyles.permissionBox}>
          <MaterialCommunityIcons
            name="camera-off"
            size={48}
            color={colors.textMuted}
          />
          <Text style={cameraStyles.permissionText}>
            {t('home.faceAttendance.permissionNeeded')}
          </Text>
          {canRequestPermission ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                requestPermission().catch(() => {});
              }}
              style={cameraStyles.secondaryBtn}
            >
              <Text style={cameraStyles.secondaryBtnLabel}>
                {t('home.faceAttendance.grantPermission')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : device == null ? (
        <View style={cameraStyles.noDeviceBox}>
          <MaterialCommunityIcons name="camera-off" size={48} color="#94a3b8" />
          <Text style={cameraStyles.noDeviceText}>
            {t('home.faceAttendance.noCamera')}
          </Text>
        </View>
      ) : (
        <>
          <View style={cameraStyles.cameraWrap} onLayout={handleCameraLayout}>
            {preferenceLoaded ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                resizeMode="cover"
                orientationSource="interface"
                isActive={cameraActive}
                outputs={cameraOutputs}
              />
            ) : null}
            <FaceCaptureCameraToolbar
              cameraPosition={cameraPosition}
              hasTorch={canUseTorch}
              torchOn={torchOn}
              disabled={captureBusy}
              onToggleCamera={toggleCameraPosition}
              onToggleTorch={toggleTorch}
            />
            {pipelineBusy ? (
              <View style={cameraStyles.modelsOverlay} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={cameraStyles.modelsOverlayText}>
                  {pipelineOverlayMessage}
                </Text>
              </View>
            ) : null}
            <View style={cameraStyles.overlay} pointerEvents="none">
              <View
                style={[
                  cameraStyles.guide,
                  faceReady &&
                    !multipleFaces &&
                    cameraStyles.guideReady,
                  multipleFaces && cameraStyles.guideMultiple,
                ]}
              />
            </View>
          </View>
          <View style={cameraStyles.bottomPanel}>
            <Text style={cameraStyles.hint}>
              {multipleFaces
                ? t('home.faceAttendance.hintMultipleFaces')
                : faceReady
                  ? t('home.faceAttendance.hintReady')
                  : t('home.faceAttendance.hintAlign')}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canCapture}
              onPress={handleCapturePress}
              style={({ pressed }) => [
                cameraStyles.primaryBtn,
                !canCapture && cameraStyles.primaryBtnDisabled,
                pressed && canCapture && cameraStyles.primaryBtnPressed,
              ]}
            >
              {captureBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="face-recognition"
                    size={22}
                    color="#fff"
                  />
                  <Text style={cameraStyles.primaryBtnLabel}>
                    {t('home.faceAttendance.capture')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
      <StatusAlert {...statusProps} />
    </SafeAreaView>
  );
}
