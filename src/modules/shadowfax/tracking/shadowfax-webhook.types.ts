export interface ShadowfaxWebhookPayload {
  client_order_id?: string;
  order_status?: string;
  status?: string;
  sfx_order_id?: number | string;
  order_id?: number | string;
  sfxOrderId?: number | string;
  event_time?: string;
  updated_at?: string;
  timestamp?: string;
  delivery_time?: string;
  cancel_time?: string;
  rts_time?: string;
  cancel_reason?: string;
  cancel_reason_text?: string;
  reason?: string;
  reason_text?: string;
  drop_image_url?: string;
  rider_id?: number | string;
  rider_name?: string;
  rider_phone?: string;
  rider_details?: {
    rider_name?: string;
    rider_phone?: string;
    rider_id?: number | string;
  };
  order_details?: {
    client_order_id?: string;
    delivery_time?: string;
  };
  [key: string]: unknown;
}

export interface ShadowfaxRiderLocationPayload {
  client_order_id: string;
  latitude: number | string;
  longitude: number | string;
  timestamp?: string;
  pickup_eta?: number;
  drop_eta?: number;
  sfx_order_id?: number | string;
}

export type OrderStatusSource =
  | 'shadowfax_webhook'
  | 'shadowfax_reconciliation'
  | 'shadowfax_dev_local_callback'
  | 'vendor'
  | 'admin'
  | 'system';

export interface OrderStatusChangedEvent {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}
