import PlatformSetting from './platform-setting.model';

export const SHADOWFAX_DEV_LOCAL_CALLBACK_ENABLED_KEY = 'shadowfax_dev_local_callback_enabled';
export const SHADOWFAX_DEV_LOCAL_CALLBACK_BASE_URL_KEY = 'shadowfax_dev_local_callback_base_url';

export async function getPlatformSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await PlatformSetting.findByPk(key);
  if (!row) return fallback;
  return row.value as T;
}

export async function setPlatformSetting(key: string, value: unknown): Promise<void> {
  const row = await PlatformSetting.findByPk(key);
  if (row) {
    await row.update({ value });
    return;
  }
  await PlatformSetting.create({ key, value });
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
