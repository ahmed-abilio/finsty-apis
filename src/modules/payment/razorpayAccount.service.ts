import Razorpay from 'razorpay';
import logger from '@utils/logger';

export interface RazorpaySettlementSummary {
  id: string;
  amount: number;
  fees: number;
  tax: number;
  utr: string | null;
  status: string;
  createdAt: string;
}

export interface RazorpayAccountSnapshot {
  configured: boolean;
  lastSettlement: RazorpaySettlementSummary | null;
  recentSettlements: RazorpaySettlementSummary[];
  settlementsThisMonth: {
    count: number;
    amount: number;
  };
  /** Available Instant Settlement balance in INR when Instant Settlements is enabled; otherwise null. */
  availableBalance: number | null;
  instantSettlementsEnabled: boolean;
  error: string | null;
}

function paiseToInr(paise: unknown): number {
  const n = Number(paise ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

function unixToIso(ts: unknown): string {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n * 1000).toISOString();
}

function mapSettlement(raw: {
  id?: string
  amount?: number | string | null
  fees?: number | string | null
  tax?: number | string | null
  utr?: string | null
  status?: string
  created_at?: number | string | null
}): RazorpaySettlementSummary {
  return {
    id: String(raw.id ?? ''),
    amount: paiseToInr(raw.amount),
    fees: paiseToInr(raw.fees),
    tax: paiseToInr(raw.tax),
    utr: raw.utr != null ? String(raw.utr) : null,
    status: String(raw.status ?? ''),
    createdAt: unixToIso(raw.created_at),
  };
}

function createClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function startOfUtcMonthUnix(now = new Date()): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}

class RazorpayAccountService {
  async getAccountSnapshot(): Promise<RazorpayAccountSnapshot> {
    const empty: RazorpayAccountSnapshot = {
      configured: false,
      lastSettlement: null,
      recentSettlements: [],
      settlementsThisMonth: { count: 0, amount: 0 },
      availableBalance: null,
      instantSettlementsEnabled: false,
      error: null,
    };

    const provider = (process.env.PAYMENT_PROVIDER ?? 'manual').toLowerCase();
    if (provider !== 'razorpay') {
      return { ...empty, error: 'PAYMENT_PROVIDER is not razorpay' };
    }

    const client = createClient();
    if (!client) {
      return { ...empty, error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured' };
    }

    empty.configured = true;

    try {
      const monthFrom = startOfUtcMonthUnix();
      const [recentRes, monthRes, balance] = await Promise.all([
        client.settlements.all({ count: 5 }),
        client.settlements.all({ from: monthFrom, count: 100 }),
        this.fetchAvailableBalance(client),
      ]);

      const recentItems = (recentRes.items ?? []).map(mapSettlement);
      const monthItems = (monthRes.items ?? []).map(mapSettlement);

      return {
        configured: true,
        lastSettlement: recentItems[0] ?? null,
        recentSettlements: recentItems,
        settlementsThisMonth: {
          count: monthItems.length,
          amount: monthItems.reduce((sum, s) => sum + s.amount, 0),
        },
        availableBalance: balance.amount,
        instantSettlementsEnabled: balance.enabled,
        error: null,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to fetch Razorpay account snapshot');
      return {
        ...empty,
        configured: true,
        error: err instanceof Error ? err.message : 'Failed to fetch Razorpay settlements',
      };
    }
  }

  /**
   * Instant Settlements expose pending/available PG balance; standard PG has no public balance API.
   * Probe with a lightweight list call — if the feature is disabled Razorpay returns an error.
   */
  private async fetchAvailableBalance(
    client: Razorpay,
  ): Promise<{ amount: number | null; enabled: boolean }> {
    try {
      const settlements = client.settlements as Razorpay['settlements'] & {
        fetchAllOndemandSettlement?: (opts: { count: number }) => Promise<{
          items?: Array<{ amount_pending?: number; amount_requested?: number }>;
        }>;
      };

      if (typeof settlements.fetchAllOndemandSettlement !== 'function') {
        return { amount: null, enabled: false };
      }

      const res = await settlements.fetchAllOndemandSettlement({ count: 5 });
      const items = res.items ?? [];
      const pending = items.reduce((sum, item) => sum + paiseToInr(item.amount_pending), 0);
      return { amount: pending, enabled: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Feature not enabled on this merchant account — expected for many setups.
      if (/not enabled|not routable|instant settlement/i.test(message)) {
        return { amount: null, enabled: false };
      }
      logger.warn({ err }, 'Razorpay Instant Settlements probe failed');
      return { amount: null, enabled: false };
    }
  }
}

export default new RazorpayAccountService();
