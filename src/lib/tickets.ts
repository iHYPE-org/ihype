import QRCode from 'qrcode';
import { TicketStatus } from '@prisma/client/wasm';
import { createHexId } from '@/lib/hex-id';

export function createSerializedTicketId() {
  return createHexId(12);
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || 'https://ihype.org';
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
