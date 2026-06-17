import { AppError } from '@utils/appError';
import {
  getOrderServiceabilityUrl,
  getOrderStatusUrl,
  getPlaceOrderUrl,
  getShadowfaxClientCode,
  getShadowfaxConfig,
  getShadowfaxRequestTimeoutMs,
} from './shadowfax.config';
import type { ShadowfaxPlaceOrderRequest } from './shadowfaxPlaceOrder.types';

export interface OrderServiceabilityRequest {
  pickup_latitude: string;
  pickup_longitude: string;
  drop_latitude: string;
  drop_longitude: string;
  paid: string;
  order_value: string | number;
  COID?: string;
  stage_of_check?: string;
  rain_flag?: boolean;
  client_surge?: number;
}

interface ShadowfaxErrorBody {
  message?: string;
  detail?: string;
  error?: string;
}

function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const payload = body as ShadowfaxErrorBody;
  // HL API often puts the real validation reason in `error`, with a generic `message`.
  if (payload.error && payload.message && payload.error !== payload.message) {
    return `${payload.message}: ${payload.error}`;
  }
  return payload.error ?? payload.message ?? payload.detail;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw AppError.internal('Shadowfax returned a non-JSON response', 'SHADOWFAX_UNAVAILABLE');
  }
}

async function requestJson(
  method: 'GET' | 'PUT' | 'POST',
  url: string,
  body: unknown | undefined,
  errorFallback: string,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const { apiKey } = getShadowfaxConfig();

  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(getShadowfaxRequestTimeoutMs()),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw AppError.internal('Shadowfax request timed out', 'SHADOWFAX_UNAVAILABLE');
    }
    throw AppError.internal('Unable to reach Shadowfax', 'SHADOWFAX_UNAVAILABLE');
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(payload) ?? errorFallback;
    const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new AppError(message, statusCode, 'SHADOWFAX_UPSTREAM_ERROR');
  }

  return payload;
}

class ShadowfaxClient {
  async checkOrderServiceability(body: OrderServiceabilityRequest): Promise<unknown> {
    return requestJson(
      'PUT',
      getOrderServiceabilityUrl(),
      body,
      'Shadowfax order serviceability check failed',
    );
  }

  async placeOrder(body: ShadowfaxPlaceOrderRequest): Promise<unknown> {
    return requestJson('POST', getPlaceOrderUrl(), body, 'Shadowfax place order failed');
  }

  async getOrderStatus(shadowfaxOrderId: string): Promise<unknown> {
    return requestJson(
      'GET',
      getOrderStatusUrl(shadowfaxOrderId),
      undefined,
      'Shadowfax order status fetch failed',
      { client_code: getShadowfaxClientCode() },
    );
  }
}

export default new ShadowfaxClient();
