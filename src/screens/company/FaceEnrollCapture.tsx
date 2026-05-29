import { HeaderBackButton } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFaceDetectorOutput,
  type Face,
} from 'react-native-vision-camera-face-detector';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { checkEmployeeFaceEnroll } from '@src/api/checkEmployeeFaceEnroll';
import { setEmployeeFaceEnroll } from '@src/api/setEmployeeFaceEnroll';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import {
  uploadFileToOneSaas,
  type UploadableFile,
} from '@src/utils/FileUpload';
import { parseFaceEnrollCheckResult } from '@src/utils/parseFaceEnrollCheckResult';
import { readApiError } from '@src/utils/readApiError';
import { saveCameraPhotoForUpload } from '@src/utils/saveCameraPhotoForUpload';

type Props = NativeStackScreenProps<HomeStackParamList, 'FaceEnrollCapture'>;

const ACCENT = '#7c3aed';
const MIN_FACE_RATIO = 0.08;
const FACE_DETECTOR_FALLBACK_WIDTH = 360;
const FACE_DETECTOR_FALLBACK_HEIGHT = 640;
const FACE_ENROLL_LOG_TAG = '[FaceEnrollCapture]';

function logFaceEnrollError(stage: string, err: unknown): void {
  const message = readApiError(err);
  console.error(`${FACE_ENROLL_LOG_TAG} ${stage}:`, message);
  if (err instanceof Error && err.stack) {
    console.error(`${FACE_ENROLL_LOG_TAG} stack:`, err.stack);
  } else if (err != null && typeof err === 'object') {
    console.error(`${FACE_ENROLL_LOG_TAG} details:`, err);
  }
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
      backgroundColor: 'transparent',
    },
    guideReady: {
      borderColor: '#4ade80',
    },
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
    permissionTextError: {
      color: colors.danger,
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

function uploadableFileFromLocalPath(path: string): UploadableFile {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  return {
    uri,
    mimeType: 'image/jpeg',
    fileName: `face-enroll-${Date.now()}.jpg`,
  };
}

export function FaceEnrollCaptureScreen({ navigation, route }: Props) {
  const { employeeId, employeeName, mode = 'enroll' } = route.params;
  const isCheckMode = mode === 'check';
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const isFocused = useIsFocused();
  const device = useCameraDevice('front');
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const {
    props: statusProps,
    presentSuccess,
    presentError,
    presentWarning,
  } = useStatusAlert();
  const { hasPermission, requestPermission, canRequestPermission } =
    useCameraPermission();

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [faceReady, setFaceReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const enrollingRef = useRef(false);
  const captureBusyRef = useRef(false);
  const captureStageRef = useRef<'photo' | 'upload' | 'api'>('photo');
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'balanced' });

  captureBusyRef.current = uploading || submitting;

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch(() => {});
    }
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  const handleCameraLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setPreviewSize({ width, height });
    }
  }, []);

  const previewWidth = previewSize.width;
  const previewHeight = previewSize.height;
  const previewReady = previewWidth > 0 && previewHeight > 0;

  // Keep camera active while capturing/processing — deactivating on `submitting`
  // unbinds ImageCapture and causes "Camera is closed" on Vision Camera v5.
  const cameraActive =
    isFocused &&
    appState === 'active' &&
    hasPermission &&
    device != null &&
    previewReady;

  const captureBusy = uploading || submitting;
  const canCapture =
    faceReady &&
    previewReady &&
    !captureBusy &&
    (isCheckMode || !submittedRef.current);

  const resetStability = useCallback(() => {
    setFaceReady(false);
  }, []);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (submittedRef.current || captureBusyRef.current) {
        return;
      }
      if (faces.length !== 1) {
        resetStability();
        return;
      }
      const face = faces[0];
      if (!face) {
        resetStability();
        return;
      }
      const area = face.bounds.width * face.bounds.height;
      const frameArea = previewWidth * previewHeight;
      if (frameArea > 0 && area / frameArea < MIN_FACE_RATIO) {
        resetStability();
        return;
      }
      setFaceReady(true);
    },
    [previewHeight, previewWidth, resetStability],
  );

  const detectorWindowWidth = previewReady
    ? previewWidth
    : FACE_DETECTOR_FALLBACK_WIDTH;
  const detectorWindowHeight = previewReady
    ? previewHeight
    : FACE_DETECTOR_FALLBACK_HEIGHT;

  const faceDetectorOutput = useFaceDetectorOutput({
    onFacesDetected,
    onError: resetStability,
    autoMode: true,
    windowWidth: detectorWindowWidth,
    windowHeight: detectorWindowHeight,
    runLandmarks: false,
    runContours: false,
    runClassifications: false,
    performanceMode: 'fast',
    cameraFacing: 'front',
  });

  const cameraOutputs = useMemo(
    () => [faceDetectorOutput, photoOutput],
    [faceDetectorOutput, photoOutput],
  );

  const showEnrollSuccessModal = useCallback(
    (apiMessage: string | undefined) => {
      submittedRef.current = true;
      presentSuccess({
        title: t('home.faceEnrollCapture.successTitle'),
        message:
          apiMessage?.trim() || t('home.faceEnrollCapture.successMessage'),
        showMessage: true,
        onAfterDismiss: () => navigation.goBack(),
      });
    },
    [navigation, presentSuccess, t],
  );

  const showCheckResultModal = useCallback(
    (
      matched: boolean,
      similarity: string,
      threshold: string,
      apiMessage?: string,
    ) => {
      const detail = matched
        ? t('home.faceEnrollCapture.checkSuccessMessage', {
            similarity,
            threshold,
          })
        : t('home.faceEnrollCapture.checkNoMatchMessage', {
            similarity,
            threshold,
          });
      const message = apiMessage?.trim() ? `${apiMessage.trim()}\n\n${detail}` : detail;

      if (matched) {
        presentSuccess({
          title: t('home.faceEnrollCapture.checkSuccessTitle'),
          message,
          showMessage: true,
          onAfterDismiss: () => navigation.goBack(),
        });
        return;
      }
      presentError({
        title: t('home.faceEnrollCapture.checkNoMatchTitle'),
        message,
        showMessage: true,
      });
    },
    [navigation, presentError, presentSuccess, t],
  );

  const submitFaceImage = useCallback(
    async (image: string) => {
      if (companyId == null) {
        return;
      }
      if (!isCheckMode && submittedRef.current) {
        return;
      }

      try {
      if (isCheckMode) {
        const res = await checkEmployeeFaceEnroll(companyId, {
          employee_id: employeeId,
          image,
        });
        if (!res.success) {
          logFaceEnrollError('checkApi', res.message ?? res);
          presentError({
            title: t('home.faceEnrollCapture.errorTitleCheck'),
            message:
              res.message?.trim() ||
              t('home.faceEnrollCapture.errorGenericCheck'),
            showMessage: true,
          });
          return;
        }
        const parsed = parseFaceEnrollCheckResult(res);
        if (parsed.kind === 'not_enrolled') {
          presentWarning({
            title: t('home.faceEnrollCapture.checkNotEnrolledTitle'),
            message:
              res.message?.trim() ||
              t('home.faceEnrollCapture.checkNotEnrolledMessage'),
            showMessage: true,
          });
          return;
        }
        if (parsed.kind === 'matched') {
          showCheckResultModal(
            true,
            parsed.similarity,
            parsed.threshold,
            res.message,
          );
          return;
        }
        if (parsed.kind === 'no_match') {
          showCheckResultModal(
            false,
            parsed.similarity,
            parsed.threshold,
            res.message,
          );
          return;
        }
        logFaceEnrollError('checkApi', res.message ?? res);
        presentWarning({
          title: t('home.faceEnrollCapture.errorTitleCheck'),
          message:
            res.message?.trim() || t('home.faceEnrollCapture.errorGenericCheck'),
          showMessage: true,
        });
        return;
      }

      const res = await setEmployeeFaceEnroll(companyId, {
        employee_id: employeeId,
        image,
      });
      if (!res.success) {
        logFaceEnrollError('enrollApi', res.message ?? res);
        presentError({
          title: t('home.faceEnrollCapture.errorTitle'),
          message:
            res.message?.trim() || t('home.faceEnrollCapture.errorGeneric'),
          showMessage: true,
        });
        return;
      }
      if (res.data?.face_enrolled !== true) {
        presentWarning({
          title: t('home.faceEnrollCapture.errorTitle'),
          message:
            res.message?.trim() || t('home.faceEnrollCapture.errorGeneric'),
          showMessage: true,
        });
        return;
      }
      showEnrollSuccessModal(res.message);
      } catch (err) {
        logFaceEnrollError(isCheckMode ? 'checkSubmit' : 'enrollSubmit', err);
        presentError({
          title: isCheckMode
            ? t('home.faceEnrollCapture.errorTitleCheck')
            : t('home.faceEnrollCapture.errorTitle'),
          message: readApiError(err),
        });
      }
    },
    [
      companyId,
      employeeId,
      isCheckMode,
      presentError,
      presentWarning,
      showCheckResultModal,
      showEnrollSuccessModal,
      t,
    ],
  );

  const handleCapturePress = useCallback(() => {
    if (!canCapture || enrollingRef.current) {
      return;
    }
    enrollingRef.current = true;
    captureBusyRef.current = true;
    captureStageRef.current = 'photo';
    photoOutput
      .capturePhoto({}, {})
      .then(photo => saveCameraPhotoForUpload(photo))
      .then(path => {
        captureStageRef.current = 'upload';
        setUploading(true);
        return uploadFileToOneSaas(uploadableFileFromLocalPath(path));
      })
      .then(imageUrl => {
        captureStageRef.current = 'api';
        setUploading(false);
        setSubmitting(true);
        return submitFaceImage(imageUrl);
      })
      .catch(err => {
        logFaceEnrollError('capture', err);
        const uploadFailed = captureStageRef.current === 'upload';
        presentError({
          title: uploadFailed
            ? t('home.faceEnrollCapture.uploadErrorTitle')
            : isCheckMode
              ? t('home.faceEnrollCapture.errorTitleCheck')
              : t('home.faceEnrollCapture.errorTitle'),
          message: readApiError(err),
        });
      })
      .finally(() => {
        enrollingRef.current = false;
        captureBusyRef.current = false;
        captureStageRef.current = 'photo';
        setUploading(false);
        setSubmitting(false);
      });
  }, [canCapture, isCheckMode, photoOutput, presentError, submitFaceImage, t]);

  const handleRequestPermission = useCallback(() => {
    requestPermission().catch(() => {});
  }, [requestPermission]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <HeaderBackButton
          tintColor={colors.text}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('home.faceEnrollCapture.back')}
        />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isCheckMode
              ? t('home.faceEnrollCapture.titleCheck')
              : t('home.faceEnrollCapture.title')}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {employeeName}
          </Text>
        </View>
      </View>

      {!hasPermission ? (
        <View style={styles.permissionBox}>
          <MaterialCommunityIcons
            name="camera-off"
            size={48}
            color={colors.textMuted}
          />
          <Text style={styles.permissionText}>
            {isCheckMode
              ? t('home.faceEnrollCapture.permissionNeededCheck')
              : t('home.faceEnrollCapture.permissionNeeded')}
          </Text>
          {canRequestPermission ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleRequestPermission}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnLabel}>
                {t('home.faceEnrollCapture.grantPermission')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : device == null ? (
        <View style={styles.noDeviceBox}>
          <MaterialCommunityIcons
            name="camera-off"
            size={48}
            color="#94a3b8"
          />
          <Text style={styles.noDeviceText}>
            {t('home.faceEnrollCapture.noCamera')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.cameraWrap} onLayout={handleCameraLayout}>
            {previewReady ? (
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                resizeMode="cover"
                isActive={cameraActive}
                outputs={cameraOutputs}
              />
            ) : null}
            {uploading ? (
              <View style={styles.modelsOverlay} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.modelsOverlayText}>
                  {t('home.faceEnrollCapture.uploadingImage')}
                </Text>
              </View>
            ) : null}
            {submitting ? (
              <View style={styles.modelsOverlay} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.modelsOverlayText}>
                  {isCheckMode
                    ? t('home.faceEnrollCapture.verifyingFace')
                    : t('home.faceEnrollCapture.enrollingFace')}
                </Text>
              </View>
            ) : null}
            <View style={styles.overlay} pointerEvents="none">
              <View style={[styles.guide, faceReady && styles.guideReady]} />
            </View>
          </View>
          <View style={styles.bottomPanel}>
            <Text style={styles.hint}>
              {faceReady
                ? isCheckMode
                  ? t('home.faceEnrollCapture.hintReadyCheck')
                  : t('home.faceEnrollCapture.hintReady')
                : isCheckMode
                  ? t('home.faceEnrollCapture.hintAlignCheck')
                  : t('home.faceEnrollCapture.hintAlign')}
            </Text>
            <Text style={styles.hintMuted}>
              {isCheckMode
                ? t('home.faceEnrollCapture.hintManualCheck')
                : t('home.faceEnrollCapture.hintManual')}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canCapture}
              onPress={handleCapturePress}
              style={({ pressed }) => [
                styles.primaryBtn,
                !canCapture && styles.primaryBtnDisabled,
                pressed && canCapture && styles.primaryBtnPressed,
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
                  <Text style={styles.primaryBtnLabel}>
                    {isCheckMode
                      ? t('home.faceEnrollCapture.captureCheck')
                      : t('home.faceEnrollCapture.capture')}
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
