import QRCode from 'qrcode';
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
  return QRCode.toDataURL(buildTicketVerificationUrl(serializedId), {
    margin: 1,
    width: 240
  });
}

export function formatTicketStatus(status: TicketStatus) {
  if (status === 'SCANNED') return 'Scanned';
  if (status === 'VOID') return 'Void';
  return 'Valid';
}
