# Push notifications (FCM)

Finsty APIs sends **Firebase Cloud Messaging (FCM)** push notifications to mobile apps. Delivery is asynchronous via BullMQ (`push-notifications` queue) so HTTP handlers are not blocked by FCM latency.

## Setup

| Item | Description |
|------|-------------|
| Credentials | `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` + `FIREBASE_PROJECT_ID` (see `.env.example`) |
| Device registration | On login (recommended) or `PUT /api/v1/users/me/device-token` |
| Rate-order delay | `NOTIFICATION_RATE_ORDER_DELAY_MS` (default `86400000` = 24 hours) |

### Register on login (recommended)

Include optional fields on auth success endpoints (`POST /auth/verify-otp`, `/auth/admin/verify-otp`, `/auth/vendor/verify-otp`, `/auth/google`, `/auth/apple`, `/auth/refresh`):

```json
{
  "phone": "+919876543210",
  "otp": "1234",
  "deviceToken": "<fcm-registration-token>",
  "platform": "android"
}
```

`deviceToken` and `platform` must be sent together. Role is taken from the authenticated user (JWT role on refresh).

### Register after login

`PUT /api/v1/users/me/device-token` with `{ "token": "<fcm-token>", "platform": "ios" | "android" }` when the FCM token rotates while the user is already logged in.

Android should use notification channel `finsty_default` (matches FCM payload).

## Architecture

```
API event → notifyUser / notifyVendor / notifyAdmin
         → BullMQ notificationQueue
         → notificationWorker → sendPushToUser → FCM
```

Message copy lives in `notification.messages.ts`. Payload shape (iOS/Android) is built in `fcmPayload.ts`.

Every notification `data` payload includes:

| Key | Value |
|-----|--------|
| `type` | Notification type constant (see tables below) |
| `click_action` | `FLUTTER_NOTIFICATION_CLICK` (Flutter deep-link pattern) |
| *(context)* | Extra string fields from the event (`orderId`, `amount`, etc.) |

`orderNumber` in copy is derived from the order UUID (first 8 hex chars, uppercase, no dashes).

---

## Customer notifications (`role: user`)

| Type | Title | Body (template) | When it is sent |
|------|-------|-----------------|-----------------|
| `LOGIN_SUCCESS` | Welcome back | You're signed in to Finsty. | Customer OTP verified (`auth.controller` → `verifyOtp`) |
| `ORDER_PLACED` | Order placed | Your order #{orderNumber} was placed successfully. | After payment confirms the order (`payment.service` capture / full wallet initiate; `order.service` → `payWithWallet`) |
| `ORDER_STATUS` | Order update | Your order #{orderNumber} is now {status}. | Vendor or admin changes order status (`order.service` → `updateVendorOrderStatus`, `updateStatus`); also `confirmed` after pay-with-wallet or Razorpay capture |
| `PAYMENT_SUCCESS` | Payment successful | ₹{amount} paid for order #{orderNumber}. | Razorpay payment captured for an order (`payment.service` → `capturePayment`) |
| `PAYMENT_FAILED` | Payment failed | We couldn't process your payment. Please try again. | Provider verification fails during capture (`payment.service`) |
| `PAYMENT_CANCELLED` | Payment cancelled | Payment for order #{orderNumber} was not completed. | User dismisses checkout (`POST /payments/cancel-incomplete`); pending order cancelled by user or auto-expiry (`order.service` → `cancelOrder`) |
| `WALLET_CREDITED` | Wallet credited | ₹{amount} was added to your wallet. | Wallet top-up verified (`wallet.service` → `verifyTopup`); wallet top-up via Razorpay capture (non-order payment); admin wallet refund (`wallet.service` → `refund`) |
| `WALLET_DEBITED` | Wallet debited | ₹{amount} was used from your wallet. | Wallet pay API (`wallet.service` → `pay`); full order paid with wallet (`order.service` → `payWithWallet`) |
| `CASHBACK_RECEIVED` | Cashback received | ₹{amount} cashback was added to your wallet. | Wallet credit when transaction `source` is `bonus` (via `walletCreditNotificationType`; use when crediting cashback) |
| `REFERRAL_REWARD_CREDITED` | Referral reward | ₹{amount} referral reward was credited to your wallet. | First delivered order triggers referral reward for referred user and referrer (`order.service` → `_grantReferralReward`) |
| `COUPON_APPLIED` | Coupon applied | You saved ₹{discount} with {code}. | Checkout enqueued with one or more coupons (`order.service` → `createFromCart`) |
| `RATE_ORDER_REMINDER` | Rate your order | How was order #{orderNumber}? Tap to leave a review. | **Delayed** job after order status becomes `delivered` (default 24h, `NOTIFICATION_RATE_ORDER_DELAY_MS`) |

### Order status labels (`ORDER_STATUS`)

`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled` map to user-facing labels (e.g. `shipped` → “Shipped”).

### Common `data` fields (customer)

| Field | Used by |
|-------|---------|
| `orderId` | Order/payment/rate flows |
| `orderNumber` | Order/payment/rate flows |
| `amount` | Payment, wallet, referral |
| `status` | `ORDER_STATUS` |
| `code`, `discount` | `COUPON_APPLIED` |

---

## Vendor notifications (`role: vendor`)

| Type | Title | Body (template) | When it is sent |
|------|-------|-----------------|-----------------|
| `LOGIN_SUCCESS` | Welcome back | You're signed in to Finsty. | Vendor OTP verified (`auth.controller` → `vendorVerifyOtp`) |
| `VENDOR_NEW_ORDER` | New order | Order #{orderNumber} needs your attention. | After payment confirms the order; one push per store owner (`notifyOrderPlacedAfterPayment`) |
| `VENDOR_LOW_STOCK` | Low stock alert | {productName} is running low ({stock} left). | Variant stock updated and crosses **at or below** `lowStockThreshold` (was above threshold before) (`product.service` → `updateVariant`) |
| `VENDOR_OUT_OF_STOCK` | Out of stock | {productName} is now out of stock. | Variant stock updated to `0` (was &gt; 0 before) (`product.service` → `updateVariant`) |

Stock alerts are **debounced**: only sent when crossing the threshold, not on every stock edit.

### Common `data` fields (vendor)

| Field | Used by |
|-------|---------|
| `orderId`, `orderNumber` | `VENDOR_NEW_ORDER` |
| `productId`, `productName`, `stock` | Stock alerts |

---

## Admin notifications (`role: admin`)

| Type | Title | Body | When it is sent |
|------|-------|------|-----------------|
| `LOGIN_SUCCESS` | Welcome back | You're signed in to Finsty. | Admin OTP verified (`auth.controller` → `adminVerifyOtp`) |

Admin panel push for other events is **not** in scope for v1.

---

## In-app inbox (persisted)

Every enqueued push is also stored in PostgreSQL (`notifications` table) before FCM delivery.

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/notifications` | Paginated inbox for JWT role (`user` / `vendor` / `admin`) |
| `GET /api/v1/notifications/unread-count` | Unread badge count |
| `PATCH /api/v1/notifications/:notificationId/read` | Mark one read |
| `PATCH /api/v1/notifications/read-all` | Mark all read (optional `{ "category": "orders" }` body) |

**Vendor `category` filter** (`GET /notifications?category=…`):

| Category | Types |
|----------|-------|
| `orders` | `VENDOR_NEW_ORDER` |
| `inventory` | `VENDOR_LOW_STOCK`, `VENDOR_OUT_OF_STOCK` |
| `account` | `LOGIN_SUCCESS` |

**Customer categories:** `orders`, `payments`, `wallet`, `promotions`, `account`.

## Not in scope (v1)

- Email or SMS for these events (email queue remains separate)
- Push to admin for operational events (except login)

---

## Mobile integration checklist

1. Request notification permission (iOS/Android).
2. Obtain FCM registration token.
3. Send `deviceToken` + `platform` on login (or `PUT /api/v1/users/me/device-token` on FCM token refresh).
4. Handle foreground/background taps using `data.type` (and ids) for navigation.
5. Android: create `finsty_default` channel with high importance.

---

## Code reference

| File | Purpose |
|------|---------|
| `notification.types.ts` | Type constants |
| `notification.messages.ts` | Title, body, `data` builder |
| `fcmPayload.ts` | FCM multicast message (APNs + Android) |
| `notification.service.ts` | Enqueue helpers, send, token cleanup |
| `notification.order.ts` | Order status, vendor new order, rate reminder |
| `notification.stock.ts` | Vendor low/out-of-stock |
| `queues/notificationQueue.ts` | BullMQ queue |
| `queues/notificationWorker.ts` | Worker |

Unit tests: `notification.messages.test.ts`, `fcmPayload.test.ts`.
