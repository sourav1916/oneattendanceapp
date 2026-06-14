import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export type LatLng = { latitude: number; longitude: number };

export type EnsureLocationForVerifyResult =
  | { ok: true; coords: LatLng }
  | { ok: false; kind: 'permission' | 'position' };

/**
 * Requests location permission and reads one fix. Required before verify-otp.
 * Does not open Settings — the UI should offer that when `ok` is false.
 */
export async function ensureLocationForVerify(): Promise<EnsureLocationForVerifyResult> {
  try {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth !== 'granted') {
        return { ok: false, kind: 'permission' };
      }
    } else if (Platform.OS === 'android') {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const hasFine = await PermissionsAndroid.check(fine);
      if (!hasFine) {
        const result = await PermissionsAndroid.request(fine);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          return { ok: false, kind: 'permission' };
        }
      }
      const stillFine = await PermissionsAndroid.check(fine);
      if (!stillFine) {
        return { ok: false, kind: 'permission' };
      }
    } else {
      return { ok: false, kind: 'permission' };
    }

    const coords = await new Promise<LatLng | null>(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            resolve(null);
            return;
          }
          resolve({ latitude, longitude });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

    if (!coords) {
      return { ok: false, kind: 'position' };
    }
    return { ok: true, coords };
  } catch {
    return { ok: false, kind: 'position' };
  }
}

/** Best-effort location for optional auth payloads; returns `null` if unavailable. */
export async function tryOptionalLocationCoords(): Promise<LatLng | null> {
  const result = await ensureLocationForVerify();
  return result.ok ? result.coords : null;
}
