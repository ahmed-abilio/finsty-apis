import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

const mocks = vi.hoisted(() => ({
  redisMock: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
  userServiceMock: {
    findByPhone: vi.fn(),
    findByPhoneForRole: vi.fn(),
    upsertForRole: vi.fn(),
    findByFirebaseUid: vi.fn(),
    findByFirebaseUidForRole: vi.fn(),
    findByIdForRole: vi.fn(),
  },
  verifyIdTokenMock: vi.fn(),
  signMock: vi.fn(() => 'signed-token'),
  verifyMock: vi.fn(),
}));

vi.mock('@config/redis', () => ({ default: mocks.redisMock }));
vi.mock('@modules/user/user.service', () => ({ default: mocks.userServiceMock }));
vi.mock('@config/firebase', () => ({
  firebaseAuth: { verifyIdToken: mocks.verifyIdTokenMock },
}));
vi.mock('jsonwebtoken', () => ({
  sign: mocks.signMock,
  verify: mocks.verifyMock,
  default: { sign: mocks.signMock, verify: mocks.verifyMock },
}));

import { googleSignIn, verifyOtp } from './auth.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    role: 'user',
    provider: 'phone',
    isActive: true,
    update: vi.fn(),
    reload: vi.fn(),
    ...overrides,
  };
}

describe('auth.service role-table auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisMock.get.mockResolvedValue('1234');
    mocks.redisMock.del.mockResolvedValue(1);
  });

  it('authenticates existing admin from admin_users table', async () => {
    const admin = makeUser({ role: 'admin' });
    mocks.userServiceMock.findByPhoneForRole.mockResolvedValue(admin);

    const result = await verifyOtp('+911234567890', '1234', '1.1.1.1', null, 'admin');

    expect(mocks.userServiceMock.upsertForRole).not.toHaveBeenCalled();
    expect(result.isNew).toBe(false);
    expect(admin.update).toHaveBeenCalled();
  });

  it('rejects admin verify when phone is not in admin_users', async () => {
    mocks.userServiceMock.findByPhoneForRole.mockResolvedValue(null);

    await expect(verifyOtp('+911234567890', '1234', '1.1.1.1', null, 'admin')).rejects.toMatchObject({
      code: 'ADMIN_NOT_FOUND',
    });
    expect(mocks.userServiceMock.upsertForRole).not.toHaveBeenCalled();
  });

  it('authenticates existing vendor from vendor_users table', async () => {
    const vendor = makeUser({ role: 'vendor' });
    mocks.userServiceMock.findByPhoneForRole.mockResolvedValue(vendor);

    const result = await verifyOtp('+911234567890', '1234', '1.1.1.1', null, 'vendor');

    expect(mocks.userServiceMock.upsertForRole).not.toHaveBeenCalled();
    expect(result.isNew).toBe(false);
  });

  it('creates vendor on first verify when phone is not in vendor_users', async () => {
    const vendor = makeUser({ role: 'vendor' });
    mocks.userServiceMock.findByPhoneForRole.mockResolvedValue(null);
    mocks.userServiceMock.upsertForRole.mockResolvedValue([vendor, true]);

    const result = await verifyOtp('+911234567890', '1234', '1.1.1.1', null, 'vendor');

    expect(mocks.userServiceMock.upsertForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: '+911234567890',
        phone: '+911234567890',
        role: 'vendor',
        provider: 'phone',
        isActive: true,
      }),
    );
    expect(result.isNew).toBe(true);
  });

  it('blocks google sign-in for non-user role', async () => {
    mocks.verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-1',
      firebase: { sign_in_provider: 'google.com' },
    });

    await expect(
      googleSignIn('id-token', '1.1.1.1', null, 'admin'),
    ).rejects.toMatchObject({
      code: 'SOCIAL_AUTH_ROLE_NOT_ALLOWED',
    });
  });

  it('uses users table path for default google sign-in', async () => {
    const user = makeUser({ provider: 'google', role: 'user' });
    mocks.verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-1',
      email: 'u@example.com',
      phone_number: '+911234567890',
      firebase: { sign_in_provider: 'google.com' },
    });
    mocks.userServiceMock.findByFirebaseUid.mockResolvedValue(null);
    mocks.userServiceMock.findByFirebaseUidForRole.mockResolvedValue(null);
    mocks.userServiceMock.upsertForRole.mockResolvedValue([user, true]);

    const result = await googleSignIn('id-token', '1.1.1.1', null);

    expect(mocks.userServiceMock.upsertForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'firebase-1',
        role: 'user',
        provider: 'google',
      }),
    );
    expect(result.isNew).toBe(true);
  });
});

