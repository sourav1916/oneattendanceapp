import type { Photo } from 'react-native-vision-camera';

const UPLOAD_JPEG_QUALITY = 90;

/**
 * Writes a captured photo to JPEG with orientation and mirroring baked into pixels.
 * Avoids `Photo.saveToTemporaryFileAsync()`, which keeps rotation in EXIF and often
 * displays sideways on servers that ignore EXIF.
 */
export async function saveCameraPhotoForUpload(photo: Photo): Promise<string> {
  const image = await photo.toImageAsync();
  photo.dispose();
  return image.saveToTemporaryFileAsync('jpg', UPLOAD_JPEG_QUALITY);
}
