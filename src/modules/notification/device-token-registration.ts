import { AppError } from '@utils/appError';
import logger from '@utils/logger';
import type { Roles } from '@modules/user/user.model';
import type { NotificationRole } from './notification.types';
import { registerDeviceToken } from './notification.service';

export interface DeviceTokenAuthInput {
  deviceToken?: string;
  platform?: 'ios' | 'android';
}

export interface ParsedDeviceToken {
  token: string;
  platform: 'ios' | 'android';
}

function hasNonEmptyToken(value: string | undefined): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function hasPlatform(value: string | undefined): boolean {
  return value !== undefined && value !== null && String(value).length > 0;
}

/** Reject requests that send only one of deviceToken / platform. */
export function assertDeviceTokenPayloadValid(input: DeviceTokenAuthInput): void {
  const tokenPresent = hasNonEmptyToken(input.deviceToken);
  const platformPresent = hasPlatform(input.platform);

  if (tokenPresent !== platformPresent) {
    throw AppError.badRequest(
      'deviceToken and platform must be sent together',
      'INVALID_DEVICE_TOKEN_PAYLOAD',
    );
  }

  if (platformPresent && input.platform !== 'ios' && input.platform !== 'android') {
    throw AppError.badRequest(
      'platform must be ios or android',
      'INVALID_DEVICE_TOKEN_PAYLOAD',
    );
  }
}

export function parseDeviceTokenInput(input: DeviceTokenAuthInput): ParsedDeviceToken | null {
  if (!hasNonEmptyToken(input.deviceToken) || !hasPlatform(input.platform)) {
    return null;
  }

  if (input.platform !== 'ios' && input.platform !== 'android') {
    return null;
  }

  return {
    token: String(input.deviceToken).trim(),
    platform: input.platform,
  };
}

/** Persist FCM token after login; never throws on storage failures. */
export async function registerDeviceTokenFromAuth(
  userId: string,
  role: NotificationRole | Roles,
  input: DeviceTokenAuthInput,
): Promise<void> {
  const parsed = parseDeviceTokenInput(input);
  if (!parsed) return;

  try {
    await registerDeviceToken(userId, role as NotificationRole, parsed.token, parsed.platform);
  } catch (err) {
    logger.error({ err, userId, role }, 'Failed to register device token during auth');
  }
}
