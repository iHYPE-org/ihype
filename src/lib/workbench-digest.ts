import { formatAge, getWorkbenchQueues, orderByUrgency, type WorkbenchQueue } from '@/lib/admin-workbench';
import { sendOperationalEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';
import { getAdminAlertRecipients } from '@/lib/env';

/**
 * The morning half of the admin workbench.
 *
 * /admin answers "what needs me?" once you are already looking at it. This
 * answers it without being asked, which is the half that matters — the whole
 * point of a 48-hour promise is noticing on hour 47, not on the next visit.
 *
 * Deliberately quiet. It sends only when something is actually overdue
 * against its own stated turnaround. A digest that arrives every morning
 * saying "3 items, all on time" trains you to archive it unread, and then the
 * one that says something is wrong gets archived too.
 */

/**
 * Every value interpolated below is a hardcoded constant from
 * admin-workbench.ts or a formatted number, so nothing here is
 * attacker-controlled today. This exists so that stays true if someone later
 * adds a queue whose label comes from the database — the failure mode would
 * otherwise be markup injected into an email sent to the admin.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type DigestDecision =
  | { send: false; reason: 'nothing-overdue' }
  | { send: true; overdue: WorkbenchQueue[]; alsoWaiting: WorkbenchQueue[] };

/**
 * Pure: decides whether today's digest is worth an email, and what goes in it.
 * Split from the sending so the rule can be tested without a mail provider.
 */
export function decideDigest(queues: WorkbenchQueue[]): DigestDecision {
  const ordered = orderByUrgency(queues);
  const overdue = ordered.filter((q) => q.overdue);
  if (overdue.length === 0) return { send: false, reason: 'nothing-overdue' };
  return {
    send: true,
    overdue,
    // Everything else with work in it rides along once the email is already
    // justified. It costs nothing to read and saves a second trip.
    alsoWaiting: ordered.filter((q) => !q.overdue && q.count > 0),
  };
}

function line(q: WorkbenchQueue): string {
  const age = formatAge(q.oldestHours);
  const sla = q.slaHours ? ` (promised ${formatAge(q.slaHours)})` : '';
  return `${q.label}: ${q.count} waiting, oldest ${age}${sla}`;
}

export function renderDigestText(decision: Extract<DigestDecision, { send: true }>, baseUrl: string): string {
  const parts = [
    'These are past the turnaround iHYPE promises for them:',
    '',
    ...decision.overdue.map((q) => `  ! ${line(q)}`),
  ];
  if (decision.alsoWaiting.length > 0) {
    parts.push('', 'Also waiting, still within their window:', '', ...decision.alsoWaiting.map((q) => `  - ${line(q)}`));
  }
  parts.push('', `Open the workbench: ${baseUrl}/admin`);
  return parts.join('\n');
}

export function renderDigestHtml(decision: Extract<DigestDecision, { send: true }>, baseUrl: string): string {
  const row = (q: WorkbenchQueue, late: boolean) => `
    <tr>
      <td style="padding:8px 12px 8px 0;">
        <a href="${esc(baseUrl)}${esc(q.href)}" style="color:${late ? '#ff5029' : '#22e5d4'};text-decoration:none;font-weight:700;">${esc(q.label)}</a>
      </td>
      <td style="padding:8px 12px 8px 0;font-weight:700;">${q.count}</td>
      <td style="padding:8px 0;color:#8a8175;">oldest ${esc(formatAge(q.oldestHours))}${q.slaHours ? ` / ${esc(formatAge(q.slaHours))} promised` : ''}</td>
    </tr>`;

  return `
<h2>What needs you today</h2>
<p>These are past the turnaround iHYPE promises for them:</p>
<table style="border-collapse:collapse;font-size:14px;">
  ${decision.overdue.map((q) => row(q, true)).join('')}
</table>
${
  decision.alsoWaiting.length > 0
    ? `<p style="margin-top:20px;">Also waiting, still within their window:</p>
<table style="border-collapse:collapse;font-size:14px;">
  ${decision.alsoWaiting.map((q) => row(q, false)).join('')}
</table>`
    : ''
}
<p style="margin-top:24px;"><a href="${esc(baseUrl)}/admin">Open the workbench</a></p>`;
}

export async function sendWorkbenchDigest(): Promise<{ ok: boolean; sent: boolean; overdue: number }> {
  const queues = await getWorkbenchQueues();
  const decision = decideDigest(queues);

  if (!decision.send) {
    return { ok: true, sent: false, overdue: 0 };
  }

  const baseUrl = getBaseUrl();
  const subject =
    decision.overdue.length === 1
      ? `[iHYPE] ${decision.overdue[0].label} is overdue`
      : `[iHYPE] ${decision.overdue.length} queues are overdue`;

  // sendOperationalEmail, not sendGenericEmail: a throw here would fail the
  // cron job, and this job's whole purpose is to be the thing that notices
  // problems. It logs through log.error instead, which reaches Sentry — a
  // channel that does not depend on the email provider this send just failed
  // against.
  const sent = await sendOperationalEmail(
    {
      to: getAdminAlertRecipients(),
      subject,
      html: renderDigestHtml(decision, baseUrl),
      text: renderDigestText(decision, baseUrl),
    },
    'workbench-digest',
  );

  return { ok: true, sent, overdue: decision.overdue.length };
}
