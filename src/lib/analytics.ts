// Emits one data point per API request to Cloudflare Analytics Engine.
// Binding: AE (AnalyticsEngineDataset) from getCloudflareContext()
// Falls back silently if binding not available (local dev).

type AEDataset = {
  writeDataPoint(data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
};

export function trackRequest(
  pathname: string,
  status: number,
  durationMs: number
): void {
  try {
    void (async () => {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ae = (getCloudflareContext().env as Record<string, unknown>)
        .AE as AEDataset | undefined;
      if (!ae) return;
      ae.writeDataPoint({
        blobs: [pathname],
        doubles: [status, durationMs],
        indexes: [pathname],
      });
    })();
  } catch {
    // Never throw — analytics is best-effort
  }
}
