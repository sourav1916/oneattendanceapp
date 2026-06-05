import { HeaderBackButton } from '@react-navigation/elements';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera } from 'react-native-vision-camera';

import { checkEmployeeFaceEnroll } from '@src/api/checkEmployeeFaceEnroll';
import { setEmployeeFaceEnroll } from '@src/api/setEmployeeFaceEnroll';
import { FaceCaptureCameraToolbar } from '@src/components/face/FaceCaptureCameraToolbar';
import { FaceCaptureGuideOverlay } from '@src/components/face/FaceCaptureGuideOverlay';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useFaceCaptureCamera } from '@src/hooks/useFaceCaptureCamera';
import type { PendingStatusAlert } from '@src/navigation/faceCaptureNavigation';
import type { AppThemeColors } from '@src/theme/palettes';
import {
  uploadFileToOneSaas,
  type UploadableFile,
} from '@src/utils/FileUpload';
import { parseFaceEnrollCheckResult } from '@src/utils/parseFaceEnrollCheckResult';
import { readApiError } from '@src/utils/readApiError';
import { isCameraCaptureFailure } from '@src/utils/isCameraCaptureFailure';
import { saveCameraPhotoForUpload } from '@src/utils/saveCameraPhotoForUpload';

export type FaceEnrollCaptureModalProps = {
  visible: boolean;
  employeeId: number;
  employeeName: string;
  mode: 'enroll' | 'check';
  onDismiss: () => void;
  onAlert: (alert: PendingStatusAlert) => void;
  onEnrollSuccess?: () => void;
};

const ACCENT = '#7c3aed';
const FACE_ENROLL_LOG_TAG = '[FaceEnrollCaptureModal]';

function logFaceEnrollError(stage: string, err: unknown): void {
  if (isCameraCaptureFailure(err)) {
    return;
  }
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
    cameraWrap: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: '#0f172a',
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

export function FaceEnrollCaptureModal({
  visible,
  employeeId,
  employeeName,
  mode,
  onDismiss,
  onAlert,
  onEnrollSuccess,
}: FaceEnrollCaptureModalProps) {
  const isCheckMode = mode === 'check';
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;

  const [pipelineStage, setPipelineStage] = useState<
    'idle' | 'photo' | 'upload' | 'api'
  >('idle');
  const submittedRef = useRef(false);
  const captureBusyRef = useRef(false);
  const pipelineStageRef = useRef<'photo' | 'upload' | 'api'>('photo');

  const pipelineBusy = pipelineStage !== 'idle';
  const captureBusy = pipelineBusy;

  const closeCapture = useCallback(() => {
    captureBusyRef.current = true;
    onDismiss();
  }, [onDismiss]);

  const closeWithAlert = useCallback(
    (alert: PendingStatusAlert) => {
      closeCapture();
      onAlert(alert);
    },
    [closeCapture, onAlert],
  );

  const handleCapturePressRef = useRef<() => void>(() => {});

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
    previewWidth,
    previewHeight,
    cameraActive,
    faceReady,
    multipleFaces,
    canCapture: baseCanCapture,
    handleCameraLayout,
    toggleCameraPosition,
    toggleTorch,
    capturePhotoSettings,
  } = useFaceCaptureCamera({
    captureBusy,
    sessionActive: visible,
    cameraEnabled: visible,
    autoCapture: visible && !pipelineBusy,
    onAutoCapture: () => {
      handleCapturePressRef.current();
    },
  });

  const canCapture =
    baseCanCapture && (isCheckMode || !submittedRef.current);

  useEffect(() => {
    if (visible) {
      submittedRef.current = false;
      return;
    }
    captureBusyRef.current = false;
    pipelineStageRef.current = 'photo';
    setPipelineStage('idle');
  }, [visible]);

  const pipelineOverlayMessage = useMemo(() => {
    if (pipelineStage === 'photo') {
      return t('home.faceAttendance.preparingPhoto');
    }
    if (pipelineStage === 'upload') {
      return t('home.faceEnrollCapture.uploadingImage');
    }
    if (pipelineStage === 'api') {
      return isCheckMode
        ? t('home.faceEnrollCapture.verifyingFace')
        : t('home.faceEnrollCapture.enrollingFace');
    }
    return '';
  }, [isCheckMode, pipelineStage, t]);

  captureBusyRef.current = captureBusy;

  const showEnrollSuccess = useCallback(
    (apiMessage: string | undefined) => {
      submittedRef.current = true;
      closeCapture();
      onEnrollSuccess?.();
      onAlert({
        tone: 'success',
        title: t('home.faceEnrollCapture.successTitle'),
        message:
          apiMessage?.trim() || t('home.faceEnrollCapture.successMessage'),
      });
    },
    [closeCapture, onAlert, onEnrollSuccess, t],
  );

  const showCheckResult = useCallback(
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
      const message = apiMessage?.trim()
        ? `${apiMessage.trim()}\n\n${detail}`
        : detail;

      if (matched) {
        closeCapture();
        onAlert({
          tone: 'success',
          title: t('home.faceEnrollCapture.checkSuccessTitle'),
          message,
        });
        return;
      }
      closeWithAlert({
        tone: 'error',
        title: t('home.faceEnrollCapture.checkNoMatchTitle'),
        message,
      });
    },
    [closeCapture, closeWithAlert, onAlert, t],
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
            closeWithAlert({
              tone: 'error',
              title: t('home.faceEnrollCapture.errorTitleCheck'),
              message:
                res.message?.trim() ||
                t('home.faceEnrollCapture.errorGenericCheck'),
            });
            return;
          }
          const parsed = parseFaceEnrollCheckResult(res);
          if (parsed.kind === 'not_enrolled') {
            closeWithAlert({
              tone: 'warning',
              title: t('home.faceEnrollCapture.checkNotEnrolledTitle'),
              message:
                res.message?.trim() ||
                t('home.faceEnrollCapture.checkNotEnrolledMessage'),
            });
            return;
          }
          if (parsed.kind === 'matched') {
            showCheckResult(
              true,
              parsed.similarity,
              parsed.threshold,
              res.message,
            );
            return;
          }
          if (parsed.kind === 'no_match') {
            showCheckResult(
              false,
              parsed.similarity,
              parsed.threshold,
              res.message,
            );
            return;
          }
          logFaceEnrollError('checkApi', res.message ?? res);
          closeWithAlert({
            tone: 'warning',
            title: t('home.faceEnrollCapture.errorTitleCheck'),
            message:
              res.message?.trim() ||
              t('home.faceEnrollCapture.errorGenericCheck'),
          });
          return;
        }

        const res = await setEmployeeFaceEnroll(companyId, {
          employee_id: employeeId,
          image,
        });
        if (!res.success) {
          logFaceEnrollError('enrollApi', res.message ?? res);
          closeWithAlert({
            tone: 'error',
            title: t('home.faceEnrollCapture.errorTitle'),
            message:
              res.message?.trim() || t('home.faceEnrollCapture.errorGeneric'),
          });
          return;
        }
        if (res.data?.face_enrolled !== true) {
          closeWithAlert({
            tone: 'warning',
            title: t('home.faceEnrollCapture.errorTitle'),
            message:
              res.message?.trim() || t('home.faceEnrollCapture.errorGeneric'),
          });
          return;
        }
        showEnrollSuccess(res.message);
      } catch (err) {
        logFaceEnrollError(isCheckMode ? 'checkSubmit' : 'enrollSubmit', err);
        closeWithAlert({
          tone: 'error',
          title: isCheckMode
            ? t('home.faceEnrollCapture.errorTitleCheck')
            : t('home.faceEnrollCapture.errorTitle'),
          message: readApiError(err),
        });
      }
    },
    [
      closeWithAlert,
      companyId,
      employeeId,
      isCheckMode,
      showCheckResult,
      showEnrollSuccess,
      t,
    ],
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
        return submitFaceImage(imageUrl);
      })
      .catch(err => {
        const stage = pipelineStageRef.current;
        const message = readApiError(err);
        const captureFailed =
          stage === 'photo' || isCameraCaptureFailure(err);
        if (!captureFailed) {
          logFaceEnrollError('capture', err);
        }
        closeWithAlert({
          tone: 'error',
          title: captureFailed
            ? t('home.faceAttendance.errors.captureTitle')
            : stage === 'upload'
              ? t('home.faceEnrollCapture.uploadErrorTitle')
              : isCheckMode
                ? t('home.faceEnrollCapture.errorTitleCheck')
                : t('home.faceEnrollCapture.errorTitle'),
          message: captureFailed
            ? t('home.faceAttendance.errors.captureMessage')
            : message,
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
    closeWithAlert,
    isCheckMode,
    photoOutput,
    submitFaceImage,
    t,
  ]);

  handleCapturePressRef.current = handleCapturePress;

  const handleRequestPermission = useCallback(() => {
    requestPermission().catch(() => {});
  }, [requestPermission]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={closeCapture}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <HeaderBackButton
            tintColor={colors.text}
            onPress={closeCapture}
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
              <View style={styles.modelsOverlay} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.modelsOverlayText}>
                  {pipelineOverlayMessage}
                </Text>
              </View>
            ) : null}
              {previewReady ? (
                <FaceCaptureGuideOverlay
                  width={previewWidth}
                  height={previewHeight}
                  faceReady={faceReady && !multipleFaces}
                  multipleFaces={multipleFaces}
                />
              ) : null}
            </View>
            <View style={styles.bottomPanel}>
              <Text style={styles.hint}>
                {multipleFaces
                  ? t('home.faceEnrollCapture.hintMultipleFaces')
                  : faceReady
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
      </SafeAreaView>
    </Modal>
  );
}
