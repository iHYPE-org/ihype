'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { shortenHexId } from '@/lib/hex-id';

type AvatarOption = {
  id: string;
  label: string;
  avatarImage: string;
  revisedPrompt: string | null;
};

type ListenerAvatarCreatorProps = {
  profileId: string;
  profileHexId: string;
  profileName: string;
  defaultPrompt: string;
  initialAvatarImage: string | null;
};

const avatarStylePresets = [
  {
    id: 'night-runner',
    label: 'Night Runner',
    description: 'Neon city energy and kinetic club color.',
    prompt: 'Animated nightlife character, neon club palette, sleek silhouette, cinematic lighting.'
  },
  {
    id: 'soft-pop',
    label: 'Soft Pop',
    description: 'Rounded lines, pastel glow, friendly expression.',
    prompt: 'Cute animated character, soft shapes, pastel glow, playful but polished finish.'
  },
  {
    id: 'future-rave',
    label: 'Future Rave',
    description: 'Sharper styling with bold stage attitude.',
    prompt: 'Futuristic animated concert character, bold styling, rave-ready look, high-contrast accents.'
  }
] as const;

const avatarMoodOptions = [
  { id: 'dreamy', label: 'Dreamy', prompt: 'dreamy, gentle, imaginative mood' },
  { id: 'electric', label: 'Electric', prompt: 'electric, energetic, hype-driven mood' },
  { id: 'cool', label: 'Cool', prompt: 'cool, effortless, understated confidence' },
  { id: 'joyful', label: 'Joyful', prompt: 'joyful, bright, fan-first excitement' }
] as const;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ListenerAvatarCreator({
  profileId,
  profileHexId,
  profileName,
  defaultPrompt,
  initialAvatarImage
}: ListenerAvatarCreatorProps) {
  const router = useRouter();
  const [characterPhrase, setCharacterPhrase] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<(typeof avatarStylePresets)[number]['id']>('night-runner');
  const [selectedMoodId, setSelectedMoodId] = useState<(typeof avatarMoodOptions)[number]['id']>('electric');
  const [avatarImage, setAvatarImage] = useState(initialAvatarImage);
  const [options, setOptions] = useState<AvatarOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPreset = avatarStylePresets.find((preset) => preset.id === selectedPresetId) ?? avatarStylePresets[0];
  const selectedMood = avatarMoodOptions.find((mood) => mood.id === selectedMoodId) ?? avatarMoodOptions[0];
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;
  const previewImage = selectedOption?.avatarImage ?? avatarImage;
  const generationPrompt = [characterPhrase.trim(), selectedPreset.prompt, selectedMood.prompt]
    .filter(Boolean)
    .join(' ');

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch('/api/listener-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        prompt: generationPrompt,
        variantCount: 4
      })
    });

    const data = await response.json();

    if (response.ok) {
      const nextOptions = (data.options ?? []) as AvatarOption[];
      setOptions(nextOptions);
      setSelectedOptionId(nextOptions[0]?.id ?? null);
      setMessage(nextOptions.length ? 'Choose the cartoon avatar you want to keep.' : 'No avatar options came back.');
    } else {
      setMessage(data.error ?? 'Could not generate avatar');
    }

    setPending(false);
  }

  async function handleSaveSelection() {
    if (!selectedOption) {
      setMessage('Pick an avatar option first.');
      return;
    }

    setPending(true);
    setMessage(null);

    const response = await fetch('/api/listener-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        profileId,
        profileHexId,
        avatarImage: selectedOption.avatarImage
      })
    });

    const data = await response.json();

    if (response.ok) {
      setAvatarImage(data.avatarImage ?? selectedOption.avatarImage);
      setMessage(`Animated avatar saved to ${shortenHexId(data.fanHexId ?? profileHexId)} for future fan interactions.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not save this avatar');
    }

    setPending(false);
  }

  return (
    <section className="panel avatar-creator">
      <div className="avatar-creator-header">
        <div>
          <h2>Animated fan character lab</h2>
          <p className="kicker">
            Write the fan energy you want, choose a look preset and mood, then preview a few animated character renders before saving one to your fan ID.
          </p>
          <p className="meta">Fan ID: {profileHexId}</p>
        </div>
      </div>

      <div className="avatar-creator-lab">
        <div className="avatar-creator-stage">
          <div className="avatar-creator-stage-topline">
            <span className="badge">Live preview</span>
            <span className="avatar-creator-stage-id">{shortenHexId(profileHexId)}</span>
          </div>

          <div className="avatar-creator-stage-frame">
            {previewImage ? (
              <img alt={`${profileName} avatar`} className="avatar-creator-stage-image" src={previewImage} />
            ) : (
              <div className="profile-avatar profile-avatar-fallback avatar-creator-stage-fallback">
                {getInitials(profileName)}
              </div>
            )}
          </div>

          <div className="avatar-creator-stage-meta">
            <strong>{profileName}</strong>
            <p>{characterPhrase.trim() || defaultPrompt}</p>
            <div className="avatar-creator-chip-row">
              <span className="avatar-creator-chip">{selectedPreset.label}</span>
              <span className="avatar-creator-chip">{selectedMood.label}</span>
              {selectedOption ? <span className="avatar-creator-chip">Selected render</span> : null}
            </div>
          </div>
        </div>

        <form className="form avatar-creator-controls" onSubmit={handleGenerate}>
          <label className="field">
            <span>Character phrase</span>
            <textarea
              onChange={(event) => setCharacterPhrase(event.target.value)}
              placeholder={defaultPrompt}
              rows={4}
              value={characterPhrase}
            />
          </label>

          <div className="avatar-creator-section">
            <div className="avatar-creator-section-head">
              <strong>Look preset</strong>
              <span className="meta">{selectedPreset.description}</span>
            </div>
            <div className="avatar-preset-grid">
              {avatarStylePresets.map((preset) => (
                <button
                  className={preset.id === selectedPresetId ? 'avatar-preset-card active' : 'avatar-preset-card'}
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  type="button"
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="avatar-creator-section">
            <div className="avatar-creator-section-head">
              <strong>Mood</strong>
            </div>
            <div className="avatar-mood-row">
              {avatarMoodOptions.map((mood) => (
                <button
                  className={mood.id === selectedMoodId ? 'avatar-mood-chip active' : 'avatar-mood-chip'}
                  key={mood.id}
                  onClick={() => setSelectedMoodId(mood.id)}
                  type="button"
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Generating...' : 'Generate animated avatars'}
            </button>
            <button
              className="button small secondary"
              onClick={() => setCharacterPhrase('')}
              type="button"
            >
              Clear phrase
            </button>
            <button
              className="button small secondary"
              disabled={!selectedOption || pending}
              onClick={handleSaveSelection}
              type="button"
            >
              Save to fan ID
            </button>
          </div>

          {message ? <span className="meta">{message}</span> : null}
          {selectedOption?.revisedPrompt ? (
            <div className="avatar-creator-notes">
              <span>OpenAI render note</span>
              <p>{selectedOption.revisedPrompt}</p>
            </div>
          ) : null}
        </form>
      </div>

      {options.length ? (
        <div className="avatar-option-grid">
          {options.map((option) => (
            <button
              className={option.id === selectedOptionId ? 'avatar-option-card active' : 'avatar-option-card'}
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              type="button"
            >
              <img alt={`${option.label} avatar option`} className="avatar-option-image" src={option.avatarImage} />
              <div className="avatar-option-meta">
                <strong>{option.label}</strong>
                <span>{option.id === selectedOptionId ? `Selected for ${shortenHexId(profileHexId)}` : 'Choose'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
