'use client';

import { useState } from 'react';
import { postJson } from '@/lib/api-client';

const GENRE_OPTIONS = ['Dream-pop', 'Indie', 'Shoegaze', 'Electronic', 'Hip-hop', 'Jazz', 'Punk', 'Folk', 'R&B', 'Ambient'];

interface Props {
  profileId: string;
  initialCity: string;
  initialGenres: string[];
}

/**
 * Real city + genre capture for a Fan's own (LISTENER) profile — replaces
 * the previously-static "pick your city and genres" welcome copy that
 * didn't actually let a fan do either. PATCHes /api/profile-editor, same
 * endpoint every other profile-editing surface uses.
 */
export function FanTasteCapture({ profileId, initialCity, initialGenres }: Props) {
  const [city, setCity] = useState(initialCity);
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev));
  }

  async function save() {
    setStatus('saving');
    try {
      await postJson('/api/profile-editor', { profileId, city: city.trim() || null, genres });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="ftc-wrap">
      <input
        className="ftc-input"
        onChange={(e) => setCity(e.target.value)}
        placeholder="Your city"
        value={city}
      />
      <div className="ftc-chips">
        {GENRE_OPTIONS.map((g) => (
          <button
            className={genres.includes(g) ? 'ftc-chip ftc-chip-on' : 'ftc-chip'}
            key={g}
            onClick={() => toggleGenre(g)}
            type="button"
          >
            {g}
          </button>
        ))}
      </div>
      <button className="ftc-save" disabled={status === 'saving'} onClick={save} type="button">
        {status === 'saved' ? 'Saved ✓' : status === 'saving' ? 'Saving…' : 'Save taste →'}
      </button>
      {status === 'error' && <p className="ftc-error">Could not save — try again.</p>}

      <style>{`
        .ftc-wrap { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
        .ftc-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); font-family: var(--f-b, inherit); font-size: 13px; }
        .ftc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .ftc-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--bg); color: var(--ink-a70); font-size: 12px; cursor: pointer; }
        .ftc-chip-on { background: rgba(185,131,255,.15); border-color: #b983ff; color: #b983ff; }
        .ftc-save { align-self: flex-start; font-family: var(--f-d, inherit); font-weight: 700; font-size: 12px; background: #b983ff; color: #0a0805; border: none; border-radius: 999px; padding: 8px 16px; cursor: pointer; }
        .ftc-save:disabled { opacity: .7; cursor: default; }
        .ftc-error { font-size: 12px; color: var(--accent); margin: 0; }
      `}</style>
    </div>
  );
}
