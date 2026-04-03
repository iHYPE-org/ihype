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

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage('Choose an audio or video file first.');
      return;
    }

    const formData = new FormData();
    formData.set('profileId', profileId);
    formData.set('title', title);
    formData.set('notes', notes);
    formData.set('file', file);

    setPending(true);

    try {
      const response = await fetch('/api/artist-media', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? 'Could not upload this media item.');
        return;
      }

      setTitle('');
      setNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setMessage(`Uploaded ${data.asset.title}. Share ID: ${data.asset.hexId}`);
      router.refresh();
    } catch {
      setMessage('Could not upload this media item.');
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
        <span className="meta">Audio 10MB max / Video 16MB max</span>
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
            placeholder="Version notes, video notes, live room details, or release context."
            rows={3}
            value={notes}
          />
        </label>

        <label className="field">
          <span>Media file</span>
          <input accept="audio/*,video/*" ref={fileInputRef} required type="file" />
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
