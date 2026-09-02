import { describe, expect, it } from 'vitest';
import { validateArtistMediaUpload } from '@/lib/media-validation';

function upload(name: string, type: string): File {
  return { name, type } as File;
}

describe('artist media validation', () => {
  it('accepts supported audio files', () => {
    expect(validateArtistMediaUpload(upload('track.mp3', 'audio/mpeg'))).toBeNull();
    expect(validateArtistMediaUpload(upload('master.flac', 'audio/flac'))).toBeNull();
  });

  it('rejects every video upload', () => {
    expect(validateArtistMediaUpload(upload('clip.mp4', 'video/mp4'))).toBe(
      'Only audio files can be uploaded. iHYPE does not host video.',
    );
  });

  it('rejects disguised and unsafe audio files', () => {
    expect(validateArtistMediaUpload(upload('track.mp4', 'audio/mpeg'))).toBe(
      'That file type does not play everywhere iHYPE does. Upload MP3, AAC/M4A, WAV or FLAC.',
    );
    expect(validateArtistMediaUpload(upload('bad?.mp3', 'audio/mpeg'))).toContain('unsafe characters');
  });
});
