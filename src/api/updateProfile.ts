import axios from 'axios';

import { authHttpClient } from '@src/api/authHttpClient';
import { readApiError } from '@src/utils/readApiError';

/** JSON body for PUT `/users/update-profile` — include only fields being changed. */
export type UpdateProfileRequestBody = {
  name?: string;
  phone?: string;
  profile_picture?: string | null;
};

/** `data` object on 200 success (booleans coerced server-side). */
export type UserProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  profile_picture: string | null;
  is_active: boolean;
  is_system_admin: boolean;
  auth_provider: string;
  last_login: string;
  created_at: string;
  created_by: number;
  updated_at: string;
  updated_by: number;
};

export type UpdateProfileSuccessResponse = {
  success: true;
  message: string;
  data: UserProfile;
};

export type UpdateProfileErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

export class UpdateProfileError extends Error {
  readonly status: number;
  readonly isDuplicatePhone: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UpdateProfileError';
    this.status = status;
    this.isDuplicatePhone = status === 409;
  }
}

function mapHttpError(status: number | undefined, bodyMsg: string): string {
  switch (status) {
    case 400:
      return bodyMsg.trim() || 'Invalid request.';
    case 401:
      return bodyMsg.trim() || 'Unauthorized. Please sign in again.';
    case 404:
      return 'User not found';
    case 409:
      return bodyMsg.trim() || 'Phone number already exists';
    case 500:
      return 'Failed to update user profile';
    default:
      return bodyMsg.trim() || 'Could not update profile.';
  }
}

function throwMappedAxiosError(e: unknown): never {
  if (!axios.isAxiosError(e)) {
    throw e;
  }
  const status = e.response?.status ?? 0;
  const bodyMsg = readApiError(e);
  throw new UpdateProfileError(status, mapHttpError(e.response?.status, bodyMsg));
}

/**
 * PUT `{API_ENDPOINT}/users/update-profile` — Bearer from {@link authHttpClient}.
 * Sends only provided fields; authenticated session determines the user.
 */
export async function updateProfile(body: UpdateProfileRequestBody): Promise<UserProfile> {
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new UpdateProfileError(400, 'No fields provided for update');
  }

  try {
    const { data } = await authHttpClient.put<UpdateProfileSuccessResponse | UpdateProfileErrorResponse>(
      '/users/update-profile',
      body,
      { maxBodyLength: Infinity },
    );


    if (data && typeof data === 'object' && data.success === true && 'data' in data && data.data != null) {
      return data.data as UserProfile;
    }

    const fail = data as UpdateProfileErrorResponse | undefined;
    const msg = fail?.message?.trim() || 'Could not update profile.';
    throw new UpdateProfileError(400, msg);
  } catch (e) {
    if (e instanceof UpdateProfileError) {
      throw e;
    }
    throwMappedAxiosError(e);
  }
}
