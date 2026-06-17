export interface ShadowfaxRiderLocation {
  longitude: string;
  latitude: string;
}

export interface ShadowfaxRiderDetails {
  rider_name: string;
  rider_location: ShadowfaxRiderLocation;
  rider_phone: string;
}

export interface ShadowfaxOrderStatusDetails {
  order_value: number;
  scheduled_time: string;
  paid: string;
  preparation_time: number;
  client_order_id: string;
  pickup_eta: number | null;
  drop_eta: number | null;
  allot_time: string | null;
  arrival_time: string | null;
  dispatch_time: string | null;
  delivery_time: string | null;
  vehicle_number: string | null;
  order_date: string;
}

export interface ShadowfaxLocationSummary {
  latitude: number;
  longitude: number;
  city: string;
  name: string;
  address: string;
}

export interface ShadowfaxPickupDetails extends ShadowfaxLocationSummary {
  contact_number: string;
}

export interface ShadowfaxOrderStatusItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  weight: number | null;
  category: string | null;
  unit_price: number;
}

/** Inner `data` object from Shadowfax GET /orders/{id}/status/ */
export interface ShadowfaxOrderStatusData {
  client_code: string;
  status: string;
  rider_details?: ShadowfaxRiderDetails;
  sfx_order_id: number;
  order_details: ShadowfaxOrderStatusDetails;
  drop_details: ShadowfaxLocationSummary;
  order_items: ShadowfaxOrderStatusItem[];
  track_url: string | null;
  drop_image_url?: string | null;
  pickup_details: ShadowfaxPickupDetails;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Unwraps `{ message, data }` (or nested wrappers) to the status `data` object. */
export function parseShadowfaxOrderStatusResponse(payload: unknown): ShadowfaxOrderStatusData {
  let cur: unknown = payload;
  for (let depth = 0; depth < 4; depth++) {
    if (!isRecord(cur)) {
      throw new Error('Invalid Shadowfax order status response');
    }
    if (isRecord(cur.data) && ('status' in cur.data || 'sfx_order_id' in cur.data)) {
      return cur.data as unknown as ShadowfaxOrderStatusData;
    }
    if ('status' in cur && ('sfx_order_id' in cur || 'order_details' in cur)) {
      return cur as unknown as ShadowfaxOrderStatusData;
    }
    if ('data' in cur) {
      cur = cur.data;
      continue;
    }
    break;
  }
  throw new Error('Invalid Shadowfax order status response');
}
