export interface ShadowfaxPlaceOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ShadowfaxLocationDetails {
  name: string;
  contact_number: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
}

export interface ShadowfaxPlaceOrderRequest {
  client_code: string;
  order_details: {
    /** Merchant reference — required by HL marketplace API (use Finsty order id). */
    client_order_id: string;
    /** Declared merchandise value; should match sum of order item line totals. */
    order_value: number;
    paid: boolean;
    rain_flag: boolean;
    /** `YYYY-MM-DD HH:mm:ss` — required by HL marketplace place-order API. */
    scheduled_time: string;
    pickup_otp?: string;
    return_otp?: string;
  };
  pickup_details: ShadowfaxLocationDetails;
  drop_details: ShadowfaxLocationDetails & { delivery_otp?: string };
  order_items: ShadowfaxPlaceOrderItem[];
  has_tip?: boolean;
  tip_amount?: number;
}

export interface ParsedPlaceOrderResponse {
  shadowfaxOrderId: string | null;
  trackUrl: string | null;
  deliveryCost: number | null;
}
