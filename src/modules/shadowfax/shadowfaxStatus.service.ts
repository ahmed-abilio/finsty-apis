import shadowfaxClient from './shadowfax.client';
import {
  parseShadowfaxOrderStatusResponse,
  type ShadowfaxOrderStatusData,
} from './shadowfaxOrderStatus.types';

class ShadowfaxStatusService {
  async fetchOrderStatus(shadowfaxOrderId: string): Promise<ShadowfaxOrderStatusData> {
    const raw = await shadowfaxClient.getOrderStatus(shadowfaxOrderId);
    return parseShadowfaxOrderStatusResponse(raw);
  }
}

export default new ShadowfaxStatusService();
