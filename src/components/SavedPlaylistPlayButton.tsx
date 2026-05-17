'use client';

export function SavedPlaylistPlayButton({
  id,
  title,
  artist
}: {
  id: string;
  title: string;
  artist: string;
}) {
  return (
    <button
      type="button"
      className="button small secondary"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('ihype:play', { detail: { id, title, artist } })
        );
      }}
    >
      Play
    </button>
  );
}
