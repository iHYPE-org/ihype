# Audio quality: what was measured, what shipped, what was refused

Written 2026-09-09, after a pass over everything between an artist's file and a
listener's speaker. Four findings, three shipped, one deliberately not. This
document exists for the fourth: a decision not to build something leaves no
code behind, so the next session re-derives it from scratch unless the
reasoning is written down.

## The shape of the path

An upload is magic-byte sniffed, header-parsed for duration, scanned by the
four vetting layers, stored in R2, and served to `<audio>` through
`/cdn/[...key]`. Nothing between those steps looked at the audio as audio.

---

## 1. Loudness — SHIPPED

**The defect.** Uploads arrive at whatever level the artist's own chain
produced. A mastered single sits near -8 LUFS; a bedroom bounce near -20. The
station plays them back to back, so the listener reaches for the volume control
every third track. That is the most audible quality defect this product has,
and nothing in the pipeline measured it.

**What shipped.** ITU-R BS.1770-4 programme loudness, measured in the
uploader's browser from `decodeAudioData` output, stored on the track, applied
at playback — as an attenuation of the member's own volume for a loud track,
and as Web Audio gain for a quiet one.

**Tracks that predate it are measured too.** Levelling at upload reaches only
what is uploaded afterwards, so every track already in the library would have
played un-levelled forever — real and inert. There is no server-side backfill
available at all (the Worker cannot decode), so `LoudnessMeasureButton` in the
Media section does it on the artist's own machine, one track at a time,
disappearing once every track carries a reading.

- `src/lib/loudness.ts` — the arithmetic. Pure, imports nothing, so the unit
  suite drives it against the standard's own calibration: a 1 kHz sine reads
  its own dBFS level as LUFS, at 44.1, 48 and 96 kHz. K-weighting coefficients
  are derived per sample rate rather than copied from the 48 kHz table, because
  a 48 kHz table applied to a 44.1 kHz file mis-weights the spectrum and still
  produces a plausible number.
- `src/lib/measure-upload-loudness.ts` — the browser half. Every failure
  returns null.
- `src/lib/track-gain.ts` — target, clamps, and the floor on attenuation.
- `ArtistMediaAsset.loudnessLufs` / `peakDbfs`, migration
  `20260909160000_add_audio_shape_and_loudness`.

**Why the browser.** The Worker gets 128 MB and 1500 ms of CPU, and K-weighting
a five-minute stereo master is hundreds of millions of multiply-accumulates
over PCM that only exists after a decode the Worker cannot perform. The
uploader's machine already has the file.

**Why a client-reported number is safe, which is the load-bearing part.**
Playback only ever ATTENUATES. A track measured louder than target is turned
down; a track measured quieter is left alone; so is a track nobody measured.
Therefore under-reporting your own loudness buys exactly what *not measuring*
already buys — nothing — and over-reporting only makes you quieter. There is no
lie that wins. That is a stronger guarantee than any server-side check this
product could afford, and it is the reason to keep the attenuation-only rule
even when boost becomes possible.

**Boost — added 2026-09-09, and it changes the guarantee above.** A quiet
upload no longer stays quiet: `resolvePlaybackGain()` lifts it through a Web
Audio `GainNode`, because `HTMLMediaElement.volume` is capped at 1. **This
weakens the "no lie wins" property and the weakening is bounded, not
eliminated** — under-reporting can now buy up to `MAX_BOOST_DB` (6 dB). Three
things hold it there, and none of them is a server-side check, because the
Worker still cannot decode audio to verify anything:

- the cap is small, and no real recording needing more than 6 dB survives it
  sounding good;
- **a track is boosted only as far as its own reported true peak allows**
  (`TRUE_PEAK_CEILING_DBTP`, -1 dBTP), so a loud master claiming -30 LUFS gets
  nothing unless it also lies about its peak;
- a track with no true peak is **never** boosted. Guessing at headroom is how
  a boost clips.

The attenuation half must never come to depend on the boost half. That is why
`resolvePlaybackGain()` returns the two separately: attenuation rides on the
element and works everywhere, boost needs the graph and is allowed to be
absent.

**The graph has three properties that are not optional**, all in
`GlobalMediaPlayer`'s own comment: `createMediaElementSource` may be called
once per element for the life of the page and cannot be un-routed; a
cross-origin element routed through Web Audio without CORS yields **silence**,
not an error, so the graph is safe only while every audio URL is same-origin
(asserted in `wiring-guards.test.ts`, verified by breaking it); and any throw
sets a flag and is never retried, leaving the element exactly as it was.

**True peak** is measured at 4x oversampling per BS.1770-4 Annex 2, but not as
a second full pass — interpolating every sample of a five-minute master
through a 48-tap kernel is hundreds of millions of operations in a phone
browser for one number. Only the neighbourhoods of the loudest samples are
oversampled, since the peak cannot be near a sample that is not; a limited
master that puts tens of thousands of samples on the ceiling is strided to a
bound. The test that matters is a sine sampled off its crests: samples read
-3.01 dBFS, the waveform reaches 0 dBTP.

**Two things a later edit will want to undo and must not.** The gain is a
*multiplier* of the member's volume, never a replacement, or the volume slider
stops working on levelled tracks. And an ad break is never levelled: a spot is
levelled by whoever cut it, and attenuating it against a music target
under-delivers what the advertiser bought.

---

## 2. Byte ranges — SHIPPED

**The defect.** `/cdn/[...key]` served whole objects and advertised no
`Accept-Ranges`. A media element seeks by asking for a byte range, so a
listener scrubbing a 60 MB lossless master re-downloaded it from the top, and
some players will not begin at all until they can probe the first bytes.

**What shipped.** `src/lib/http-range.ts` plus 206/416 handling in the route.
The case worth knowing: `bytes=-N` is a SUFFIX — the last N bytes, not the
first N. Reading it the other way serves the wrong audio and still looks like a
working 206, which is a bug that plays as a glitch nobody reports.

---

## 3. Transcoding — DELIBERATELY NOT BUILT

**The idea.** Serve a compressed stream to a listener on cellular instead of
the original, so a 60 MB FLAC does not cost 60 MB of someone's data plan.

**Why not.** There is nowhere to run an encoder.

- The Worker cannot: 128 MB and 1500 ms, no ffmpeg, no WASM build small enough
  to sit inside a budgeted bundle beside the app.
- There is no job queue. The repository has no background worker of any kind —
  the upload scan pipeline is synchronous for exactly this reason (see
  `TrackUploadPanel`'s note about the design spec's async job contract).
- Client-side encode via WebCodecs was evaluated and is the only option that
  fits the architecture: the browser already has the decoded PCM for the
  loudness pass, and `AudioEncoder` could produce an AAC sibling to upload
  alongside the original. It is not shippable from here blind — codec support
  varies by browser and platform, the output has to be verified playable on
  both Safari and Chromium before anything is served from it, and getting it
  wrong means uploads that store a file nobody can play.

**What makes it decidable.** Finding 4 below now records codec, sample rate,
channels and bit depth on every new upload. Until that data exists there was no
way to know how much of the library is even large enough to be worth
transcoding — the answer might be "three tracks". Revisit when the columns have
real rows in them, and let the numbers decide whether the WebCodecs project is
worth its risk.

**A cheaper thing that is NOT this**: range support (finding 2) already means a
listener who skips a track after ten seconds pays for ten seconds, not for
60 MB. That was the larger share of the waste.

---

## 4. Audio shape — SHIPPED

**The defect.** The upload path parsed each file's header to compute duration
and threw the rest away. Nothing downstream could tell a 96 kHz 24-bit master
from a 22 kHz mono phone recording without fetching the file again.

**What shipped.** `describeAudio()` in `src/lib/audio-duration.ts` returns
codec, duration, sample rate, channels and bit depth from one header read;
`parseAudioDuration()` is now a thin wrapper so no caller changed. Four new
nullable columns persist it.

**The rule the tests enforce.** Every field is nullable and a null means
UNREAD, never a default. A file we could not parse must not read as
44.1 kHz/16-bit stereo, and an AAC stream gets `bitDepth: null` rather than the
16 every encoder writes into the `mp4a` template — echoing that back would be
inventing a fact about the recording.
