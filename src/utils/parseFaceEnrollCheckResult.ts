import type {
  FaceEnrollCheckData,
  FaceEnrollCheckResponse,
} from '@src/types/faceEnrollCheck';

export type ParsedFaceCheckResult =
  | {
      kind: 'matched' | 'no_match';
      similarity: string;
      threshold: string;
    }
  | { kind: 'not_enrolled' }
  | { kind: 'unknown' };

const NOT_ENROLLED_MESSAGE_RE =
  /not enrolled|no valid enrolled|no enrolled face/i;
const MATCH_MESSAGE_RE = /\bmatched\b/i;
const NO_MATCH_MESSAGE_RE = /no match|not matched|did not match|face mismatch/i;

function formatScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(4);
}

function readSimilarity(data: FaceEnrollCheckData): number | null {
  if (typeof data.similarity === 'number' && Number.isFinite(data.similarity)) {
    return data.similarity;
  }
  if (typeof data.distance === 'number' && Number.isFinite(data.distance)) {
    return data.distance;
  }
  return null;
}

function readThreshold(data: FaceEnrollCheckData): number | null {
  if (typeof data.threshold === 'number' && Number.isFinite(data.threshold)) {
    return data.threshold;
  }
  return null;
}

function scoresFromData(data: FaceEnrollCheckData): {
  similarity: string;
  threshold: string;
} {
  return {
    similarity: formatScore(readSimilarity(data)),
    threshold: formatScore(readThreshold(data)),
  };
}

/** Interprets check API payloads (legacy + current similarity/message shape). */
export function parseFaceEnrollCheckResult(
  res: FaceEnrollCheckResponse,
): ParsedFaceCheckResult {
  const data = res.data;
  if (data == null) {
    return { kind: 'unknown' };
  }

  const message = res.message?.trim() ?? '';
  const scores = scoresFromData(data);

  if (data.enrolled === false || NOT_ENROLLED_MESSAGE_RE.test(message)) {
    return { kind: 'not_enrolled' };
  }

  if (data.is_match === true) {
    return { kind: 'matched', ...scores };
  }
  if (data.is_match === false) {
    return { kind: 'no_match', ...scores };
  }

  const similarity = readSimilarity(data);
  const threshold = readThreshold(data);
  if (similarity != null && threshold != null) {
    return {
      kind: similarity >= threshold ? 'matched' : 'no_match',
      ...scores,
    };
  }

  if (NO_MATCH_MESSAGE_RE.test(message)) {
    return { kind: 'no_match', ...scores };
  }
  if (MATCH_MESSAGE_RE.test(message) && res.success) {
    return { kind: 'matched', ...scores };
  }

  if (!res.success) {
    return { kind: 'unknown' };
  }

  return { kind: 'unknown' };
}
