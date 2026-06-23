'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Track, UserPrefs } from '@/lib/data';

export type Platform = 'ios' | 'android' | 'mobile' | 'desktop';
export type Tab = 'listen' | 'events' | 'pages';
export type SheetName =
  | 'artist-profile' | 'checkout' | 'live-event' | 'earnings'
  | 'payout' | 'post-purchase' | 'notifications' | 'settings'
  | 'playlist-create' | 'friend-activity' | 'my-tickets'
  | 'referral' | 'filter' | 'global-search' | null;

export type AppState = {
  betaOk: boolean;
  onboarded: boolean;
  prefs: UserPrefs | null;
  tab: Tab;
  nowPlaying: Track | null;
  playing: boolean;
  hypeBudget: number;
  notifsRead: boolean;
  sheet: SheetName;
  sheetData: any;
  toastMsg: string | null;
};

type Action =
  | { type: 'SET_BETA_OK' }
  | { type: 'SET_ONBOARDED'; prefs: UserPrefs }
  | { type: 'SET_TAB'; tab: Tab }
  | { type: 'SET_NOW_PLAYING'; track: Track | null }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'USE_HYPE' }
  | { type: 'SET_NOTIFS_READ' }
  | { type: 'OPEN_SHEET'; sheet: SheetName; data?: any }
  | { type: 'CLOSE_SHEET' }
  | { type: 'TOAST'; msg: string | null };

function getInitialState(): AppState {
  if (typeof window === 'undefined') {
    return { betaOk: false, onboarded: false, prefs: null, tab: 'listen', nowPlaying: null, playing: false, hypeBudget: 3, notifsRead: false, sheet: null, sheetData: null, toastMsg: null };
  }
  const betaOk = !!localStorage.getItem('ihype_beta_ok');
  const prefsRaw = localStorage.getItem('ihype_onboarded_v2');
  const prefs = prefsRaw ? JSON.parse(prefsRaw) : null;
  const budget = parseInt(localStorage.getItem('ihype_hype_budget') || '3', 10);
  return { betaOk, onboarded: !!prefs, prefs, tab: 'listen', nowPlaying: null, playing: false, hypeBudget: budget, notifsRead: false, sheet: null, sheetData: null, toastMsg: null };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BETA_OK':
      return { ...state, betaOk: true };
    case 'SET_ONBOARDED':
      return { ...state, onboarded: true, prefs: action.prefs };
    case 'SET_TAB':
      return { ...state, tab: action.tab, sheet: null };
    case 'SET_NOW_PLAYING':
      return { ...state, nowPlaying: action.track, playing: !!action.track };
    case 'SET_PLAYING':
      return { ...state, playing: action.playing };
    case 'USE_HYPE':
      return { ...state, hypeBudget: Math.max(0, state.hypeBudget - 1) };
    case 'SET_NOTIFS_READ':
      return { ...state, notifsRead: true };
    case 'OPEN_SHEET':
      return { ...state, sheet: action.sheet, sheetData: action.data ?? null };
    case 'CLOSE_SHEET':
      return { ...state, sheet: null, sheetData: null };
    case 'TOAST':
      return { ...state, toastMsg: action.msg };
    default:
      return state;
  }
}

type AppCtxType = AppState & {
  setBetaOk: () => void;
  setOnboarded: (prefs: UserPrefs) => void;
  setTab: (tab: Tab) => void;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  useHype: () => boolean;
  markNotifsRead: () => void;
  openSheet: (sheet: SheetName, data?: any) => void;
  closeSheet: () => void;
  toast: (msg: string, ms?: number) => void;
};

const AppCtx = createContext<AppCtxType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const setBetaOk = useCallback(() => {
    localStorage.setItem('ihype_beta_ok', '1');
    dispatch({ type: 'SET_BETA_OK' });
  }, []);

  const setOnboarded = useCallback((prefs: UserPrefs) => {
    localStorage.setItem('ihype_onboarded_v2', JSON.stringify(prefs));
    dispatch({ type: 'SET_ONBOARDED', prefs });
  }, []);

  const setTab = useCallback((tab: Tab) => dispatch({ type: 'SET_TAB', tab }), []);
  const playTrack = useCallback((track: Track) => dispatch({ type: 'SET_NOW_PLAYING', track }), []);
  const togglePlay = useCallback(() => dispatch({ type: 'SET_PLAYING', playing: !state.playing }), [state.playing]);

  const useHype = useCallback((): boolean => {
    if (state.hypeBudget <= 0) return false;
    const next = state.hypeBudget - 1;
    localStorage.setItem('ihype_hype_budget', String(next));
    dispatch({ type: 'USE_HYPE' });
    return true;
  }, [state.hypeBudget]);

  const markNotifsRead = useCallback(() => dispatch({ type: 'SET_NOTIFS_READ' }), []);
  const openSheet = useCallback((sheet: SheetName, data?: any) => dispatch({ type: 'OPEN_SHEET', sheet, data }), []);
  const closeSheet = useCallback(() => dispatch({ type: 'CLOSE_SHEET' }), []);

  const toast = useCallback((msg: string, ms = 2600) => {
    dispatch({ type: 'TOAST', msg });
    setTimeout(() => dispatch({ type: 'TOAST', msg: null }), ms);
  }, []);

  return (
    <AppCtx.Provider value={{ ...state, setBetaOk, setOnboarded, setTab, playTrack, togglePlay, useHype, markNotifsRead, openSheet, closeSheet, toast }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
