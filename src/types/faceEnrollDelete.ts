export type DeleteFaceEnrollPayload = {
  employee_id: number;
};

export type DeleteFaceEnrollResponse = {
  success: boolean;
  message: string;
  data?: {
    employee_id: number;
    face_enrolled: boolean;
  };
};
