export const checkSignupSpike = (newCount: number, avgCount: number) =>
  avgCount > 0 && newCount > avgCount * 3;

export const checkErrorRate = (errorCount: number) => errorCount > 10;

export const checkPaymentFailures = (failures: number, total: number) =>
  total > 0 && failures / total > 0.05;
