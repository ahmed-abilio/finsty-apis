import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError } from '@utils/appError';

const registerDeviceTokenMock = vi.fn();

vi.mock('./notification.service', () => ({
  registerDeviceToken: (...args: unknown[]) => registerDeviceTokenMock(...args),
}));

import {
  assertDeviceTokenPayloadValid,
  parseDeviceTokenInput,
  registerDeviceTokenFromAuth,
} from './device-token-registration';
import { Roles } from '@modules/user/user.model';

describe('assertDeviceTokenPayloadValid', () => {
  it('allows omitting both fields', () => {
    expect(() => assertDeviceTokenPayloadValid({})).not.toThrow();
  });

  it('rejects token without platform', () => {
    expect(() => assertDeviceTokenPayloadValid({ deviceToken: 'abc' })).toThrow(AppError);
    try {
      assertDeviceTokenPayloadValid({ deviceToken: 'abc' });
    } catch (e) {
      expect((e as AppError).code).toBe('INVALID_DEVICE_TOKEN_PAYLOAD');
    }
  });

  it('rejects platform without token', () => {
    expect(() => assertDeviceTokenPayloadValid({ platform: 'ios' })).toThrow(AppError);
  });

  it('accepts both fields', () => {
    expect(() =>
      assertDeviceTokenPayloadValid({ deviceToken: 'tok', platform: 'android' }),
    ).not.toThrow();
  });
});

describe('parseDeviceTokenInput', () => {
  it('returns null when both omitted', () => {
    expect(parseDeviceTokenInput({})).toBeNull();
  });

  it('returns null for whitespace-only token', () => {
    expect(parseDeviceTokenInput({ deviceToken: '   ', platform: 'ios' })).toBeNull();
  });

  it('parses valid pair', () => {
    expect(parseDeviceTokenInput({ deviceToken: '  fcm-tok  ', platform: 'ios' })).toEqual({
      token: 'fcm-tok',
      platform: 'ios',
    });
  });
});

describe('registerDeviceTokenFromAuth', () => {
  beforeEach(() => {
    registerDeviceTokenMock.mockReset();
    registerDeviceTokenMock.mockResolvedValue(undefined);
  });

  it('calls registerDeviceToken when input is valid', async () => {
    await registerDeviceTokenFromAuth('user-1', Roles.USER, {
      deviceToken: 'tok',
      platform: 'android',
    });
    expect(registerDeviceTokenMock).toHaveBeenCalledWith('user-1', Roles.USER, 'tok', 'android');
  });

  it('skips when no token provided', async () => {
    await registerDeviceTokenFromAuth('user-1', Roles.USER, {});
    expect(registerDeviceTokenMock).not.toHaveBeenCalled();
  });

  it('does not throw when registerDeviceToken fails', async () => {
    registerDeviceTokenMock.mockRejectedValue(new Error('db down'));
    await expect(
      registerDeviceTokenFromAuth('user-1', Roles.USER, {
        deviceToken: 'tok',
        platform: 'ios',
      }),
    ).resolves.toBeUndefined();
  });
});
