import { NativeModules } from 'react-native';

type FaceEmbeddingNativeModule = {
  generateEmbedding(path: string): Promise<number[]>;
};

export const FACE_EMBEDDING_DIMENSION = 512;

const nativeModule = (NativeModules as Record<string, unknown>)
  .OneAttendanceFaceEmbedding as FaceEmbeddingNativeModule | undefined;

/**
 * The embedding is generated on-device by the native FaceNet/TFLite module.
 * Keeping this behind one adapter makes enrollment and attendance use exactly
 * the same preprocessing and model.
 */
export async function generateFaceEmbedding(path: string): Promise<number[]> {
  if (!nativeModule?.generateEmbedding) {
    throw new Error(
      'Face embedding is unavailable in this app binary. Rebuild the Android app after enabling the OneAttendanceFaceEmbedding native module.',
    );
  }
  const embedding = await nativeModule.generateEmbedding(path);
  if (
    !Array.isArray(embedding) ||
    embedding.length !== FACE_EMBEDDING_DIMENSION ||
    embedding.some(value => !Number.isFinite(Number(value)))
  ) {
    throw new Error(
      `The device returned an invalid face embedding (expected ${FACE_EMBEDDING_DIMENSION} values).`,
    );
  }
  const numeric = embedding.map(Number);
  const norm = Math.sqrt(numeric.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) {
    throw new Error('The device returned an invalid face embedding norm.');
  }
  return numeric.map(value => value / norm);
}
