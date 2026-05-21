'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ArtistMediaUploadManagerProps = {
  profileId: string;
};

export function ArtistMediaUploadManager({ profileId }: ArtistMediaUploadManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length === 0) {
      setMessage('Choose an audio file first.');
      return;
    }

    setPending(true);

    try {
      // Parallel uploads — each file gets its own request so partial failures
      // don't block the rest.
      const results = await Promise.allSettled(
        files.map(async (file, index) => {
          const formData = new FormData();
          formData.set('profileId', profileId);
          formData.set('title', files.length === 1 ? title : title ? `${title} ${index + 1}` : '');
          formData.set('notes', notes);
          formData.set('file', file);
          const response = await fetch('/api/artist-media', { method: 'POST', body: formData });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error ?? `Failed: ${file.name}`);
          return data;
        })
      );

      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.length - successes;
      setTitle('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(
        failures > 0
          ? `Uploaded ${successes} of ${results.length}. ${failures} failed.`
          : `Uploaded ${successes} file${successes === 1 ? '' : 's'}.`
      );
      router.refresh();
    } catch {
      setMessage('Could not upload media.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel artist-media-upload-panel">
      <div className="artist-media-upload-header">
        <div>
          <div className="badge">Upload</div>
          <h3>Post media to your page</h3>
          <p className="meta">
            Uploads get a unique hex ID, show up in your public media section, and can be copied into promoter playlists.
          </p>
        </div>
        <span className="meta">Audio files only · 10MB max</span>
      </div>

      <form className="artist-media-upload-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Leave blank to use the file name"
            value={title}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Version notes, live room details, or release context."
            rows={3}
            value={notes}
          />
        </label>

        <label className="field">
          <span>Media file</span>
          <input accept="audio/*" multiple ref={fileInputRef} required type="file" />
        </label>

        <div className="cta-row">
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Uploading...' : 'Upload media'}
          </button>
          {message ? <span className="meta">{message}</span> : null}
        </div>
      </form>
    </section>
  );
}
