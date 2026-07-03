import { AppError } from '@utils/appError';
import logger from '@utils/logger';
import {
  getCancelOrderUrl,
  getDispatchReadyUrl,
  getOrderServiceabilityUrl,
  getOrderStatusUrl,
  getPlaceOrderUrl,
  getShadowfaxClientCode,
  getShadowfaxConfig,
  getShadowfaxRequestTimeoutMs,
} from './shadowfax.config';
import type { ShadowfaxCancelOrderRequest } from './shadowfaxCancel.types';
import type { ShadowfaxDispatchReadyRequest } from './shadowfaxDispatchReady.types';
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

interface ParsedResponse {
  /** Parsed JSON body, or `undefined` when the body was empty or not valid JSON. */
  json: unknown;
  /** Raw response text (empty string when no body). */
  raw: string;
  /** True when a non-empty body was present but could not be parsed as JSON. */
  nonJson: boolean;
}

async function parseResponseBody(response: Response): Promise<ParsedResponse> {
  const raw = await response.text();
  if (!raw) {
    return { json: null, raw: '', nonJson: false };
  }

  try {
    return { json: JSON.parse(raw) as unknown, raw, nonJson: false };
  } catch {
    return { json: undefined, raw, nonJson: true };
  }
}

/** Truncated, single-line snippet of a raw body for safe logging/error messages. */
function bodySnippet(raw: string, max = 300): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, max);
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
      logger.error({ method, url }, 'shadowfax_request_timed_out');
      throw AppError.internal('Shadowfax request timed out', 'SHADOWFAX_UNAVAILABLE');
    }
    logger.error({ method, url, err }, 'shadowfax_request_failed');
    throw AppError.internal('Unable to reach Shadowfax', 'SHADOWFAX_UNAVAILABLE');
  }

  const { json, raw, nonJson } = await parseResponseBody(response);

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const message = extractErrorMessage(json) ?? (bodySnippet(raw) || errorFallback);
    const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    logger.error(
      {
        method,
        url,
        status: response.status,
        contentType,
        body: bodySnippet(raw),
      },
      'shadowfax_upstream_error',
    );
    throw new AppError(message, statusCode, 'SHADOWFAX_UPSTREAM_ERROR', {
      upstreamStatus: response.status,
    });
  }

  if (nonJson) {
    const contentType = response.headers.get('content-type');
    logger.error(
      {
        method,
        url,
        status: response.status,
        contentType,
        body: bodySnippet(raw),
      },
      'shadowfax_non_json_response',
    );
    throw AppError.internal(
      `Shadowfax returned a non-JSON response (status ${response.status})`,
      'SHADOWFAX_UNAVAILABLE',
    );
  }

  return json;
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

  async cancelOrder(
    shadowfaxOrderId: string,
    body: ShadowfaxCancelOrderRequest,
  ): Promise<unknown> {
    return requestJson(
      'PUT',
      getCancelOrderUrl(shadowfaxOrderId),
      body,
      'Shadowfax order cancel failed',
      { client_code: getShadowfaxClientCode() },
    );
  }

  async markDispatchReady(
    clientOrderId: string,
    body: ShadowfaxDispatchReadyRequest,
  ): Promise<unknown> {
    return requestJson(
      'PUT',
      getDispatchReadyUrl(clientOrderId),
      body,
      'Shadowfax dispatch-ready failed',
      { client_code: getShadowfaxClientCode() },
    );
  }
}

export default new ShadowfaxClient();
