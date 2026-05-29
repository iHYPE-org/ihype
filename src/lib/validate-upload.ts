export function validateAudioMagicBytes(buffer: Uint8Array): boolean {
  if (buffer.length < 12) return false;
  // MP3: ID3 tag
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
  // MP3: sync frame
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  // OGG
  if (
    buffer[0] === 0x4f &&
    buffer[1] === 0x67 &&
    buffer[2] === 0x67 &&
    buffer[3] === 0x53
  )
    return true;
  // WAV: RIFF
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  )
    return true;
  // FLAC
  if (
    buffer[0] === 0x66 &&
    buffer[1] === 0x4c &&
    buffer[2] === 0x61 &&
    buffer[3] === 0x43
  )
    return true;
  // MP4/M4A: ftyp at offset 4
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  )
    return true;
  // AAC ADTS
  if (buffer[0] === 0xff && (buffer[1] & 0xf0) === 0xf0) return true;
  return false;
}
