import type { Image } from 'react-native-nitro-image';
import type { CameraOrientation, Photo } from 'react-native-vision-camera';

/** Target upload size for face APIs (~35–40 KB, keeps 520–600px faces sharp). */
const TARGET_MAX_BYTES = 40 * 1024;
const MAX_EDGE_PX = 600;
const FALLBACK_MAX_EDGE_PX = 520;
const START_JPEG_QUALITY = 84;
const MIN_JPEG_QUALITY = 68;
const QUALITY_STEP = 4;

/** Matches Vision Camera Android `HybridPhoto.toImage()` (counterRotated). */
const COUNTER_ORIENTATION: Record<CameraOrientation, CameraOrientation> = {
  up: 'up',
  down: 'down',
  left: 'right',
  right: 'left',
};

const ORIENTATION_DEGREES: Record<CameraOrientation, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function resizeToMaxEdge(image: Image, maxEdge: number): Promise<Image> {
  const target = scaleToMaxEdge(image.width, image.height, maxEdge);
  if (target.width === image.width && target.height === image.height) {
    return image;
  }
  return image.resizeAsync(target.width, target.height);
}

async function jpegEncodedSize(image: Image, quality: number): Promise<number> {
  const encoded = await image.toEncodedImageDataAsync('jpg', quality);
  return encoded.buffer.byteLength;
}

async function pickJpegQualityForTarget(image: Image): Promise<number> {
  for (
    let quality = START_JPEG_QUALITY;
    quality >= MIN_JPEG_QUALITY;
    quality -= QUALITY_STEP
  ) {
    if ((await jpegEncodedSize(image, quality)) <= TARGET_MAX_BYTES) {
      return quality;
    }
  }
  return MIN_JPEG_QUALITY;
}

async function compressFaceImageForUpload(
  image: Image,
): Promise<{ image: Image; quality: number }> {
  let working = await resizeToMaxEdge(image, MAX_EDGE_PX);
  let quality = await pickJpegQualityForTarget(working);

  if ((await jpegEncodedSize(working, quality)) > TARGET_MAX_BYTES) {
    working = await resizeToMaxEdge(working, FALLBACK_MAX_EDGE_PX);
    quality = await pickJpegQualityForTarget(working);
  }

  return { image: working, quality };
}

/**
 * Ensures portrait face photos are upright in pixel data after `toImageAsync()`.
 * Some Android front-camera captures still arrive landscape when EXIF rotation
 * was not fully baked into the bitmap.
 */
async function normalizeFaceUploadImage(
  image: Image,
  captureOrientation: CameraOrientation,
): Promise<Image> {
  if (image.width <= image.height) {
    return image;
  }

  const degrees =
    ORIENTATION_DEGREES[COUNTER_ORIENTATION[captureOrientation]] || 90;
  return image.rotateAsync(degrees, false);
}

/**
 * Writes a captured photo to JPEG with orientation and mirroring baked into pixels,
 * then resizes and compresses for fast face upload (~40 KB, recognition-safe).
 * Avoids `Photo.saveToTemporaryFileAsync()`, which keeps rotation in EXIF and often
 * displays sideways on servers that ignore EXIF.
 */
export async function saveCameraPhotoForUpload(photo: Photo): Promise<string> {
  const captureOrientation = photo.orientation;
  const image = await photo.toImageAsync();
  photo.dispose();
  const oriented = await normalizeFaceUploadImage(image, captureOrientation);
  const { image: compressed, quality } =
    await compressFaceImageForUpload(oriented);
  return compressed.saveToTemporaryFileAsync('jpg', quality);
}
