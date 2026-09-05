import { getRoutineBoard } from '@/lib/admin-routine-data';
import { routineHeadline } from '@/lib/admin-routine';
import { getWorkbenchQueues } from '@/lib/admin-workbench';
import { getServerT } from '@/lib/i18n/server';
import { AdminRoutine } from '@/components/admin/AdminRoutine';

/**
 * The daily standing question — "what does the platform need from me today?" —
 * answered in one place at the top of /admin, and now also "how often", and
 * "which of this does the machine do for me".
 *
 * Until 2026-09-05 this was a grid of eight queue cards at equal weight. It
 * became the routine board (`admin-routine.ts`) by owner instruction —
 * "reinforce daily vs weekly todo and nightly tasks" — because a 24-hour payout
 * promise and an inbox with no promise at all should not look the same, and
 * because nothing on the console said that payouts, settlement, backups and the
 * acceptance walk run on a schedule with nobody watching. The queues are the
 * same `getWorkbenchQueues()` rows the digest, the pulse and the feature board
 * read; the cadence is derived from each queue's own promise.
 */
export async function AdminWorkbench() {
  const [t, queues] = await Promise.all([getServerT(), getWorkbenchQueues()]);
  const board = await getRoutineBoard(queues);

  return (
    <section className="section admin-workbench">
      <div className="admin-workbench-head">
        <div>
          <h2 style={{ margin: 0 }}>{t('adminWorkbench.title', 'Today')}</h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>{routineHeadline(board)}</p>
        </div>
      </div>
      <AdminRoutine board={board} />
    </section>
  );
}
