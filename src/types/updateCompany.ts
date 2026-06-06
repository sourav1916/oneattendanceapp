export type AttendanceMethod = 'manual' | 'gps' | 'ip';

export type UpdateCompanyPayload = {
  id: number;
  name?: string;
  legal_name?: string;
  logo_url?: string;
  is_active?: boolean;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  transaction_currency?: string;
  max_distance?: number;
  company_ips?: string[];
  clear_ips?: boolean;
  attendance_methods?: AttendanceMethod[];
};

export type UpdatedCompanyRecord = {
  id: number;
  owner_user_id: number;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  transaction_currency: string | null;
  max_distance: number | null;
  is_active: boolean;
  is_deleted: boolean;
  company_ips: string[] | null;
  attendance_methods: string[];
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
};

export type UpdateCompanyResponse = {
  success: boolean;
  message: string;
  data?: UpdatedCompanyRecord;
};
