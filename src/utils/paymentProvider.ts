import Razorpay from 'razorpay';

export interface InitiateParams {
  amount: number;
  currency: string;
  reference: string;
  metadata?: object;
}

export interface InitiateResult {
  checkout_url: string;
  provider_reference: string;
}

export interface VerifyResult {
  status: 'successful' | 'failed';
  amount: number;
  paymentType?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'other';
}

export interface PaymentProvider {
  initiate(params: InitiateParams): Promise<InitiateResult>;
  verify(providerReference: string): Promise<VerifyResult>;
}

// ─── Manual (stub) provider ───────────────────────────────────────────────────

class ManualProvider implements PaymentProvider {
  async initiate(params: InitiateParams): Promise<InitiateResult> {
    return {
      checkout_url: `manual://pay?ref=${params.reference}&amount=${params.amount}`,
      provider_reference: `manual_${params.reference}`,
    };
  }

  async verify(_providerReference: string): Promise<VerifyResult> {
    // Stub: always succeeds. Replace with real provider API call.
    return {
      status: 'successful',
      amount: 0,
      paymentType: 'other',
    };
  }
}

// ─── Razorpay provider ────────────────────────────────────────────────────────

class RazorpayProvider implements PaymentProvider {
  private client: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
    }

    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async initiate(params: InitiateParams): Promise<InitiateResult> {
    // Razorpay amounts are in the smallest currency unit (paise for INR)
    const amountInPaise = Math.round(params.amount * 100);

    const order = await this.client.orders.create({
      amount: amountInPaise,
      currency: params.currency,
      receipt: params.reference,
      notes: params.metadata as Record<string, string> | undefined,
    });

    const providerOrderId = order.id as string;

    // Standard Razorpay checkout URL — frontend uses the SDK with this order id
    const checkoutUrl = `https://api.razorpay.com/v1/checkout/embedded?order_id=${providerOrderId}`;

    return {
      checkout_url: checkoutUrl,
      provider_reference: providerOrderId,
    };
  }

  async verify(providerPaymentId: string): Promise<VerifyResult> {
    try {
      const payment = await this.client.payments.fetch(providerPaymentId);

      const status = payment.status === 'captured' ? 'successful' : 'failed';
      // Razorpay returns amount in paise; convert back to rupees
      const amount = Number(payment.amount) / 100;
      
      let paymentType: VerifyResult['paymentType'] = 'other';
      if (['card', 'upi', 'netbanking', 'wallet'].includes(payment.method as string)) {
        paymentType = payment.method as VerifyResult['paymentType'];
      }

      return { status, amount, paymentType };
    } catch {
      return { status: 'failed', amount: 0 };
    }
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER ?? 'manual').toLowerCase();

  switch (name) {
    case 'manual':
      return new ManualProvider();
    case 'razorpay':
      return new RazorpayProvider();
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: "${name}"`);
  }
}

export const paymentProvider = getPaymentProvider();
