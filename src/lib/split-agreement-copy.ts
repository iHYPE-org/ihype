/**
 * The signed copy of a Show Revenue Split Agreement: the text both parties
 * signed plus the signature block, as a PDF, and the email that carries it to
 * both parties at acceptance (Split Agreement 11.1, 11.8).
 */
import { db } from '@/lib/db';
import { escapeHtml } from '@/lib/html-escape';
import { log } from '@/lib/logger';
import { sendGenericEmail } from '@/lib/mailer';
import { signatureBlock } from '@/lib/split-agreement';
import { bytesToBase64, renderTextPdf } from '@/lib/text-pdf';

export type AgreementRecord = {
  id: string;
  text: string;
  textHash: string;
  version: string;
  guarantorName: string | null;
  venueSignerName: string;
  venueSignedAt: Date;
  artistSignerName: string;
  artistSignedAt: Date;
  supersededAt: Date | null;
};

export function signedAgreementText(record: AgreementRecord): string {
  const superseded = record.supersededAt
    ? `\n\nSUPERSEDED on ${record.supersededAt.toISOString().slice(0, 10)} by a revised Lineup Offer (Section 4.5).`
    : '';
  return `${record.text}\n${signatureBlock({
    venueSignerName: record.venueSignerName,
    venueSignedAt: record.venueSignedAt,
    artistSignerName: record.artistSignerName,
    artistSignedAt: record.artistSignedAt,
    hash: record.textHash,
    version: record.version,
    guarantorName: record.guarantorName,
  })}${superseded}`;
}

export function agreementPdf(record: AgreementRecord): Uint8Array {
  return renderTextPdf(signedAgreementText(record), 'iHYPE Show Revenue Split Agreement');
}

export function agreementFilename(showSlug: string, artistName: string): string {
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'show';
  return `split-agreement-${safe(showSlug)}-${safe(artistName)}.pdf`;
}

/** Best-effort, after the agreement is written: a failed send never undoes a signature. */
export async function emailSignedAgreement(agreementId: string): Promise<void> {
  try {
    const agreement = await db.showSplitAgreement.findUnique({
      where: { id: agreementId },
      select: {
        id: true, text: true, textHash: true, version: true, guarantorName: true,
        venueSignerName: true, venueSignedAt: true, artistSignerName: true, artistSignedAt: true, supersededAt: true,
        show: { select: { slug: true, title: true } },
        venueProfile: { select: { name: true, owner: { select: { email: true } } } },
        artistProfile: { select: { name: true, owner: { select: { email: true } } } },
      },
    });
    if (!agreement) return;
    const to = [agreement.venueProfile.owner.email, agreement.artistProfile.owner.email].filter((e): e is string => Boolean(e));
    if (to.length === 0) return;
    const pdf = agreementPdf(agreement);
    const filename = agreementFilename(agreement.show.slug, agreement.artistProfile.name);
    const subject = `Signed: ${agreement.artistProfile.name} at ${agreement.venueProfile.name} — ${agreement.show.title}`;
    const text = [
      `${agreement.venueProfile.name} and ${agreement.artistProfile.name} have both signed the Show Revenue Split Agreement for "${agreement.show.title}".`,
      '',
      'The signed agreement is attached as a PDF. You can download it again at any time from the show\'s lineup page in the iHYPE app.',
      '',
      `SHA-256 of the signed text: ${agreement.textHash}`,
    ].join('\n');
    const html = `<p>${escapeHtml(agreement.venueProfile.name)} and ${escapeHtml(agreement.artistProfile.name)} have both signed the Show Revenue Split Agreement for &ldquo;${escapeHtml(agreement.show.title)}&rdquo;.</p><p>The signed agreement is attached as a PDF. You can download it again at any time from the show&rsquo;s lineup page in the iHYPE app.</p><p style="font-family:monospace;font-size:12px">SHA-256 of the signed text: ${escapeHtml(agreement.textHash)}</p>`;
    await sendGenericEmail({
      to,
      subject,
      text,
      html,
      deliveryType: 'split_agreement_signed',
      idempotencyKey: `split-agreement-signed:${agreement.id}`,
      attachments: [{ filename, content: bytesToBase64(pdf) }],
    });
  } catch (error) {
    log.error('[split-agreement]', error instanceof Error ? error : null, `Could not email signed agreement ${agreementId}`);
  }
}
