// Lightweight A/B test assignment.
//
// Usage (server):
//   const variant = getExperimentVariant('signup_cta', session?.user?.id ?? null, ['blue','green']);
//
// Usage (client):
//   const variant = useExperiment('signup_cta', ['blue','green']);
//
// Conversions:
//   await fetch('/api/experiments/convert', {
//     method: 'POST',
//     body: JSON.stringify({ key: 'signup_cta', variant }),
//   });
//
// All exposures and conversions land in AuditLog as
// `experiment_exposure` / `experiment_conversion` events.

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getExperimentVariant<T extends string>(
  key: string,
  userId: string | null | undefined,
  variants: readonly T[]
): T {
  if (variants.length === 0) throw new Error('variants must not be empty');
  if (!userId) {
    return variants[Math.floor(Math.random() * variants.length)];
  }
  const idx = hashString(`${key}:${userId}`) % variants.length;
  return variants[idx];
}
