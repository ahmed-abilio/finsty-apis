/**
 * GST / tax and platform fee — backed by `platform_settings` (env fallback).
 */
export {
  getTaxRate,
  getPlatformFee,
  computeTaxOnSubtotal,
} from '@modules/platform-settings/platform-settings.service';
