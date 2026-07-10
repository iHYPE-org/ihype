'use client';

import { useEffect, useRef, useState } from 'react';
import {
  profileDesignPresets,
  profileAccentTones,
  profileBackdropTones,
  getProfileDesignPreset,
  getProfileAccentTone,
  getProfileBackdropTone,
} from '@/lib/profile-design';
import { AI_FIELD_LABELS } from '@/lib/page-refine';
import { parsePressKit, serializePressKit } from '@/lib/press-kit';

type EditorProfile = {
  id: string;
  slug: string;
  type: string;
  name: string;
  pressKitContent: string | null;
  headline: string | null;
  bio: string | null;
  aboutContent: string | null;
  topFiveContent: string | null;
  mediaContent: string | null;
  nowPlaying: string | null;
  links: string | null;
  merchUrl: string | null;
  merchContent: string | null;
  tourContent: string | null;
  requestContent: string | null;
  upcomingContent: string | null;
  previousShowHighlights: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  hoursText: string | null;
  parkingDetails: string | null;
  stayRecommendations: string | null;
  heroImage: string | null;
  avatarImage: string | null;
  logoImage: string | null;
  galleryImage: string | null;
  featureVideoUrl: string | null;
  themePreset: string | null;
  themeAccentTone: string | null;
  themeBackdropTone: string | null;
  fanShareEnabled: boolean | null;
};

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'about', label: 'About' },
  { id: 'media', label: 'Media' },
  { id: 'details', label: 'Details' },
  { id: 'presskit', label: 'Press kit' },
  { id: 'theme', label: 'Theme' },
  { id: 'ai', label: 'AI' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)',
  color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: 'rgba(240,235,229,.5)', margin: '0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function TextField({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return <input maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} type="text" value={value} />;
}

function TextAreaField({ value, onChange, placeholder, rows = 4, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number }) {
  return <textarea maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }} value={value} />;
}

function ImageField({ label, value, onUpload, uploading }: { label: string; value: string | null; onUpload: (file: File) => void; uploading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
          background: value ? `url(${value}) center/cover` : 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.1)',
        }} />
        <div style={{ flex: 1 }}>
          <button
            className="settings-btn settings-btn-ghost"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {uploading ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          </button>
          <input
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The Creator editing surface — turns the existing, previously-unused
 * /api/profile-editor endpoint into a real mobile-first editor covering
 * every field it accepts, plus the (also previously dormant) theme preset
 * system from profile-design.ts. Grouped into pill sub-tabs rather than one
 * long form since the full field set is large; role-specific fields
 * (tour dates vs. venue hours) only show for the relevant profile type.
 */
export function PageEditor({ profileId }: { profileId: string }) {
  const [data, setData] = useState<EditorProfile | null>(null);
  const [section, setSection] = useState<SectionId>('basics');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposed, setAiProposed] = useState<Record<string, string> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  // Press kit sub-form: friendly text fields serialized into the single
  // pressKitContent JSON column on every change.
  const [kitTagline, setKitTagline] = useState('');
  const [kitQuotesText, setKitQuotesText] = useState('');
  const [kitAchievementsText, setKitAchievementsText] = useState('');
  const [kitContactEmail, setKitContactEmail] = useState('');

  useEffect(() => {
    setData(null);
    fetch(`/api/profile-editor?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setData(d.profile);
        const kit = parsePressKit(d.profile?.pressKitContent);
        setKitTagline(kit.tagline);
        setKitQuotesText(kit.quotes.map((q) => (q.source ? `${q.quote} — ${q.source}` : q.quote)).join('\n'));
        setKitAchievementsText(kit.achievements.join('\n'));
        setKitContactEmail(kit.contactEmail);
      })
      .catch(() => {});
  }, [profileId]);

  function set<K extends keyof EditorProfile>(key: K, value: EditorProfile[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
    setSavedAt(null);
  }

  function updatePressKit(next: Partial<{ tagline: string; quotesText: string; achievementsText: string; contactEmail: string }>) {
    const tagline = next.tagline ?? kitTagline;
    const quotesText = next.quotesText ?? kitQuotesText;
    const achievementsText = next.achievementsText ?? kitAchievementsText;
    const contactEmail = next.contactEmail ?? kitContactEmail;
    if (next.tagline !== undefined) setKitTagline(next.tagline);
    if (next.quotesText !== undefined) setKitQuotesText(next.quotesText);
    if (next.achievementsText !== undefined) setKitAchievementsText(next.achievementsText);
    if (next.contactEmail !== undefined) setKitContactEmail(next.contactEmail);

    const quotes = quotesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const sep = line.lastIndexOf(' — ');
        return sep > 0
          ? { quote: line.slice(0, sep).trim(), source: line.slice(sep + 3).trim() }
          : { quote: line, source: '' };
      });
    const achievements = achievementsText.split('\n').map((line) => line.trim()).filter(Boolean);
    set('pressKitContent', serializePressKit({ tagline, quotes, achievements, contactEmail }));
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, ...data }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to save.');
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(field: 'heroImage' | 'avatarImage' | 'logoImage' | 'galleryImage', file: File) {
    setUploadingField(field);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('field', field);
      const res = await fetch('/api/profile/upload-graphic', { method: 'POST', body: formData });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Upload failed.');
        return;
      }
      const d = await res.json();
      set(field, d.url);
      setSavedAt(Date.now());
    } catch {
      setError('Upload failed — try again.');
    } finally {
      setUploadingField(null);
    }
  }

  async function runAiRefine() {
    const instruction = aiPrompt.trim();
    if (!instruction || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setAiProposed(null);
    setAiApplied(false);
    try {
      const res = await fetch('/api/page-builder/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, instruction }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(d.error ?? 'Something went wrong — try again.');
      } else if (!d.changes || Object.keys(d.changes).length === 0) {
        setAiError('The AI engine is warming up — try again in a moment, or rephrase your instruction.');
      } else {
        setAiProposed(d.changes as Record<string, string>);
      }
    } catch {
      setAiError('Network error — try again.');
    } finally {
      setAiBusy(false);
    }
  }

  async function runWebsiteImport() {
    const url = importUrl.trim();
    if (!url || importBusy) return;
    setImportBusy(true);
    setAiError(null);
    setAiProposed(null);
    setAiApplied(false);
    try {
      const res = await fetch('/api/page-builder/import-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, url }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(d.error ?? 'Could not import from that site — try again.');
      } else if (!d.changes || Object.keys(d.changes).length === 0) {
        setAiError('Nothing on that page mapped to your iHYPE fields.');
      } else {
        setAiProposed(d.changes as Record<string, string>);
      }
    } catch {
      setAiError('Network error — try again.');
    } finally {
      setImportBusy(false);
    }
  }

  function applyAiChanges() {
    if (!aiProposed) return;
    setData((d) => (d ? { ...d, ...aiProposed } : d));
    setSavedAt(null);
    setAiProposed(null);
    setAiApplied(true);
  }

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(240,235,229,.5)' }}>Loading your page…</div>;
  }

  const isVenue = data.type === 'VENUE';
  const isFan = data.type === 'LISTENER';
  const isArtistOrDj = data.type === 'ARTIST' || data.type === 'DJ';

  const preset = getProfileDesignPreset(data.themePreset);
  const accentTone = getProfileAccentTone(data.themeAccentTone);
  const backdropTone = getProfileBackdropTone(data.themeBackdropTone);

  return (
    <div>
      <div className="page-editor-tabstrip" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {SECTIONS.filter((s) => (s.id !== 'details' || !isFan) && (s.id !== 'presskit' || isArtistOrDj)).map((s) => (
          <div
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, padding: '9px 18px', borderRadius: 9999, cursor: 'pointer',
              background: section === s.id ? 'rgba(255,80,41,.1)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${section === s.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.08)'}`,
              color: section === s.id ? 'var(--ink)' : 'rgba(240,235,229,.55)', fontWeight: section === s.id ? 500 : 400,
            }}
          >
            {s.label}
          </div>
        ))}
      </div>

      {section === 'basics' && (
        <div>
          <Field label="Name"><TextField maxLength={120} onChange={(v) => set('name', v)} value={data.name} /></Field>
          <Field hint="A short one-liner shown near your name" label="Headline">
            <TextField maxLength={180} onChange={(v) => set('headline', v ?? '')} placeholder="e.g. Indie rock from Portland" value={data.headline ?? ''} />
          </Field>
          <Field label="Bio"><TextAreaField maxLength={1000} onChange={(v) => set('bio', v)} rows={3} value={data.bio ?? ''} /></Field>
          <Field label="Links" hint="One per line — socials, streaming, anything">
            <TextAreaField maxLength={5000} onChange={(v) => set('links', v)} rows={3} value={data.links ?? ''} />
          </Field>
          {isVenue && (
            <>
              <Field label="Address"><TextField maxLength={240} onChange={(v) => set('addressLine1', v)} value={data.addressLine1 ?? ''} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="City"><TextField maxLength={120} onChange={(v) => set('city', v)} value={data.city ?? ''} /></Field>
                <Field label="State"><TextField maxLength={120} onChange={(v) => set('stateRegion', v)} value={data.stateRegion ?? ''} /></Field>
                <Field label="Postal code"><TextField maxLength={40} onChange={(v) => set('postalCode', v)} value={data.postalCode ?? ''} /></Field>
                <Field label="Country"><TextField maxLength={80} onChange={(v) => set('country', v)} value={data.country ?? ''} /></Field>
              </div>
            </>
          )}
        </div>
      )}

      {section === 'about' && (
        <div>
          <Field hint="The main story on your page — as long as you want" label="About">
            <TextAreaField maxLength={5000} onChange={(v) => set('aboutContent', v)} rows={8} value={data.aboutContent ?? ''} />
          </Field>
          <Field hint="One item per line" label="Top 5">
            <TextAreaField maxLength={2000} onChange={(v) => set('topFiveContent', v)} placeholder={'e.g.\nFavorite venue in town\nDream collab\n...'} rows={5} value={data.topFiveContent ?? ''} />
          </Field>
          <Field label="Now playing / current mood"><TextField maxLength={240} onChange={(v) => set('nowPlaying', v)} value={data.nowPlaying ?? ''} /></Field>
        </div>
      )}

      {section === 'media' && (
        <div>
          <ImageField label="Avatar" onUpload={(f) => uploadImage('avatarImage', f)} uploading={uploadingField === 'avatarImage'} value={data.avatarImage} />
          <ImageField label="Hero banner" onUpload={(f) => uploadImage('heroImage', f)} uploading={uploadingField === 'heroImage'} value={data.heroImage} />
          <ImageField label="Logo" onUpload={(f) => uploadImage('logoImage', f)} uploading={uploadingField === 'logoImage'} value={data.logoImage} />
          <ImageField label="Gallery cover" onUpload={(f) => uploadImage('galleryImage', f)} uploading={uploadingField === 'galleryImage'} value={data.galleryImage} />
          <Field hint="Link to a video (YouTube, etc.) featured on your page" label="Feature video URL">
            <TextField onChange={(v) => set('featureVideoUrl', v)} placeholder="https://…" value={data.featureVideoUrl ?? ''} />
          </Field>
        </div>
      )}

      {section === 'details' && isArtistOrDj && (
        <div>
          <Field label="Upcoming"><TextAreaField maxLength={5000} onChange={(v) => set('upcomingContent', v)} rows={4} value={data.upcomingContent ?? ''} /></Field>
          <Field label="Tour dates"><TextAreaField maxLength={5000} onChange={(v) => set('tourContent', v)} rows={4} value={data.tourContent ?? ''} /></Field>
          <Field hint="What fans can request from you" label="Requests"><TextAreaField maxLength={5000} onChange={(v) => set('requestContent', v)} rows={3} value={data.requestContent ?? ''} /></Field>
          <Field label="Previous show highlights"><TextAreaField maxLength={5000} onChange={(v) => set('previousShowHighlights', v)} rows={4} value={data.previousShowHighlights ?? ''} /></Field>
          <Field label="Merch link"><TextField onChange={(v) => set('merchUrl', v)} placeholder="https://…" value={data.merchUrl ?? ''} /></Field>
          <Field label="Merch details"><TextAreaField maxLength={5000} onChange={(v) => set('merchContent', v)} rows={3} value={data.merchContent ?? ''} /></Field>
        </div>
      )}

      {section === 'details' && isVenue && (
        <div>
          <Field label="Hours"><TextAreaField maxLength={500} onChange={(v) => set('hoursText', v)} rows={3} value={data.hoursText ?? ''} /></Field>
          <Field label="Parking details"><TextAreaField maxLength={1000} onChange={(v) => set('parkingDetails', v)} rows={3} value={data.parkingDetails ?? ''} /></Field>
          <Field label="Stay recommendations"><TextAreaField maxLength={1000} onChange={(v) => set('stayRecommendations', v)} rows={3} value={data.stayRecommendations ?? ''} /></Field>
        </div>
      )}

      {section === 'presskit' && isArtistOrDj && (
        <div>
          <p style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', margin: '0 0 16px', lineHeight: 1.55 }}>
            Your press kit is a shareable one-pager for bookers, venues, and press — it pulls your name, bio,
            photos, and upcoming shows automatically, plus everything you add here.
          </p>
          <Field hint="One punchy line describing your act, shown at the top of your press kit" label="Tagline">
            <TextField maxLength={200} onChange={(v) => updatePressKit({ tagline: v })} placeholder="e.g. High-voltage synth-punk from Portland, ME" value={kitTagline} />
          </Field>
          <Field hint={'One per line, quote first: The best live act in Maine — Portland Phoenix'} label="Press quotes">
            <TextAreaField maxLength={4000} onChange={(v) => updatePressKit({ quotesText: v })} placeholder={'Their set stole the whole festival — Dispatch Magazine\nA must-see live act — WCYY'} rows={4} value={kitQuotesText} />
          </Field>
          <Field hint="One per line — festival slots, chart placements, radio play, notable supports" label="Achievements & highlights">
            <TextAreaField maxLength={4000} onChange={(v) => updatePressKit({ achievementsText: v })} placeholder={'Opened for [headliner], 2026\n#1 on WMPG local charts'} rows={4} value={kitAchievementsText} />
          </Field>
          <Field hint="Where bookers and press should reach you" label="Booking / press contact email">
            <TextField maxLength={200} onChange={(v) => updatePressKit({ contactEmail: v })} placeholder="booking@yourdomain.com" value={kitContactEmail} />
          </Field>
          <a
            className="settings-btn settings-btn-ghost"
            href={`/artists/${data.slug}/epk`}
            rel="noreferrer"
            style={{ display: 'inline-block' }}
            target="_blank"
          >
            View press kit ↗
          </a>
          <p style={{ fontSize: 12, color: 'rgba(240,235,229,.45)', margin: '10px 0 0' }}>
            Save your changes first — the press kit page prints cleanly to PDF for sharing.
          </p>
        </div>
      )}

      {section === 'theme' && (
        <div>
          <Field hint="Sets the overall look of your public page" label="Design preset">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {profileDesignPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('themePreset', p.id)}
                  style={{
                    padding: 12, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${data.themePreset === p.id ? p.accent : 'rgba(255,255,255,.08)'}`,
                    background: p.panel,
                  }}
                  type="button"
                >
                  <div style={{ width: '100%', height: 32, borderRadius: 8, background: p.hero, marginBottom: 8 }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{p.label}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field hint="Override the preset's accent color, or leave it on Preset" label="Accent tone">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profileAccentTones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set('themeAccentTone', t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, cursor: 'pointer',
                    border: `1px solid ${data.themeAccentTone === t.id || (!data.themeAccentTone && t.id === 'preset') ? (t.accent ?? preset.accent) : 'rgba(255,255,255,.08)'}`,
                    background: 'rgba(255,255,255,.03)', color: 'var(--ink)', fontSize: 12,
                  }}
                  type="button"
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.accent ?? preset.accent, display: 'inline-block' }} />
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field hint="Override the preset's backdrop, or leave it on Preset" label="Backdrop tone">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profileBackdropTones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set('themeBackdropTone', t.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 9999, cursor: 'pointer', fontSize: 12, color: 'var(--ink)',
                    border: `1px solid ${data.themeBackdropTone === t.id || (!data.themeBackdropTone && t.id === 'preset') ? (t.border ?? preset.border) : 'rgba(255,255,255,.08)'}`,
                    background: t.panel ?? preset.panel,
                  }}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ marginTop: 8, padding: 20, borderRadius: 16, background: backdropTone.hero ?? preset.hero, border: `1px solid ${backdropTone.border ?? preset.border}` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: preset.muted, marginBottom: 6 }}>Preview</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: accentTone.accent ?? preset.accent }}>{data.name || 'Your page'}</div>
          </div>
        </div>
      )}

      {section === 'ai' && (
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'rgba(240,235,229,.35)', marginBottom: 14,
          }}>
            AI PAGE STUDIO
          </div>
          <p style={{ fontSize: 13, color: 'rgba(240,235,229,.6)', margin: '0 0 16px', lineHeight: 1.55 }}>
            Tell the AI what you want and it reorganizes your page — bio, links, sections, theme. It only works
            with content you&rsquo;ve already added, and nothing changes until you apply and save.
          </p>

          {!isFan && (
            <div style={{
              border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px',
              background: 'rgba(255,255,255,.02)', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                Import from your website
              </div>
              <p style={{ fontSize: 12, color: 'rgba(240,235,229,.5)', margin: '0 0 10px', lineHeight: 1.5 }}>
                Already have a site? Paste the address and the AI pulls your bio, links, and details into your
                iHYPE page. You review everything before it&rsquo;s applied.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  inputMode="url"
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runWebsiteImport(); } }}
                  placeholder="https://yourband.com"
                  style={{ ...inputStyle, flex: '1 1 220px' }}
                  type="url"
                  value={importUrl}
                />
                <button
                  className="settings-btn settings-btn-ghost"
                  disabled={importBusy || !importUrl.trim()}
                  onClick={runWebsiteImport}
                  style={{ flexShrink: 0 }}
                  type="button"
                >
                  {importBusy ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              'Organize my links by importance',
              'Tighten my bio',
              'Write my About section from my bio',
              ...(isArtistOrDj ? ['Polish my tour and merch sections'] : []),
              ...(isVenue ? ['Clean up my hours and parking info'] : []),
              'Give my page a moodier late-night look',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => setAiPrompt(chip)}
                style={{
                  fontSize: 12, padding: '7px 13px', borderRadius: 9999, cursor: 'pointer',
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)',
                  color: 'rgba(240,235,229,.65)', fontFamily: 'var(--font-body)',
                }}
                type="button"
              >
                {chip}
              </button>
            ))}
          </div>

          <TextAreaField
            maxLength={500}
            onChange={setAiPrompt}
            placeholder="e.g. Reorder my links so streaming comes first, and rewrite my bio to sound bigger"
            rows={3}
            value={aiPrompt}
          />
          <button
            className="settings-btn settings-btn-accent"
            disabled={aiBusy || !aiPrompt.trim()}
            onClick={runAiRefine}
            style={{ width: '100%', marginTop: 12, padding: '13px', fontSize: 14 }}
            type="button"
          >
            {aiBusy ? 'Thinking…' : 'Customize with AI'}
          </button>

          {aiError && <p style={{ color: '#ff5029', fontSize: 13, marginTop: 14 }}>{aiError}</p>}
          {aiApplied && (
            <p style={{ color: '#22e5d4', fontSize: 13, fontFamily: 'var(--font-mono)', marginTop: 14 }}>
              ✓ Applied — review the sections, then hit Save changes.
            </p>
          )}

          {aiProposed && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'rgba(240,235,229,.35)', marginBottom: 12,
              }}>
                PROPOSED CHANGES · {Object.keys(aiProposed).length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(aiProposed).map(([field, value]) => (
                  <div key={field} style={{
                    border: '1px solid rgba(255,80,41,.25)', borderRadius: 12, padding: '12px 14px',
                    background: 'rgba(255,80,41,.05)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                      {AI_FIELD_LABELS[field] ?? field}
                    </div>
                    <div style={{
                      fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                      maxHeight: 140, overflowY: 'auto',
                    }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  className="settings-btn settings-btn-accent"
                  onClick={applyAiChanges}
                  style={{ flex: 1, padding: '12px', fontSize: 14 }}
                  type="button"
                >
                  Apply changes
                </button>
                <button
                  className="settings-btn settings-btn-ghost"
                  onClick={() => setAiProposed(null)}
                  style={{ padding: '12px 18px', fontSize: 14 }}
                  type="button"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: '#ff5029', fontSize: 13, marginTop: 16 }}>{error}</p>}
      {savedAt && !error && <p style={{ color: '#22e5d4', fontSize: 13, fontFamily: 'var(--font-mono)', marginTop: 16 }}>✓ Saved</p>}

      <button
        className="settings-btn settings-btn-accent"
        disabled={saving}
        onClick={save}
        style={{ width: '100%', marginTop: 8, padding: '14px', fontSize: 15 }}
        type="button"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
