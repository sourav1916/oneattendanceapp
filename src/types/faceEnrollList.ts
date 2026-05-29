export type FaceEnrollListItem = {
  employee_id: number;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_picture: string | null;
  face_enrolled: boolean;
};

export type FaceEnrollListMeta = {
  total: number;
  page: number;
  limit: number;
  offset: number;
  total_pages: number;
  is_last_page?: boolean;
};

export type FaceEnrollListResponse = {
  success: boolean;
  message: string;
  data: FaceEnrollListItem[] | null;
  meta: FaceEnrollListMeta | null;
};
