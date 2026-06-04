import { useEffect, useState } from 'react';
import { api } from '@/api/client';

export type WorkbenchData = {
  userName: string;
  userInitials: string;
  city: string;
  hypedToday: number;
  listeningNow: number;
  showsTonight: number;
  degraded?: boolean;
  tracks: Array<{ id: string; title: string; artistName: string; mediaUrl: string; color: string }>;
  shows: Array<{ id: string; name: string; venue: string; date: string; status: string }>;
  tickets: Array<{ id: string; showName: string; date: string; code: string; status: string }>;
};

type State =
  | { status: 'loading' }
  | { status: 'ok'; data: WorkbenchData }
  | { status: 'error'; error: string };

export function useWorkbenchData(): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api.get<WorkbenchData>('/api/workbench')
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }); })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', error: String(err) });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
