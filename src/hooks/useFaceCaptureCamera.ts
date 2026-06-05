import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, type LayoutChangeEvent } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
  type CapturePhotoSettings,
} from 'react-native-vision-camera';
import {
  useFaceDetectorOutput,
  type Face,
} from 'react-native-vision-camera-face-detector';

import {
  getFaceCaptureCameraPosition,
  setFaceCaptureCameraPosition,
  type FaceCaptureCameraPosition,
} from '@src/storage/faceCaptureStorage';

const MIN_FACE_RATIO = 0.08;
const FACE_DETECTOR_FALLBACK_WIDTH = 360;
const FACE_DETECTOR_FALLBACK_HEIGHT = 640;
/** Avoid racing CameraX torch with session configure/unbind. */
const TORCH_APPLY_DELAY_MS = 150;
/** Hold a stable face before auto-capture. */
const AUTO_CAPTURE_STABLE_MS = 750;

export { FACE_GUIDE_OFFSET_UP } from '@src/constants/faceCaptureLayout';

type UseFaceCaptureCameraOptions = {
  /** When true, face detection and capture button are disabled. */
  captureBusy: boolean;
  /** When false, camera preview is not started (e.g. confirm step). */
  cameraEnabled?: boolean;
  /** When false, camera session stays off (e.g. full-screen modal closed). */
  sessionActive?: boolean;
  /** Fire capture after the face stays valid for {@link AUTO_CAPTURE_STABLE_MS}. */
  autoCapture?: boolean;
  onAutoCapture?: () => void;
};

export function useFaceCaptureCamera({
  captureBusy,
  cameraEnabled = true,
  sessionActive = true,
  autoCapture = false,
  onAutoCapture,
}: UseFaceCaptureCameraOptions) {
  const routeFocused = useIsFocused();
  const isFocused = routeFocused && sessionActive;
  const { hasPermission, requestPermission, canRequestPermission } =
    useCameraPermission();
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'balanced' });

  const [cameraPosition, setCameraPosition] =
    useState<FaceCaptureCameraPosition>('back');
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [faceReady, setFaceReady] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);

  const captureBusyRef = useRef(captureBusy);
  captureBusyRef.current = captureBusy;
  const cameraActiveRef = useRef(false);

  const cameraRef = useRef<CameraRef>(null);
  const torchApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const torchEnabledOnDeviceRef = useRef(false);
  const autoCaptureFiredRef = useRef(false);
  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;

  const device = useCameraDevice(cameraPosition);

  /** Android may report hasTorch=true but still throw "No flash unit" (e.g. front cam). */
  const canUseTorch = useMemo(() => {
    if (cameraPosition !== 'back') {
      return false;
    }
    return device?.hasTorch === true && device?.hasFlash === true;
  }, [cameraPosition, device?.hasFlash, device?.hasTorch]);

  const [faceDetectorWindow, setFaceDetectorWindow] = useState({
    width: FACE_DETECTOR_FALLBACK_WIDTH,
    height: FACE_DETECTOR_FALLBACK_HEIGHT,
  });

  useEffect(() => {
    getFaceCaptureCameraPosition()
      .then(pos => {
        setCameraPosition(pos);
      })
      .catch(() => {})
      .finally(() => {
        setPreferenceLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch(() => {});
    }
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  const resetFaceDetectorWindow = useCallback(() => {
    setFaceDetectorWindow({
      width: FACE_DETECTOR_FALLBACK_WIDTH,
      height: FACE_DETECTOR_FALLBACK_HEIGHT,
    });
  }, []);

  const handleCameraLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) {
        return;
      }
      const rounded = { width: Math.round(width), height: Math.round(height) };
      setPreviewSize(prev =>
        prev.width === rounded.width && prev.height === rounded.height
          ? prev
          : rounded,
      );
      setFaceDetectorWindow(prev => {
        if (
          prev.width !== FACE_DETECTOR_FALLBACK_WIDTH ||
          prev.height !== FACE_DETECTOR_FALLBACK_HEIGHT
        ) {
          return prev;
        }
        return rounded;
      });
    },
    [],
  );

  const previewWidth = previewSize.width;
  const previewHeight = previewSize.height;
  const previewReady = previewWidth > 0 && previewHeight > 0;

  const cameraActive =
    sessionActive &&
    cameraEnabled &&
    isFocused &&
    appState === 'active' &&
    hasPermission &&
    device != null &&
    previewReady &&
    preferenceLoaded;

  cameraActiveRef.current = cameraActive;

  const clearTorchApplyTimer = useCallback(() => {
    if (torchApplyTimerRef.current != null) {
      clearTimeout(torchApplyTimerRef.current);
      torchApplyTimerRef.current = null;
    }
  }, []);

  const disableTorchOnDevice = useCallback(() => {
    clearTorchApplyTimer();
    if (!torchEnabledOnDeviceRef.current) {
      return;
    }
    const controller = cameraRef.current?.controller;
    if (controller == null) {
      torchEnabledOnDeviceRef.current = false;
      return;
    }
    controller.setTorchMode('off').catch(() => {});
    torchEnabledOnDeviceRef.current = false;
  }, [clearTorchApplyTimer]);

  const applyTorchOnDevice = useCallback(
    (enable: boolean) => {
      clearTorchApplyTimer();
      if (!enable) {
        disableTorchOnDevice();
        return;
      }
      torchApplyTimerRef.current = setTimeout(() => {
        torchApplyTimerRef.current = null;
        const controller = cameraRef.current?.controller;
        if (controller == null) {
          return;
        }
        controller.setTorchMode('on').catch(() => {});
        torchEnabledOnDeviceRef.current = true;
      }, TORCH_APPLY_DELAY_MS);
    },
    [clearTorchApplyTimer, disableTorchOnDevice],
  );

  useEffect(() => {
    if (!canUseTorch) {
      setTorchOn(false);
      disableTorchOnDevice();
    }
  }, [canUseTorch, device?.id, disableTorchOnDevice]);

  const canCapture =
    faceReady && !multipleFaces && previewReady && !captureBusy;

  useEffect(() => {
    if (!faceReady || multipleFaces || captureBusy) {
      autoCaptureFiredRef.current = false;
    }
  }, [captureBusy, faceReady, multipleFaces]);

  useEffect(() => {
    if (!autoCapture || onAutoCaptureRef.current == null) {
      return;
    }
    if (!canCapture || autoCaptureFiredRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (
        captureBusyRef.current ||
        autoCaptureFiredRef.current ||
        !cameraActiveRef.current ||
        !faceReady ||
        multipleFaces
      ) {
        return;
      }
      autoCaptureFiredRef.current = true;
      onAutoCaptureRef.current?.();
    }, AUTO_CAPTURE_STABLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [autoCapture, canCapture, faceReady, multipleFaces]);

  const resetFaceStability = useCallback(() => {
    setFaceReady(false);
    setMultipleFaces(false);
  }, []);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (captureBusyRef.current) {
        return;
      }
      if (faces.length > 1) {
        setMultipleFaces(true);
        setFaceReady(false);
        return;
      }
      if (faces.length !== 1) {
        resetFaceStability();
        return;
      }
      const face = faces[0];
      if (!face) {
        resetFaceStability();
        return;
      }
      setMultipleFaces(false);
      const area = face.bounds.width * face.bounds.height;
      const frameArea = previewWidth * previewHeight;
      if (frameArea > 0 && area / frameArea < MIN_FACE_RATIO) {
        setFaceReady(false);
        return;
      }
      setFaceReady(true);
    },
    [previewHeight, previewWidth, resetFaceStability],
  );

  const faceDetectorOutput = useFaceDetectorOutput({
    onFacesDetected,
    onError: resetFaceStability,
    autoMode: true,
    windowWidth: faceDetectorWindow.width,
    windowHeight: faceDetectorWindow.height,
    runLandmarks: false,
    runContours: false,
    runClassifications: false,
    performanceMode: 'fast',
    cameraFacing: cameraPosition,
  });

  const cameraOutputs = useMemo(
    () => [faceDetectorOutput, photoOutput],
    [faceDetectorOutput, photoOutput],
  );

  const toggleCameraPosition = useCallback(() => {
    disableTorchOnDevice();
    resetFaceDetectorWindow();
    setCameraPosition(prev => {
      const next: FaceCaptureCameraPosition =
        prev === 'front' ? 'back' : 'front';
      setFaceCaptureCameraPosition(next).catch(() => {});
      return next;
    });
    setTorchOn(false);
    resetFaceStability();
  }, [disableTorchOnDevice, resetFaceDetectorWindow, resetFaceStability]);

  const toggleTorch = useCallback(() => {
    if (!canUseTorch) {
      return;
    }
    setTorchOn(prev => {
      const next = !prev;
      applyTorchOnDevice(next);
      return next;
    });
  }, [applyTorchOnDevice, canUseTorch]);

  const capturePhotoSettings = useMemo((): CapturePhotoSettings => {
    if (canUseTorch && torchOn) {
      return { flashMode: 'on' };
    }
    return {};
  }, [canUseTorch, torchOn]);

  return {
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
    canCapture,
    handleCameraLayout,
    toggleCameraPosition,
    toggleTorch,
    capturePhotoSettings,
    resetFaceStability,
  };
}
