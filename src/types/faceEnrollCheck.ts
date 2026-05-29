export type FaceEnrollCheckData = {
  employee_id: number;
  employee_name?: string;
  company_id?: number;
  /** Current API: match score (higher = closer match). */
  similarity?: number | null;
  threshold?: number | null;
  /** Legacy API fields (still accepted when present). */
  enrolled?: boolean;
  is_match?: boolean | null;
  distance?: number | null;
};

export type FaceEnrollCheckResponse = {
  success: boolean;
  message: string;
  data?: FaceEnrollCheckData;
};

export type CheckFaceEnrollPayload = {
  employee_id: number;
  image: string;
};
