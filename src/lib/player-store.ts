type PlayerState = {
  trackTitle: string;
  artistName: string;
  isPlaying: boolean;
  progress: number;
} | null;

let state: PlayerState = null;
const listeners = new Set<() => void>();

export const playerStore = {
  get: () => state,
  set: (s: PlayerState) => {
    state = s;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
