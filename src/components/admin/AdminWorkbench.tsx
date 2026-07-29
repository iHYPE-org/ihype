import Link from 'next/link';
import { formatAge, getWorkbenchQueues, orderByUrgency } from '@/lib/admin-workbench';
import { getServerT } from '@/lib/i18n/server';

/**
 * The daily standing question — "what does the platform need from me today?" —
 * answered in one place at the top of /admin.
 *
 * Ordering is by urgency, not by category: anything overdue against its own
 * stated SLA floats up, then anything else with work in it, then the clear
 * queues. Clear queues are still rendered rather than hidden, because "no
 * verifications waiting" and "the verifications query silently returned
 * nothing" look identical when the row is absent.
 */
export async function AdminWorkbench() {
  const [t, queues] = await Promise.all([getServerT(), getWorkbenchQueues()]);

  const sorted = orderByUrgency(queues);

  const waiting = queues.reduce((sum, q) => sum + q.count, 0);
  const overdue = queues.filter((q) => q.overdue).length;

  return (
    <section className="section admin-workbench">
      <div className="admin-workbench-head">
        <div>
          <h2 style={{ margin: 0 }}>{t('adminWorkbench.title', 'Today')}</h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            {waiting === 0
              ? t('adminWorkbench.allClear', 'Nothing is waiting on you.')
              : overdue > 0
                ? `${waiting} ${t('adminWorkbench.itemsWaiting', 'items waiting')} · ${overdue} ${t('adminWorkbench.queuesOverdue', 'queue(s) past their promised turnaround')}`
                : `${waiting} ${t('adminWorkbench.itemsWaitingAllOnTime', 'items waiting, all within their promised turnaround')}`}
          </p>
        </div>
      </div>

      <div className="admin-workbench-grid">
        {sorted.map((q) => {
          const state = q.overdue ? 'overdue' : q.count > 0 ? 'active' : 'clear';
          return (
            <Link className={`admin-workbench-card admin-workbench-${state}`} href={q.href} key={q.id}>
              <div className="admin-workbench-card-top">
                <span className="admin-workbench-count">{q.count}</span>
                {q.count > 0 && q.oldestHours !== null && (
                  <span className="admin-workbench-age" title={t('adminWorkbench.oldestItemTitle', 'Age of the oldest waiting item')}>
                    {formatAge(q.oldestHours)}
                    {q.slaHours ? ` / ${formatAge(q.slaHours)}` : ''}
                  </span>
                )}
              </div>
              <div className="admin-workbench-label">{q.label}</div>
              <div className="admin-workbench-detail">{q.detail}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
