'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AvatarOption = {
  id: string;
  label: string;
  avatarImage: string;
  revisedPrompt: string | null;
};

type ListenerAvatarCreatorProps = {
  profileId: string;
  profileName: string;
  defaultPrompt: string;
  initialAvatarImage: string | null;
};

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
  profileName,
  defaultPrompt,
  initialAvatarImage
}: ListenerAvatarCreatorProps) {
  const router = useRouter();
  const [styleNote, setStyleNote] = useState('');
  const [avatarImage, setAvatarImage] = useState(initialAvatarImage);
  const [options, setOptions] = useState<AvatarOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;
  const previewImage = selectedOption?.avatarImage ?? avatarImage;

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch('/api/listener-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        prompt: styleNote,
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
        avatarImage: selectedOption.avatarImage
      })
    });

    const data = await response.json();

    if (response.ok) {
      setAvatarImage(data.avatarImage ?? selectedOption.avatarImage);
      setMessage('Avatar updated.');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not save this avatar');
    }

    setPending(false);
  }

  return (
    <section className="panel avatar-creator">
      <div className="avatar-creator-header">
        <div className="avatar-creator-preview">
          {previewImage ? (
            <img alt={`${profileName} avatar`} className="profile-avatar profile-avatar-large" src={previewImage} />
          ) : (
            <div className="profile-avatar profile-avatar-large profile-avatar-fallback">{getInitials(profileName)}</div>
          )}
        </div>
        <div>
          <h2>AI avatar builder</h2>
          <p className="kicker">
            Generate a few simple random cartoon characters, preview them live, and save the one that feels right.
          </p>
        </div>
      </div>

      <form className="form" onSubmit={handleGenerate}>
        <label className="field">
          <span>Style note (optional)</span>
          <textarea
            onChange={(event) => setStyleNote(event.target.value)}
            placeholder={defaultPrompt}
            rows={4}
            value={styleNote}
          />
        </label>

        <div className="cta-row">
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Generating...' : 'Generate choices'}
          </button>
          <button
            className="button small secondary"
            onClick={() => setStyleNote('')}
            type="button"
          >
            Clear note
          </button>
          <button
            className="button small secondary"
            disabled={!selectedOption || pending}
            onClick={handleSaveSelection}
            type="button"
          >
            Save selected avatar
          </button>
          {message ? <span className="meta">{message}</span> : null}
        </div>
      </form>

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
                <span>{option.id === selectedOptionId ? 'Selected' : 'Choose'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
