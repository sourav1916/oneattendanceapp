export type SetFaceEnrollPayload = {
  employee_id: number;
  embedding: number[];
};

export type SetFaceEnrollResponse = {
  success: boolean;
  message: string;
  data?: {
    employee_id: number;
    face_enrolled: boolean;
  };
};
