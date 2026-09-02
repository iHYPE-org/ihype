import { PLAYABLE_AUDIO_FORMATS_LABEL } from '@/lib/validate-upload';

/* The extensions of the formats every iHYPE player decodes — see the note at
   the top of validate-upload.ts. Ogg, AIFF and WebM were in this set and are
   deliberately out: each plays on one of the two players and not the other. */
const audioExtensions = new Set(['aac', 'flac', 'm4a', 'mp3', 'wav']);

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function validateArtistMediaUpload(file: File) {
  const extension = getFileExtension(file.name || '');

  if (!file.type.startsWith('audio/')) {
    return 'Only audio files can be uploaded. iHYPE does not host video.';
  }

  if (file.type.startsWith('audio/') && extension && !audioExtensions.has(extension)) {
    return `That file type does not play everywhere iHYPE does. Upload ${PLAYABLE_AUDIO_FORMATS_LABEL}.`;
  }

  if (/[<>:"\\|?*\u0000-\u001f]/.test(file.name)) {
    return 'Rename this file before uploading. File names cannot contain unsafe characters.';
  }

  return null;
}
