'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

type TicketVerificationCardProps = {
  serializedId: string;
  status: string;
  canScan: boolean;
};

export function TicketVerificationCard({
  serializedId,
  status,
  canScan
}: TicketVerificationCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleScan() {
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/tickets/${serializedId}/scan`, {
      method: 'POST'
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? t('ticketVerificationCard.verifyErrorFallback', 'Could not verify this ticket.'));
      setPending(false);
      return;
    }

    setMessage(data.message ?? t('ticketVerificationCard.scannedFallback', 'Ticket scanned.'));
    setPending(false);
    router.refresh();
  }

  return (
    <div className="ticket-verification-actions">
      {canScan ? (
        <button className="button" disabled={pending || status !== 'Valid'} onClick={handleScan} type="button">
          {pending
            ? t('ticketVerificationCard.verifyingButton', 'Verifying...')
            : status === 'Valid'
              ? t('ticketVerificationCard.markScannedButton', 'Mark as scanned')
              : t('ticketVerificationCard.alreadyScannedButton', 'Already scanned')}
        </button>
      ) : null}
      {message ? <p className="meta">{message}</p> : null}
    </div>
  );
}
