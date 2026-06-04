import AsyncStorage from '@react-native-async-storage/async-storage';

export type FaceCaptureCameraPosition = 'front' | 'back';

const KEY = '@oneattendance/face_capture_camera_position';

const DEFAULT_POSITION: FaceCaptureCameraPosition = 'back';

function isFaceCaptureCameraPosition(
  v: string | null,
): v is FaceCaptureCameraPosition {
  return v === 'front' || v === 'back';
}

export async function getFaceCaptureCameraPosition(): Promise<FaceCaptureCameraPosition> {
  const raw = await AsyncStorage.getItem(KEY);
  return isFaceCaptureCameraPosition(raw) ? raw : DEFAULT_POSITION;
}

export async function setFaceCaptureCameraPosition(
  value: FaceCaptureCameraPosition,
): Promise<void> {
  await AsyncStorage.setItem(KEY, value);
}
