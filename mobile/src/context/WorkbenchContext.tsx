import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { api, UnauthorizedError } from '@/api/client';
import { clearToken } from '@/lib/auth';

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
  trending?: Array<{ id: string; name: string; city: string; genre: string; hypeCount: number }>;
};

type WorkbenchState =
  | { status: 'loading' }
  | { status: 'ok'; data: WorkbenchData }
  | { status: 'error'; error: string };

export type WorkbenchContextValue = WorkbenchState & { refresh: () => void; refreshing: boolean };

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkbenchState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get<WorkbenchData>('/api/workbench')
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ok', data });
          setRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          clearToken().then(() => router.replace('/(auth)/sign-in'));
          return;
        }
        setState({ status: 'error', error: String(err) });
        setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [tick, router]);

  return (
    <WorkbenchContext.Provider value={{ ...state, refresh, refreshing }}>
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbenchContext(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) throw new Error('useWorkbenchContext must be used within WorkbenchProvider');
  return ctx;
}
