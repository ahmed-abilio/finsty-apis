import PlatformSetting from './platform-setting.model';
import { AppError } from '@utils/appError';

export const SHADOWFAX_DEV_LOCAL_CALLBACK_ENABLED_KEY = 'shadowfax_dev_local_callback_enabled';
export const SHADOWFAX_DEV_LOCAL_CALLBACK_BASE_URL_KEY = 'shadowfax_dev_local_callback_base_url';

export const TAX_RATE_KEY = 'tax_rate';
export const PLATFORM_FEE_KEY = 'platform_fee';
export const GEOFENCE_RADIUS_KM_KEY = 'geofence_radius_km';
export const REFERRAL_REWARD_AMOUNT_KEY = 'referral_reward_amount';
export const YOUTUBE_URL_KEY = 'youtube_url';

export interface AppConfig {
  taxRate: number;
  platformFee: number;
  geofenceRadiusKm: number;
  referralRewardAmount: number;
  youtubeUrl: string;
}

export interface AppConfigUpdateInput {
  taxRate?: number;
  platformFee?: number;
  geofenceRadiusKm?: number;
  referralRewardAmount?: number;
  youtubeUrl?: string;
}

const APP_CONFIG_DESCRIPTIONS: Record<keyof AppConfig, string> = {
  taxRate: 'GST / tax rate on merchandise subtotal (e.g. 0.18 = 18%).',
  platformFee: 'Fixed platform fee per order in INR.',
  geofenceRadiusKm: 'Default store search / geofence radius in kilometres.',
  referralRewardAmount: 'Wallet credit (INR) for referrer and referred user on first delivered order.',
  youtubeUrl: 'Public YouTube / help video URL shown in apps.',
};

const DEFAULTS: AppConfig = {
  taxRate: 0.18,
  platformFee: 0,
  geofenceRadiusKm: 10,
  referralRewardAmount: 100,
  youtubeUrl: '',
};

let appConfigCache: AppConfig | null = null;

function envNumber(name: string, fallback: number): number {
  const n = parseFloat(String(process.env[name] ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function envString(name: string, fallback: string): string {
  const v = process.env[name];
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
}

function envFallbackConfig(): AppConfig {
  return {
    taxRate: envNumber('TAX_RATE', DEFAULTS.taxRate),
    platformFee: envNumber('PLATFORM_FEE', DEFAULTS.platformFee),
    geofenceRadiusKm: envNumber('GEOFENCE_RADIUS_KM', DEFAULTS.geofenceRadiusKm),
    referralRewardAmount: envNumber('REFERRAL_REWARD_AMOUNT', DEFAULTS.referralRewardAmount),
    youtubeUrl: envString('YOUTUBE_URL', DEFAULTS.youtubeUrl),
  };
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function coerceString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export async function getPlatformSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await PlatformSetting.findByPk(key);
  if (!row) return fallback;
  return row.value as T;
}

export async function setPlatformSetting(key: string, value: unknown, description?: string): Promise<void> {
  const row = await PlatformSetting.findByPk(key);
  if (row) {
    await row.update({
      value,
      ...(description !== undefined ? { description } : {}),
    });
    return;
  }
  await PlatformSetting.create({
    key,
    value,
    description: description ?? null,
  });
}

export function invalidateAppConfigCache(): void {
  appConfigCache = null;
}

export async function getAppConfig(): Promise<AppConfig> {
  if (appConfigCache) return appConfigCache;

  const fallback = envFallbackConfig();
  const [taxRate, platformFee, geofenceRadiusKm, referralRewardAmount, youtubeUrl] =
    await Promise.all([
      getPlatformSetting<unknown>(TAX_RATE_KEY, fallback.taxRate),
      getPlatformSetting<unknown>(PLATFORM_FEE_KEY, fallback.platformFee),
      getPlatformSetting<unknown>(GEOFENCE_RADIUS_KM_KEY, fallback.geofenceRadiusKm),
      getPlatformSetting<unknown>(REFERRAL_REWARD_AMOUNT_KEY, fallback.referralRewardAmount),
      getPlatformSetting<unknown>(YOUTUBE_URL_KEY, fallback.youtubeUrl),
    ]);

  appConfigCache = {
    taxRate: coerceNumber(taxRate, fallback.taxRate),
    platformFee: parseFloat(coerceNumber(platformFee, fallback.platformFee).toFixed(2)),
    geofenceRadiusKm: coerceNumber(geofenceRadiusKm, fallback.geofenceRadiusKm),
    referralRewardAmount: parseFloat(
      coerceNumber(referralRewardAmount, fallback.referralRewardAmount).toFixed(2),
    ),
    youtubeUrl: coerceString(youtubeUrl, fallback.youtubeUrl),
  };

  return appConfigCache;
}

/** Sync read for user JSON serialization — uses cache, else env fallback. */
export function getReferralRewardAmountSync(): number {
  if (appConfigCache) return appConfigCache.referralRewardAmount;
  return envFallbackConfig().referralRewardAmount;
}

export async function getTaxRate(): Promise<number> {
  const cfg = await getAppConfig();
  return cfg.taxRate >= 0 ? cfg.taxRate : DEFAULTS.taxRate;
}

export async function getPlatformFee(): Promise<number> {
  const cfg = await getAppConfig();
  return cfg.platformFee >= 0 ? cfg.platformFee : 0;
}

export async function getGeofenceRadiusKm(): Promise<number> {
  const cfg = await getAppConfig();
  return cfg.geofenceRadiusKm > 0 ? cfg.geofenceRadiusKm : DEFAULTS.geofenceRadiusKm;
}

export async function getReferralRewardAmount(): Promise<number> {
  const cfg = await getAppConfig();
  return cfg.referralRewardAmount >= 0 ? cfg.referralRewardAmount : DEFAULTS.referralRewardAmount;
}

export async function getYoutubeUrl(): Promise<string> {
  const cfg = await getAppConfig();
  return cfg.youtubeUrl;
}

export async function computeTaxOnSubtotal(subtotal: number): Promise<number> {
  const rate = await getTaxRate();
  return parseFloat((subtotal * rate).toFixed(2));
}

export function getAppConfigWithMeta(config: AppConfig) {
  return {
    ...config,
    descriptions: APP_CONFIG_DESCRIPTIONS,
  };
}

export async function getPublicAppConfig(): Promise<{
  youtubeUrl: string;
  referralRewardAmount: number;
  geofenceRadiusKm: number;
}> {
  const cfg = await getAppConfig();
  return {
    youtubeUrl: cfg.youtubeUrl,
    referralRewardAmount: cfg.referralRewardAmount,
    geofenceRadiusKm: cfg.geofenceRadiusKm,
  };
}

function assertValidPartial(input: AppConfigUpdateInput): void {
  if (input.taxRate !== undefined) {
    if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 1) {
      throw AppError.badRequest(
        'taxRate must be a number between 0 and 1 (e.g. 0.18 for 18%)',
        'INVALID_TAX_RATE',
      );
    }
  }
  if (input.platformFee !== undefined) {
    if (!Number.isFinite(input.platformFee) || input.platformFee < 0) {
      throw AppError.badRequest('platformFee must be a non-negative number', 'INVALID_PLATFORM_FEE');
    }
  }
  if (input.geofenceRadiusKm !== undefined) {
    if (!Number.isFinite(input.geofenceRadiusKm) || input.geofenceRadiusKm <= 0) {
      throw AppError.badRequest(
        'geofenceRadiusKm must be a number greater than 0',
        'INVALID_GEOFENCE_RADIUS',
      );
    }
  }
  if (input.referralRewardAmount !== undefined) {
    if (!Number.isFinite(input.referralRewardAmount) || input.referralRewardAmount < 0) {
      throw AppError.badRequest(
        'referralRewardAmount must be a non-negative number',
        'INVALID_REFERRAL_AMOUNT',
      );
    }
  }
  if (input.youtubeUrl !== undefined) {
    const url = input.youtubeUrl.trim();
    if (url.length > 0) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('bad protocol');
        }
      } catch {
        throw AppError.badRequest(
          'youtubeUrl must be empty or a valid http(s) URL',
          'INVALID_YOUTUBE_URL',
        );
      }
    }
  }
}

export async function updateAppConfig(input: AppConfigUpdateInput): Promise<AppConfig> {
  assertValidPartial(input);

  if (input.taxRate !== undefined) {
    await setPlatformSetting(TAX_RATE_KEY, input.taxRate, APP_CONFIG_DESCRIPTIONS.taxRate);
  }
  if (input.platformFee !== undefined) {
    await setPlatformSetting(
      PLATFORM_FEE_KEY,
      parseFloat(input.platformFee.toFixed(2)),
      APP_CONFIG_DESCRIPTIONS.platformFee,
    );
  }
  if (input.geofenceRadiusKm !== undefined) {
    await setPlatformSetting(
      GEOFENCE_RADIUS_KM_KEY,
      input.geofenceRadiusKm,
      APP_CONFIG_DESCRIPTIONS.geofenceRadiusKm,
    );
  }
  if (input.referralRewardAmount !== undefined) {
    await setPlatformSetting(
      REFERRAL_REWARD_AMOUNT_KEY,
      parseFloat(input.referralRewardAmount.toFixed(2)),
      APP_CONFIG_DESCRIPTIONS.referralRewardAmount,
    );
  }
  if (input.youtubeUrl !== undefined) {
    await setPlatformSetting(
      YOUTUBE_URL_KEY,
      input.youtubeUrl.trim(),
      APP_CONFIG_DESCRIPTIONS.youtubeUrl,
    );
  }

  invalidateAppConfigCache();
  return getAppConfig();
}

export async function isShadowfaxDevLocalCallbackEnabled(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') return false;
  const enabled = await getPlatformSetting<boolean>(SHADOWFAX_DEV_LOCAL_CALLBACK_ENABLED_KEY, false);
  return enabled === true;
}

export async function getShadowfaxDevLocalCallbackBaseUrl(): Promise<string> {
  const port = process.env.PORT ?? '3001';
  return getPlatformSetting<string>(
    SHADOWFAX_DEV_LOCAL_CALLBACK_BASE_URL_KEY,
    `http://localhost:${port}`,
  );
}

export async function getShadowfaxDevLocalCallbackConfig(): Promise<{
  enabled: boolean;
  baseUrl: string;
  webhookUrl: string;
  developmentOnly: true;
}> {
  const enabled = await isShadowfaxDevLocalCallbackEnabled();
  const baseUrl = (await getShadowfaxDevLocalCallbackBaseUrl()).replace(/\/$/, '');
  return {
    enabled,
    baseUrl,
    webhookUrl: `${baseUrl}/api/webhooks/shadowfax`,
    developmentOnly: true,
  };
}

export async function updateShadowfaxDevLocalCallbackConfig(input: {
  enabled?: boolean;
  baseUrl?: string;
}): Promise<ReturnType<typeof getShadowfaxDevLocalCallbackConfig>> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('SHADOWFAX_DEV_LOCAL_CALLBACK_FORBIDDEN_OUTSIDE_DEVELOPMENT');
  }

  if (input.enabled !== undefined) {
    await setPlatformSetting(SHADOWFAX_DEV_LOCAL_CALLBACK_ENABLED_KEY, input.enabled);
  }

  if (input.baseUrl !== undefined) {
    const trimmed = input.baseUrl.trim().replace(/\/$/, '');
    await setPlatformSetting(SHADOWFAX_DEV_LOCAL_CALLBACK_BASE_URL_KEY, trimmed);
  }

  return getShadowfaxDevLocalCallbackConfig();
}
