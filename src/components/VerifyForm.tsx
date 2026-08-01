'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MUSIC_GENRES } from '@/lib/genres';
import { useI18n } from '@/components/I18nProvider';

const PROOF: Record<string, string[]> = {
  ARTIST: [
    'A link to your Spotify, Bandcamp, or SoundCloud profile with at least one published track',
    'A screenshot of a past show booking or contract',
    'Social media profile showing your music',
  ],
  DJ: [
    'A SoundCloud or Mixcloud profile with at least one public mix',
    'A past event poster or booking confirmation',
    'Social media profile showing DJ work',
  ],
  VENUE: [
    'Business license or permits for the venue',
    'Official venue website or Google Maps listing',
    'A recent event poster or booking invoice',
  ],
};

const LINK_LABEL: Record<string, string> = {
  ARTIST: 'Website, Bandcamp, or SoundCloud',
  DJ: 'SoundCloud, Mixcloud, or website',
  VENUE: 'Venue website or Google Maps URL',
};

interface Props {
  profileId: string;
  type: 'ARTIST' | 'DJ' | 'VENUE';
  initialName: string;
  initialCity: string;
  initialGenres: string;
  initialLink: string;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line, var(--hair-80))',
  background: 'var(--bg-3, var(--bg))', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: '1rem',
  marginBottom: 14, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '.12em',
  textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6,
};

export function VerifyForm({ profileId, type, initialName, initialCity, initialGenres, initialLink }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [genres, setGenres] = useState(initialGenres);
  const [link, setLink] = useState(initialLink);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('profileId', profileId);
      formData.set('name', name);
      formData.set('city', city);
      formData.set('genres', genres);
      formData.set('link', link);
      formData.set('notes', notes);
      if (file) formData.set('file', file);

      const res = await fetch('/api/verify', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('verifyForm.errorSubmissionFailed', 'Submission failed'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('verifyForm.errorNetwork', 'Network error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <div>
        <div style={{ ...labelStyle, marginBottom: 10 }}>{t('verifyForm.step1of2', 'Step 1 of 2')}</div>
        <div style={{ height: 3, background: 'var(--bg-3, var(--bg))', borderRadius: 999, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '50%', background: 'var(--accent)', borderRadius: 999, transition: 'width .4s ease' }} />
        </div>
        <label style={labelStyle} htmlFor="verify-name">{type === 'VENUE' ? t('verifyForm.venueNameLabel', 'Venue name') : t('verifyForm.stageArtistNameLabel', 'Stage / Artist name')}</label>
        <input id="verify-name" style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Midnight Echo" />

        <label style={labelStyle} htmlFor="verify-city">{t('verifyForm.cityLabel', 'City')}</label>
        <input id="verify-city" style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Los Angeles, CA" />

        {type !== 'VENUE' && (
          <>
            <label style={labelStyle} htmlFor="verify-genres">{t('verifyForm.genreLabel', 'Genre (3+ tags)')}</label>
            <input id="verify-genres" list="ihype-genre-suggestions" style={fieldStyle} value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="dream-pop, shoegaze, lo-fi" />
            <datalist id="ihype-genre-suggestions">
              {MUSIC_GENRES.map((g) => <option key={g} value={g} />)}
            </datalist>
          </>
        )}

        <label style={labelStyle} htmlFor="verify-link">
          {type === 'ARTIST' ? t('verifyForm.linkLabelArtist', 'Website, Bandcamp, or SoundCloud')
            : type === 'DJ' ? t('verifyForm.linkLabelDj', 'SoundCloud, Mixcloud, or website')
            : t('verifyForm.linkLabelVenue', 'Venue website or Google Maps URL')}
        </label>
        <input id="verify-link" style={fieldStyle} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" type="url" />

        <button onClick={() => setStep(2)} disabled={!name.trim()} className="ihype-btn-primary" style={{ width: '100%' }}>
          {t('verifyForm.continue', 'Continue →')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 10 }}>{t('verifyForm.step2of2', 'Step 2 of 2')}</div>
      <div style={{ height: 3, background: 'var(--bg-3, var(--bg))', borderRadius: 999, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width .4s ease' }} />
      </div>
      <p style={{ fontSize: '0.88rem', color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>
        {t('verifyForm.confirmWhoYouAre', 'We need to confirm you are who you say you are. This is reviewed by the iHYPE team within 48 hours.')}
      </p>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line, var(--hair-80))', borderRadius: 18, padding: '1.5rem', marginBottom: 16 }}>
        <div style={{ ...labelStyle, color: 'var(--role-venue)', marginBottom: 10 }}>{t('verifyForm.whatCountsAsProof', 'What counts as proof')}</div>
        {PROOF[type].map((line, i) => (
          <div key={line} style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.8 }}>· {t(`verifyForm.proof${type}${i}`, line)}</div>
        ))}
      </div>

      <label
        style={{
          display: 'block', border: '1.5px dashed var(--line, var(--hair-100))', borderRadius: 14,
          padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 14,
        }}
      >
        <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>
          {file ? `${t('verifyForm.fileAttached', 'File attached ✓')} ${file.name}` : t('verifyForm.tapToAttachProof', 'Tap to attach proof · PDF, JPG, or PNG')}
        </div>
      </label>

      <label style={labelStyle} htmlFor="verify-notes">{t('verifyForm.notesLabel', 'Anything else to add?')}</label>
      <textarea
        id="verify-notes"
        style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('verifyForm.notesPlaceholder', 'Optional — any context that helps us verify faster.')}
      />

      {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={submit} disabled={submitting} className="ihype-btn-primary" style={{ width: '100%' }}>
        {submitting ? t('verifyForm.submitting', 'Submitting…') : t('verifyForm.submitForReview', 'Submit for review →')}
      </button>
      <button onClick={() => setStep(1)} className="ihype-btn-ghost" style={{ width: '100%', marginTop: 8 }}>
        {t('verifyForm.back', 'Back')}
      </button>
    </div>
  );
}
