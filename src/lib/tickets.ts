import { TicketStatus } from '@prisma/client/wasm';
import { createHexId } from '@/lib/hex-id';
import { getBaseUrl } from '@/lib/utils';

export function createSerializedTicketId() {
  return createHexId(12);
}

function getAppUrl() {
  return getBaseUrl();
}

export function buildTicketVerificationUrl(serializedId: string) {
  return `${getAppUrl().replace(/\/$/, '')}/tickets/${serializedId}`;
}

export async function buildTicketQrCodeDataUrl(serializedId: string) {
  const url = buildTicketVerificationUrl(serializedId);
  // Return a URL to the QR code image (qrserver.com is a reliable, free, no-native-deps service)
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(url)}`;
}

export function formatTicketStatus(status: TicketStatus) {
  if (status === 'SCANNED') return 'Scanned';
  if (status === 'VOID') return 'Void';
  return 'Valid';
}
