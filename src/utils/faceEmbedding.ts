import { NativeModules } from 'react-native';

type FaceEmbeddingNativeModule = {
  generateEmbedding(path: string): Promise<number[]>;
};

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
      'Face embedding is unavailable. Install the OneAttendanceFaceEmbedding native module.',
    );
  }
  const embedding = await nativeModule.generateEmbedding(path);
  if (
    !Array.isArray(embedding) ||
    embedding.length < 8 ||
    embedding.some(value => !Number.isFinite(Number(value)))
  ) {
    throw new Error('The device returned an invalid face embedding.');
  }
  return embedding.map(Number);
}
