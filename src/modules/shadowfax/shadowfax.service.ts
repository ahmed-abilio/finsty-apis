import shadowfaxClient, { OrderServiceabilityRequest } from './shadowfax.client';

class ShadowfaxService {
  async checkOrderServiceability(body: OrderServiceabilityRequest): Promise<{ success: true; data: unknown }> {
    const payload: OrderServiceabilityRequest = {
      ...body,
      order_value: typeof body.order_value === 'number' ? String(body.order_value) : body.order_value,
    };

    const data = await shadowfaxClient.checkOrderServiceability(payload);
    return { success: true, data };
  }
}

export default new ShadowfaxService();
