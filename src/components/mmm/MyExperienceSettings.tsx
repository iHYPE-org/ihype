'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { defaultExperience, type ExperiencePreferences } from '@/lib/member-experience';
import { useI18n } from '@/components/I18nProvider';

const presets = [
  { id: 'standard', label: 'Standard', hint: 'Everything in the familiar layout' },
  { id: 'simple', label: 'Simple', hint: 'Less clutter and fewer optional sections' },
  { id: 'music', label: 'Music First', hint: 'Prioritize music and discovery' },
  { id: 'events', label: 'Events First', hint: 'Prioritize shows and venues' },
] as const;
const sections = [
  { id: 'music', label: 'Music & artists' },
  { id: 'events', label: 'Shows & events' },
  { id: 'discover', label: 'Discover' },
  { id: 'community', label: 'Community interactions' },
  { id: 'creator', label: 'Creator tools' },
] as const;

export function MyExperienceSettings() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<ExperiencePreferences>(defaultExperience);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/me/experience', { cache: 'no-store' }).then(async (r) => {
      if (!r.ok) throw new Error('Unable to load your preferences.');
      return r.json();
    }).then((v) => { if (active) setPrefs(v.preferences); }).catch(() => { if (active) setMessage('Could not load your saved preferences.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function applyPreset(id: ExperiencePreferences['preset']) {
    setPrefs((old) => ({
      ...old, preset: id,
      navigation: id === 'simple' ? { music: true, events: true, discover: false, community: false, creator: false }
        : id === 'music' ? { music: true, events: false, discover: true, community: false, creator: false }
        : id === 'events' ? { music: false, events: true, discover: false, community: false, creator: false }
        : defaultExperience.navigation,
    }));
  }
  async function save(value: ExperiencePreferences) {
    setSaving(true); setMessage('');
    try {
      const r = await fetch('/api/me/experience', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      if (!r.ok) throw new Error('Unable to save your settings.');
      setPrefs(value);
      window.dispatchEvent(new Event('ihype-experience-updated'));
      setMessage('Experience settings saved.');
    } catch { setMessage('Could not save. Please try again.'); }
    finally { setSaving(false); }
  }
  return <main className="settings-page settings-col" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
    <Link href="/app/me/settings">← {t('myExperience.back', 'Settings')}</Link>
    <h1>{t('myExperience.title', 'Appearance & Experience')}</h1>
    <p>{t('myExperience.intro', 'Personalize only your own iHYPE interface. Nothing here changes your public identity or deletes your content.')}</p>
    {loading ? <p role="status">Loading preferences…</p> : <>
      <fieldset><legend>Choose your starting layout</legend>
        {presets.map((item) => <label key={item.id} style={{ display: 'block', padding: 12 }}>
          <input type="radio" name="experience-preset" checked={prefs.preset === item.id} onChange={() => applyPreset(item.id)} />
          <strong> {item.label}</strong> — {item.hint}
        </label>)}
      </fieldset>
      <fieldset><legend>Show these optional navigation sections</legend>
        <p>Home, Me, Settings, tickets, purchases, security, privacy and important notices always remain accessible. Hiding a shortcut never deletes content.</p>
        {sections.map((item) => <label key={item.id} style={{ display: 'block', padding: 12 }}>
          <input type="checkbox" checked={prefs.navigation[item.id]} onChange={(e) => setPrefs((p) => ({ ...p, navigation: { ...p.navigation, [item.id]: e.target.checked } }))} /> {item.label}
        </label>)}
      </fieldset>
      <fieldset><legend>Display and accessibility</legend>
        <label style={{ display: 'block', padding: 12 }}>Accent color <select value={prefs.accent} onChange={(e) => setPrefs((p) => ({ ...p, accent: e.target.value as ExperiencePreferences['accent'] }))}>
          <option value="default">Default</option><option value="cyan">Cyan</option><option value="violet">Violet</option><option value="amber">Amber</option>
        </select></label>
        <label style={{ display: 'block', padding: 12 }}>Layout density <select value={prefs.density} onChange={(e) => setPrefs((p) => ({ ...p, density: e.target.value as ExperiencePreferences['density'] }))}>
          <option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="spacious">Spacious</option>
        </select></label>
        {([['contrast', 'High contrast'], ['reducedMotion', 'Reduced motion'], ['largeText', 'Larger text']] as const).map(([key, label]) => <label key={key} style={{ display: 'block', padding: 12 }}>
          <input type="checkbox" checked={prefs[key]} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))} /> {label}
        </label>)}
      </fieldset>
      <section aria-label="Navigation preview" style={{ border: '1px solid var(--hair-100)', padding: 16, borderRadius: 12 }}>
        <h2>Navigation preview</h2><p>Home · {sections.filter((s) => prefs.navigation[s.id]).map((s) => s.label).join(' · ')} · Me · Settings</p>
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <button type="button" className="settings-btn" disabled={saving} onClick={() => void save(prefs)}>{saving ? 'Saving…' : 'Save experience'}</button>
        <button type="button" className="settings-btn settings-btn-ghost" disabled={saving} onClick={() => void save(defaultExperience)}>Restore default experience</button>
      </div>
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </main>;
}
