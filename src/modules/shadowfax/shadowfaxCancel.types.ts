/** Shadowfax cancel API actor (`user` field). */
export type ShadowfaxCancelUser = 'Customer' | 'Seller';

export interface ShadowfaxCancelOrderRequest {
  reason: string;
  user: ShadowfaxCancelUser;
}
