const counters = {
  shadowfax_webhooks_received_total: 0,
  shadowfax_webhooks_processed_total: 0,
  shadowfax_webhooks_duplicate_total: 0,
  shadowfax_webhooks_failed_total: 0,
  shadowfax_reconciliation_fixes_total: 0,
};

export type ShadowfaxMetricName = keyof typeof counters;

export function incrementShadowfaxMetric(name: ShadowfaxMetricName, by = 1): void {
  counters[name] += by;
}

export function getShadowfaxMetrics(): Readonly<typeof counters> {
  return { ...counters };
}

export function resetShadowfaxMetricsForTests(): void {
  for (const key of Object.keys(counters) as ShadowfaxMetricName[]) {
    counters[key] = 0;
  }
}
