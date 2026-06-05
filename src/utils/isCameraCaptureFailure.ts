import { readApiError } from '@src/utils/readApiError';

const CAMERA_CAPTURE_FAILURE =
  /abortRequests|Camera is closed|ImageCaptureException|ImageCapture/i;

export function isCameraCaptureFailureMessage(message: string): boolean {
  return CAMERA_CAPTURE_FAILURE.test(message);
}

export function isCameraCaptureFailure(err: unknown): boolean {
  return isCameraCaptureFailureMessage(readApiError(err));
}
