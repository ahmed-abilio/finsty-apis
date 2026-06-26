# Shadowfax delivery — mobile app integration guide

This document explains how to integrate **Finsty delivery (Shadowfax)** in the Flutter/mobile app. The mobile client **never** calls Shadowfax APIs directly. All logistics run server-side; the app talks only to **Finsty APIs** (`/api/v1/...`).

**Base URL:** `{API_HOST}/api/v1` (default prefix from `API_PREFIX` in backend `.env`)

**Auth:** All endpoints below require `Authorization: Bearer <access_token>` unless noted.

**Swagger:** When the API is running locally, open `/docs` for live schemas and try-it-out.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Implementation steps](#3-implementation-steps)
4. [API reference (endpoints)](#4-api-reference-endpoints)
5. [Order status & timeline](#5-order-status--timeline)
6. [Shadowfax ↔ Finsty status mapping](#6-shadowfax--finsty-status-mapping)
7. [Push notifications](#7-push-notifications)
8. [Error codes to handle](#8-error-codes-to-handle)
9. [Flutter implementation checklist](#9-flutter-implementation-checklist)
10. [Testing & troubleshooting](#10-testing--troubleshooting)

---

## 1. Architecture overview

```
┌─────────────┐     JWT REST      ┌──────────────┐     Shadowfax API     ┌────────────┐
│ Mobile app  │ ────────────────► │  Finsty API  │ ────────────────────► │ Shadowfax  │
│  (Flutter)  │ ◄──────────────── │   (backend)  │ ◄──────────────────── │  (courier) │
└─────────────┘   order + track   └──────────────┘      webhooks          └────────────┘
                                         │
                                         ▼
                                   BullMQ workers
                                   (place order, process webhooks,
                                    reconciliation)
```

**What the backend does automatically (mobile does not implement):**

| Step | When | Backend action |
|------|------|----------------|
| Serviceability / fee | Checkout quote, order create, payment initiate | Calls Shadowfax serviceability with store pickup + user drop coordinates |
| Place delivery order | After payment confirms a **delivery** order (`status: confirmed`) | Enqueues Shadowfax placement job → `POST` Shadowfax v2 orders |
| Status updates | Shadowfax sends webhooks | Updates `orders.status`, rider fields, timestamps; sends FCM `ORDER_STATUS` |
| Reconciliation | Scheduled worker | Polls Shadowfax if webhook missed |

**Webhook URLs (server / DevOps only — not for mobile):**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/webhooks/shadowfax` | Order status callbacks from Shadowfax |
| `POST` | `/api/webhooks/shadowfax/rider-location` | Rider GPS updates from Shadowfax |

---

## 2. Prerequisites

### 2.1 Delivery address must have coordinates

Shadowfax needs lat/lng for the drop location. When creating or updating an address, send `latitude` and `longitude`.

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/v1/addresses` | Include `latitude`, `longitude` |
| `PATCH` | `/api/v1/addresses/:addressId` | Update coordinates if user moves pin on map |
| `GET` | `/api/v1/addresses` | List user addresses |

If coordinates are missing, checkout returns `ADDRESS_COORDINATES_REQUIRED`.

### 2.2 Single-store cart

Checkout only supports items from **one store**. Multi-store cart returns `MULTI_STORE_CHECKOUT`.

### 2.3 Delivery vs pickup

| `deliveryType` | Shadowfax used? | Tracking UI |
|----------------|-----------------|-------------|
| `delivery` | Yes | Full timeline + live map |
| `pickup` | No | Short timeline: `pending` → `confirmed` → `delivered` |

### 2.4 Order reference formats

Most order endpoints accept any of:

- Finsty UUID — e.g. `a1b2c3d4-e5f6-...`
- Public order code — e.g. `FIABC1234567X` (field `orderId` on order object)
- Shadowfax id — numeric `shadowfaxOrderId` (after placement)

---

## 3. Implementation steps

### Step 1 — Cart & delivery quote (pre-checkout)

**Goal:** Show delivery fee and whether the address is serviceable before payment.

1. User selects cart items from one store.
2. User picks or confirms delivery address (with lat/lng).
3. Call **`GET /cart/delivery-quote`** (optional `?addressId=`).
4. Display:
   - `quotedDeliveryCharge` — raw Shadowfax fee
   - `deliveryChargeApplied` — fee included in total (0 if coupon waives delivery)
   - `estimatedPayableTotal` — subtotal + tax + platform fee + applied delivery
   - `serviceable: false` → block checkout, show “Delivery not available to this address”

**Optional:** Call **`PUT /shadowfax/order-serviceability`** only if you need raw Shadowfax response (usually not needed; cart quote is enough).

---

### Step 2 — Create order (async)

**Goal:** Create the order record and reserve stock.

1. Call **`POST /orders`** with body:

```json
{
  "deliveryType": "delivery",
  "addressId": "<uuid>",
  "deliveryCharge": 49,
  "couponCodes": ["SAVE10"],
  "notes": "Ring the bell"
}
```

- `deliveryCharge` is optional but recommended: must match `deliveryChargeApplied` from the quote (sanity check).
- Omit `deliveryCharge` for `pickup` or when `FREE_DELIVERY` coupon applies.

2. Response **`202 Accepted`**:

```json
{
  "success": true,
  "data": {
    "jobId": "ord_abc123...",
    "message": "Order queued for processing"
  }
}
```

3. Poll **`GET /orders/status/:jobId`** every 1–2 seconds until `status` is `success` or `failed`.

| Job `status` | Action |
|--------------|--------|
| `queued` / `processing` | Keep polling |
| `success` | Read `orderId` (UUID), go to payment |
| `failed` | Show `failureCode` (e.g. `INSUFFICIENT_STOCK`, `DELIVERY_NOT_SERVICEABLE`) |

---

### Step 3 — Payment

**Goal:** Confirm order → triggers Shadowfax placement in background.

1. **`POST /payments/initiate`** with `{ "orderId": "<uuid>", "useWallet": false }`
   - Amount is always taken from server `Order.totalAmount` (do not compute client-side).
2. If Razorpay required, open checkout with returned `providerOrderId` / key from **`GET /payments/config`**.
3. After Razorpay success, call **`POST /payments/capture`** with Razorpay payment ids.
4. Alternative: **`POST /orders/:orderId/pay-wallet`** if user pays fully from wallet.

**After payment succeeds:**

- Order `status` becomes `confirmed`
- Backend enqueues Shadowfax placement (delivery orders only)
- User receives FCM `ORDER_PLACED` and `PAYMENT_SUCCESS`

**Important:** Shadowfax placement is async. For a few seconds `shadowfaxOrderId` may be `null`. Live tracking endpoints return `409 SHADOWFAX_ORDER_NOT_PLACED` until placement completes.

---

### Step 4 — Order detail screen

**Goal:** Show order summary and current lifecycle status.

Call **`GET /orders/:orderId`** (UUID, `FI…` code, or Shadowfax id).

Key fields for delivery UI:

| Field | Use |
|-------|-----|
| `status` | Timeline active step (Finsty internal status) |
| `deliveryType` | `delivery` vs `pickup` |
| `shadowfaxOrderId` | Present after Shadowfax placement |
| `shadowfaxTrackingUrl` | External tracking link (if available) |
| `riderName`, `riderPhone` | Cached on order after webhook updates |
| `deliveredAt`, `cancelledAt` | Terminal timestamps |
| `address` | Drop location |
| `items[].store` | Pickup store info |

Poll **`GET /orders/:orderId`** every 15–30s while order is in progress, or rely on push notifications (Step 6).

---

### Step 5 — Live delivery tracking (map + rider)

**Goal:** Rider location, ETAs, and Shadowfax tracking URL.

**Only for `deliveryType: delivery`** after Shadowfax placement.

Call **`GET /orders/:orderId/delivery-status`**

Recommended polling:

| Order phase | Interval |
|-------------|----------|
| `confirmed` (waiting for rider) | Every 10–15s (may 409 until placed) |
| `rider_assigned` … `out_for_delivery` | Every 5–10s |
| `delivered` / `cancelled` | Stop polling |

**Response `data` (Shadowfax live payload):**

```json
{
  "success": true,
  "data": {
    "status": "DISPATCHED",
    "sfx_order_id": 21042908,
    "track_url": "https://...",
    "rider_details": {
      "rider_name": "Raj",
      "rider_phone": "98XXXXXXXX",
      "rider_location": {
        "latitude": "12.9716",
        "longitude": "77.5946"
      }
    },
    "order_details": {
      "client_order_id": "FIABC1234567X",
      "pickup_eta": 12,
      "drop_eta": 25,
      "allot_time": "2026-06-17T10:00:00Z",
      "dispatch_time": "2026-06-17T10:15:00Z"
    },
    "pickup_details": { "latitude": 12.97, "longitude": 77.59, "address": "...", "name": "Store" },
    "drop_details": { "latitude": 12.98, "longitude": 77.60, "address": "...", "name": "Home" },
    "drop_image_url": null
  }
}
```

**UI suggestions:**

- Map: plot `pickup_details`, `drop_details`, and `rider_details.rider_location`
- “Call rider” button: `rider_details.rider_phone` or order-level `riderPhone`
- “Track in browser”: open `track_url` or `shadowfaxTrackingUrl` from order detail
- ETA labels: `order_details.pickup_eta`, `order_details.drop_eta` (minutes)

**Do not** call Shadowfax URLs from the app — credentials stay on the server.

---

### Step 6 — Order timeline UI

**Goal:** Stepper showing progress.

Use **`order.status`** from `GET /orders/:orderId` as the source of truth for the timeline.

**Delivery happy path (7 steps):**

```
pending → confirmed → rider_assigned → at_store → picked_up → out_for_delivery → delivered
```

**Terminal states:** `cancelled`, `returned` — replace stepper with status banner.

**Pickup path (shorter):**

```
pending → confirmed → delivered
```

See [Section 5](#5-order-status--timeline) for labels.

> **Note:** `order_status_history` is stored on the server but there is **no public GET API** yet for per-step timestamps. Until that endpoint exists, mark steps complete based on ordered status list + `updatedAt` / push notification times.

---

### Step 7 — Push notifications (real-time updates)

Register FCM token on login (see `src/modules/notification/README.md`).

| Type | When | Deep link |
|------|------|-----------|
| `ORDER_PLACED` | Payment confirmed | Order detail |
| `ORDER_STATUS` | Status changes (including Shadowfax webhooks) | Order detail / tracking |
| `PAYMENT_SUCCESS` | Razorpay captured | Order detail |
| `PAYMENT_FAILED` | Capture failed | Retry payment |
| `PAYMENT_CANCELLED` | User cancelled checkout | Cart |

`ORDER_STATUS` payload includes `data.orderId` and `data.status` (Finsty status string).

On notification tap → refresh `GET /orders/:orderId` and optionally `GET /orders/:orderId/delivery-status`.

**Inbox APIs:**

| Method | Path |
|--------|------|
| `GET` | `/notifications` |
| `GET` | `/notifications/unread-count` |
| `PATCH` | `/notifications/:notificationId/read` |
| `PATCH` | `/notifications/read-all` |

---

### Step 8 — Cancel order

**Goal:** User cancels before fulfillment.

**`PATCH /orders/:orderId/cancel`**

- Allowed only when `status` is `pending` or `confirmed`
- After rider assigned, cancellation may need support (not via this API)

---

## 4. API reference (endpoints)

### Addresses (prerequisite)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/addresses` | List addresses |
| `POST` | `/addresses` | Create with `latitude`, `longitude` |
| `PATCH` | `/addresses/:addressId` | Update including coordinates |
| `GET` | `/addresses/:addressId` | Get one |

---

### Cart & delivery quote

#### `GET /cart/delivery-quote`

Query: `addressId` (optional UUID; default = user default address)

**Response 200:**

```json
{
  "success": true,
  "data": {
    "deliveryQuote": {
      "addressId": "uuid",
      "serviceable": true,
      "quotedDeliveryCharge": 49,
      "deliveryChargeApplied": 49,
      "deliveryFeeWaived": false,
      "subtotal": 999,
      "taxAmount": 0,
      "platformFee": 5,
      "estimatedPayableTotal": 1053,
      "deliveryConfig": { "freeDeliveryRequiresCoupon": true }
    }
  }
}
```

**Errors:** `DEFAULT_ADDRESS_REQUIRED`, `ADDRESS_COORDINATES_REQUIRED`, `ADDRESS_NOT_FOUND`, `DELIVERY_NOT_SERVICEABLE`

---

### Shadowfax serviceability (advanced / optional)

#### `PUT /shadowfax/order-serviceability`

Proxies Shadowfax serviceability. Prefer `GET /cart/delivery-quote` for checkout.

**Body:**

```json
{
  "pickup_latitude": "12.9716",
  "pickup_longitude": "77.5946",
  "drop_latitude": "12.9352",
  "drop_longitude": "77.6245",
  "paid": "true",
  "order_value": "1053",
  "stage_of_check": "pre_order",
  "COID": "optional-client-order-id"
}
```

**Response 200:** `{ "success": true, "data": { ...raw Shadowfax... } }`

---

### Orders

#### `POST /orders`

Create order (async). See [Step 2](#step-2--create-order-async).

**Response:** `202` + `jobId`

---

#### `GET /orders/status/:jobId`

Poll async order creation.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job-token",
      "status": "success",
      "orderId": "uuid-when-success",
      "failureCode": null,
      "failureMessage": null
    }
  }
}
```

Job statuses: `queued`, `processing`, `success`, `failed`

---

#### `GET /orders`

List buyer orders (paginated).

Query: `page`, `limit`, `status` (optional filter)

---

#### `GET /orders/:orderId`

Full order detail. See [Step 4](#step-4--order-detail-screen).

---

#### `GET /orders/:orderId/delivery-status`

Live Shadowfax tracking. See [Step 5](#step-5--live-delivery-tracking-map--rider).

**Errors:**

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `DELIVERY_STATUS_NOT_APPLICABLE` | Pickup order |
| 404 | `ORDER_NOT_FOUND` | Wrong id or not your order |
| 409 | `SHADOWFAX_ORDER_NOT_PLACED` | Payment confirmed but Shadowfax not placed yet — retry |
| 502 | `SHADOWFAX_UNAVAILABLE` | Upstream Shadowfax error |

---

#### `PATCH /orders/:orderId/cancel`

Cancel pending/confirmed order.

---

#### `POST /orders/:orderId/pay-wallet`

Pay entire order from internal wallet.

---

### Payments

#### `GET /payments/config`

Razorpay public key and options for checkout SDK.

#### `POST /payments/initiate`

Start payment for order or wallet top-up.

```json
{ "orderId": "<uuid>", "useWallet": true }
```

#### `POST /payments/capture`

Complete Razorpay payment after SDK success.

#### `POST /payments/cancel-incomplete`

User dismissed Razorpay without paying.

---

### Config

#### `GET /config`

Public platform config (fees, delivery rules). Use with delivery quote for consistent totals.

---

## 5. Order status & timeline

### All Finsty order statuses (9)

| Status | UI label | Timeline order (delivery) |
|--------|----------|---------------------------|
| `pending` | Pending payment | 1 |
| `confirmed` | Confirmed | 2 |
| `rider_assigned` | Rider assigned | 3 |
| `at_store` | At store | 4 |
| `picked_up` | Picked up | 5 |
| `out_for_delivery` | Out for delivery | 6 |
| `delivered` | Delivered | 7 |
| `cancelled` | Cancelled | Terminal |
| `returned` | Returned | Terminal |

### Legacy names (may appear in old data / notifications)

| Legacy | Maps to |
|--------|---------|
| `processing` | `at_store` |
| `shipped` | `out_for_delivery` |

### Flutter timeline helper (example)

```dart
const deliveryTimeline = [
  'pending',
  'confirmed',
  'rider_assigned',
  'at_store',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

int activeIndex(String status) => deliveryTimeline.indexOf(status);

// completed: index < activeIndex
// active: index == activeIndex
// upcoming: index > activeIndex

if (status == 'cancelled' || status == 'returned') {
  // Show terminal UI, hide forward steps
}
```

---

## 6. Shadowfax ↔ Finsty status mapping

When calling **`GET /orders/:orderId/delivery-status`**, `data.status` is the **Shadowfax** string.  
When calling **`GET /orders/:orderId`**, `order.status` is the **Finsty** string.

| Shadowfax (`delivery-status`) | Finsty (`order.status`) |
|-------------------------------|-------------------------|
| `ALLOTTED` | `rider_assigned` |
| `ARRIVED` | `at_store` |
| `DISPATCHED` | `picked_up` |
| `ARRIVED_CUSTOMER_DOORSTEP` | `out_for_delivery` |
| `DELIVERED` | `delivered` |
| `CANCELLED` / `CANCELLED_BY_CUSTOMER` | `cancelled` |
| `RETURNED_TO_SELLER` | `returned` |

**Recommendation:** Build the timeline from **`order.status`**. Use **`delivery-status`** only for map, rider phone, ETAs, and `track_url`.

---

## 7. Push notifications

See full list: `src/modules/notification/README.md`

Minimum for delivery tracking:

1. Register `deviceToken` + `platform` on login (`POST /auth/verify-otp` body or `PUT /users/me/device-token`)
2. Handle `ORDER_STATUS` → refresh order + tracking screens
3. Handle `ORDER_PLACED` → navigate to order detail

Notification `data` fields for orders:

| Field | Description |
|-------|-------------|
| `type` | e.g. `ORDER_STATUS` |
| `orderId` | Finsty order UUID |
| `orderNumber` | Display id |
| `status` | New Finsty status (for `ORDER_STATUS`) |
| `click_action` | `FLUTTER_NOTIFICATION_CLICK` |

---

## 8. Error codes to handle

### Checkout & quote

| Code | User message suggestion |
|------|-------------------------|
| `ADDRESS_COORDINATES_REQUIRED` | Pin your address on the map |
| `DEFAULT_ADDRESS_REQUIRED` | Add a delivery address |
| `DELIVERY_NOT_SERVICEABLE` | Delivery unavailable to this location |
| `DELIVERY_CHARGE_MISMATCH` | Refresh checkout — delivery fee changed |
| `MULTI_STORE_CHECKOUT` | Checkout one store at a time |
| `INSUFFICIENT_STOCK` | Item out of stock |

### Payment

| Code | Action |
|------|--------|
| `AMOUNT_MISMATCH` | Re-fetch order/quote; use `error.details.suggestedAmount` |
| `ORDER_NOT_FOUND` | Return to orders list |

### Tracking

| Code | Action |
|------|--------|
| `SHADOWFAX_ORDER_NOT_PLACED` | Show “Assigning delivery partner…”; retry in 5s |
| `DELIVERY_STATUS_NOT_APPLICABLE` | Hide map for pickup orders |
| `SHADOWFAX_UNAVAILABLE` | Show cached order status; retry later |

---

## 9. Flutter implementation checklist

- [ ] **Address module:** capture lat/lng (Google Maps / Mapbox pin picker)
- [ ] **Checkout:** `GET /cart/delivery-quote` before showing pay button
- [ ] **Checkout:** pass `deliveryCharge` matching quote on `POST /orders`
- [ ] **Checkout:** poll `GET /orders/status/:jobId` until success/fail
- [ ] **Payment:** use `order.totalAmount` from server; never add delivery twice
- [ ] **Order detail:** show timeline from `order.status`
- [ ] **Tracking screen:** poll `GET /orders/:orderId/delivery-status` with backoff
- [ ] **Tracking screen:** handle `409` gracefully while Shadowfax placement runs
- [ ] **Map:** rider marker from `rider_details.rider_location`
- [ ] **Call rider / track URL:** from delivery-status or order fields
- [ ] **FCM:** register token; deep link on `ORDER_STATUS` / `ORDER_PLACED`
- [ ] **Pickup orders:** skip delivery-status; shorter timeline
- [ ] **Cancel:** only offer when status is `pending` or `confirmed`

### Suggested screen flow

```
Cart → Checkout (quote) → Create order (poll) → Payment → Order detail
                                                      ↓
                                            Track delivery (map)
                                                      ↓
                                              Delivered → Rate order
```

---

## 10. Testing & troubleshooting

### Local dev with ngrok

Shadowfax webhooks must reach a public URL. For local API on port 3001:

```bash
ngrok http 3001
```

Register with Shadowfax:

- Status: `https://<ngrok-host>/api/webhooks/shadowfax`
- Rider location: `https://<ngrok-host>/api/webhooks/shadowfax/rider-location`

Backend env (`.env`):

- `SHADOWFAX_API_KEY`, `SHADOWFAX_CLIENT_CODE`
- `SHADOWFAX_WEBHOOK_SECRET` + header `SHADOWFAX_WEBHOOK_HEADER_NAME` (default `x-shadowfax-secret`)

### Verify backend health

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health/shadowfax` | Shadowfax integration metrics |

### Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Delivery fee always fails | Address missing lat/lng | Update address with coordinates |
| `409` on delivery-status right after pay | Shadowfax placement in queue | Poll order until `shadowfaxOrderId` is set |
| Timeline stuck on `confirmed` | Webhooks not reaching server | Fix public URL + webhook secret |
| Status updates but no map | Only polling `GET /orders` | Also poll `delivery-status` for rider GPS |

### Swagger

Run API and open `{API_HOST}/docs` — filter tags **Orders**, **Cart**, **Shadowfax**, **Payments**.

---

## Related backend files

| Area | Path |
|------|------|
| Order routes | `src/modules/order/order.routes.ts` |
| Delivery status service | `src/modules/order/orderDeliveryStatus.service.ts` |
| Shadowfax placement | `src/modules/shadowfax/shadowfaxPlacement.service.ts` |
| Status mapper | `src/modules/shadowfax/tracking/shadowfax-status.mapper.ts` |
| Webhooks | `src/modules/shadowfax/tracking/shadowfax-webhook.routes.ts` |
| Delivery quote | `src/modules/delivery/deliveryQuote.service.ts` |
| Push notifications | `src/modules/notification/README.md` |

---

## Summary

| Mobile responsibility | Server responsibility |
|----------------------|------------------------|
| Address lat/lng | Shadowfax credentials |
| Delivery quote display | Serviceability API calls |
| Create order + pay | Place Shadowfax order after payment |
| Timeline from `order.status` | Webhook → status transitions |
| Poll `delivery-status` for map | Proxy Shadowfax status API |
| FCM handling | Send push on status change |

The mobile app integrates Shadowfax **indirectly** through ~10 Finsty REST endpoints. No Shadowfax SDK or API keys belong in the app bundle.
