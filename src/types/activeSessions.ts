export type ActiveSessionLocation = {
  latitude: string | null;
  longitude: string | null;
};

export type ActiveSession = {
  id: number;
  device_name: string;
  ip_address: string;
  location: ActiveSessionLocation;
  user_agent: string;
  is_current: boolean;
  last_active: string;
  expires_at: string;
  login_at: string;
};

export type ActiveSessionsMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  is_last_page: boolean;
};

export type ActiveSessionsResponse = {
  success: boolean;
  message: string;
  sessions: ActiveSession[];
  meta: ActiveSessionsMeta;
};
