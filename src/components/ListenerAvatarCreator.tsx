'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { shortenHexId } from '@/lib/hex-id';

type AvatarOption = {
  id: string;
  label: string;
  description: string | null;
  avatarImage: string;
  spriteSheetImage: string | null;
  spritePrompt: string | null;
  revisedPrompt: string | null;
};

type ListenerAvatarCreatorProps = {
  profileId: string;
  profileHexId: string;
  profileName: string;
  defaultPrompt: string;
  initialAvatarImage: string | null;
  initialSpriteSheet?: string | null;
  defaultOpen?: boolean;
  hideToggle?: boolean;
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
  initialAvatarImage,
  initialSpriteSheet = null,
  defaultOpen = false,
  hideToggle = false
}: ListenerAvatarCreatorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [characterPhrase, setCharacterPhrase] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<(typeof avatarStylePresets)[number]['id']>('night-runner');
  const [selectedMoodId, setSelectedMoodId] = useState<(typeof avatarMoodOptions)[number]['id']>('electric');
  const [avatarImage, setAvatarImage] = useState(initialAvatarImage);
  const [spriteSheetImage, setSpriteSheetImage] = useState(initialSpriteSheet);
  const [options, setOptions] = useState<AvatarOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPreset = avatarStylePresets.find((preset) => preset.id === selectedPresetId) ?? avatarStylePresets[0];
  const selectedMood = avatarMoodOptions.find((mood) => mood.id === selectedMoodId) ?? avatarMoodOptions[0];
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;
  const previewImage = selectedOption?.avatarImage ?? avatarImage;
  const previewSpriteSheet = selectedOption?.spriteSheetImage ?? spriteSheetImage;
  const generationPrompt = [characterPhrase.trim(), selectedPreset.prompt, selectedMood.prompt]
    .filter(Boolean)
    .join(' ');
  const compactStatus = selectedOption
    ? 'Draft sprite companion selected and ready to save.'
    : spriteSheetImage
      ? 'Saved sprite companion is attached to this fan page.'
      : avatarImage
        ? 'Saved character preview is attached to this fan page.'
        : 'No page companion saved yet.';

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
      setMessage(
        data.notice ??
          (nextOptions.length ? 'Choose the cartoon avatar you want to keep.' : 'No avatar options came back.')
      );
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
        avatarImage: selectedOption.avatarImage,
        spritePrompt: selectedOption.spritePrompt,
        spriteSheetImage: selectedOption.spriteSheetImage ?? undefined
      })
    });

    const data = await response.json();

    if (response.ok) {
      setAvatarImage(data.avatarImage ?? selectedOption.avatarImage);
      setSpriteSheetImage(data.companionSpriteSheet ?? selectedOption.spriteSheetImage ?? null);
      setMessage(`Sprite companion saved to ${shortenHexId(data.fanHexId ?? profileHexId)} for future fan interactions.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not save this avatar');
    }

    setPending(false);
  }

  return (
    <section className="panel avatar-creator">
      <div className="avatar-creator-header avatar-creator-header-compact">
        <div>
          <h2>Animated fan sprite lab</h2>
          <p className="kicker">
            Build a family-friendly AI sprite companion attached to your fan ID.
          </p>
          <p className="meta">Fan ID: {profileHexId}</p>
        </div>
        {!hideToggle ? (
          <button
            className="button small secondary"
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            {isOpen ? 'Minimize lab' : 'Open lab'}
          </button>
        ) : null}
      </div>

      {!isOpen ? (
        <div className="avatar-creator-collapsed">
          <div className="avatar-creator-collapsed-stage">
            <div className="avatar-creator-stage-glow" />
            {previewImage ? (
              <img alt={`${profileName} avatar`} className="avatar-creator-collapsed-image" src={previewImage} />
            ) : (
              <div className="profile-avatar profile-avatar-fallback avatar-creator-collapsed-fallback">
                {getInitials(profileName)}
              </div>
            )}
          </div>
          <div className="avatar-creator-collapsed-copy">
            <strong>{profileName}</strong>
            <p>{compactStatus}</p>
            <div className="avatar-creator-chip-row">
              <span className="avatar-creator-chip">{selectedPreset.label}</span>
              <span className="avatar-creator-chip">{selectedMood.label}</span>
              <span className="avatar-creator-chip">13+ family-friendly</span>
              {selectedOption ? <span className="avatar-creator-chip">Unsaved render</span> : null}
            </div>
            {message ? <span className="meta">{message}</span> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="avatar-creator-lab">
            <div className="avatar-creator-stage">
              <div className="avatar-creator-stage-topline">
                <span className="badge">Live preview</span>
                <span className="avatar-creator-stage-id">{shortenHexId(profileHexId)}</span>
              </div>

              <div className="avatar-creator-stage-frame">
                <div className="avatar-creator-stage-glow" />
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
                  <span className="avatar-creator-chip">Sprite-ready</span>
                  <span className="avatar-creator-chip">13+ family-friendly</span>
                  {selectedOption ? <span className="avatar-creator-chip">Selected render</span> : null}
                </div>
                {selectedOption?.description ? (
                  <p className="avatar-creator-stage-description">{selectedOption.description}</p>
                ) : null}
                {previewSpriteSheet ? (
                  <div className="avatar-creator-sprite-preview">
                    <span>Saved sprite sheet</span>
                    <img alt={`${profileName} sprite sheet`} className="avatar-creator-sprite-image" src={previewSpriteSheet} />
                  </div>
                ) : selectedOption ? (
                  <div className="avatar-creator-sprite-preview avatar-creator-sprite-preview-empty">
                    <span>Sprite sheet</span>
                    <p>Saving this option will render a matching animated sprite set for your fan page.</p>
                  </div>
                ) : null}
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
                <button
                  className="button"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Generating...' : 'Generate AI sprite options'}
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
                  Save sprite companion
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
                    {option.description ? <p>{option.description}</p> : null}
                    <span>{option.id === selectedOptionId ? `Selected for ${shortenHexId(profileHexId)}` : 'Choose sprite'}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
