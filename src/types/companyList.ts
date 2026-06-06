export type CompanyListItem = {
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
  created_at: string;
  updated_at: string;
  is_active: boolean;
  company_ips: string[];
  attendance_methods: string[];
  transaction_currency: string | null;
  max_distance: number | null;
};

export type CompanyListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  is_last_page: boolean;
};

export type CompanyListResponse = {
  success: boolean;
  message: string;
  data: CompanyListItem[] | null;
  meta: CompanyListMeta | null;
};
