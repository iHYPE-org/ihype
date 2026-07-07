import { TicketStatus } from '@prisma/client';
import { renderSVG } from 'uqr';
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
  // Generate the QR in-house (uqr is a zero-dependency encoder that runs on Cloudflare Workers)
  // and return it as an inline SVG data URL. The SVG scales cleanly to any display size; medium
  // error correction with a 2-module quiet zone matches the previous 240x240/margin-4 rendering.
  const svg = renderSVG(url, { ecc: 'M', border: 2 });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function formatTicketStatus(status: TicketStatus) {
  if (status === 'SCANNED') return 'Scanned';
  if (status === 'VOID') return 'Void';
  return 'Valid';
}
