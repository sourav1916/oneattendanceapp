jest.mock('../src/api/authHttpClient', () => ({
  authHttpClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import { inviteApi } from '../src/api/inviteApi';
import { authHttpClient } from '../src/api/authHttpClient';

test('drops unsupported invite filters before sending the server request', async () => {
  const mockedGet = authHttpClient.get as jest.Mock;
  mockedGet.mockResolvedValue({ data: { success: true, data: [] } });

  await inviteApi.getMyInvites({ status: 'cancelled' });

  const [, requestConfig] = mockedGet.mock.calls[0];
  expect(requestConfig.params).not.toHaveProperty('status');
});

test('normalizes weekend strings and attendance method strings from the my-invites API response', async () => {
  const mockedGet = authHttpClient.get as jest.Mock;
  mockedGet.mockResolvedValue({
    data: {
      success: true,
      message: 'User invites fetched successfully',
      data: [
        {
          invite_id: '15',
          status: 'accepted',
          company: {
            name: 'kjl',
            logo_url: null,
            city: null,
            state: null,
            country: 'India',
          },
          invited_by: {
            name: 'Noneed',
            email: 'progtesting01@gmail.com',
            phone: null,
            profile_picture: null,
          },
          designation: null,
          employment_type: null,
          salary_type: null,
          shift_start: null,
          shift_end: null,
          break_minutes: null,
          grace_minutes: null,
          expires_at: '2026-09-16 19:52:42',
          created_at: '2026-09-09 19:52:42',
          weekends: ['saturday', 'sunday'],
          permissions: [],
          attendance_methods: ['manual'],
        },
      ],
      meta: { total: 1, total_pages: 1, page: 1, limit: 10, is_last_page: true },
    },
  });

  const result = await inviteApi.getMyInvites();

  expect(result.data?.[0].weekends).toEqual(['saturday', 'sunday']);
  expect(result.data?.[0].attendance_methods).toEqual(['manual']);
});
