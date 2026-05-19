/** `data.user` from GET `/users/profile-role` (stored locally as JSON). */
export type ProfileRoleUser = {
  id?: number;
  email?: string;
  phone?: string;
  name?: string;
  is_active?: boolean;
  is_system_admin?: boolean;
  profile_picture?: string | null;
  [key: string]: unknown;
};
