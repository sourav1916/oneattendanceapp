import { normalizeActiveSessionsPayload } from '../src/api/fetchActiveSessions';

test('normalizes the live active sessions payload', () => {
  const payload = {
    success: true,
    message: 'Active sessions fetched successfully',
    data: [{
      id: 29,
      device_name: 'Chrome 152.0 on Windows',
      ip_address: '2401:4900:7758:6b3d:cc5a:15e7:2d7d:7087',
      location: { latitude: null, longitude: null },
      is_current: true,
      last_active: '2026-09-08 17:33:38',
      expires_at: '2026-10-04 15:08:36',
      login_at: '2026-09-04 15:08:35',
    }],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      total_pages: 1,
      is_last_page: true,
    },
  };

  const normalized = normalizeActiveSessionsPayload(payload as any);
  expect(normalized.sessions).toHaveLength(1);
  expect(normalized.sessions[0].id).toBe(29);
  expect(normalized.meta.total).toBe(1);
});