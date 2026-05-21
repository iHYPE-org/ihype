import { z } from 'zod';

export const advertisingScopeSchema = z.enum(['local', 'regional', 'national', 'global']);
export const showMediaTypeSchema = z.enum(['audio']);

export const voiceOverCueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  script: z.string().default(''),
  durationSeconds: z.number().min(0).max(3600).optional(),
  cueAfterMediaId: z.string().regex(/^0x[a-f0-9]+$/i).nullable().optional(),
  overdubMediaId: z.string().regex(/^0x[a-f0-9]+$/i).nullable().optional(),
  recordingDataUrl: z.string().min(1).optional(),
  recordingMimeType: z.string().min(1).optional()
}).refine((value) => value.script.trim().length > 0 || Boolean(value.recordingDataUrl), {
  message: 'Voice-over cues need a script or recording.'
});

export const showMediaItemSchema = z.object({
  mediaId: z.string().regex(/^0x[a-f0-9]+$/i),
  title: z.string().min(1),
  url: z.string().min(1),
  artistProfileId: z.string().cuid(),
  artistName: z.string().min(1),
  notes: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  mediaType: showMediaTypeSchema.default('audio'),
  previewImageUrl: z.string().nullable().optional()
});

export const showSamplePadSchema = z.object({
  sampleId: z.string().regex(/^0x[a-f0-9]+$/i),
  title: z.string().min(1),
  url: z.string().min(1),
  notes: z.string().nullable().optional(),
  category: z.enum(['drums', 'voices', 'fx', 'local']).optional(),
  colorHex: z.string().regex(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i).optional(),
  assignedPad: z.number().int().min(1).max(16).optional()
});

export const showSequenceItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['MEDIA', 'VOICE_OVER', 'SAMPLE', 'AD']),
  refId: z.string().min(1),
  label: z.string().min(1)
});

export const showAdClipSchema = z.object({
  clipId: z.string().regex(/^0x[a-f0-9]+$/i),
  title: z.string().min(1),
  url: z.string().min(1),
  scope: advertisingScopeSchema,
  mimeType: z.string().default('audio/mpeg'),
  durationSeconds: z.number().min(0).max(300).optional(),
  notes: z.string().nullable().optional()
});

export const showAdvertisingPlanSchema = z.object({
  enabled: z.boolean().default(true),
  scope: advertisingScopeSchema.default('local'),
  frequency: z.number().int().min(1).max(10).default(3),
  clips: z.array(showAdClipSchema).default([])
});

export const showProductionPlanSchema = z.object({
  mediaItems: z.array(showMediaItemSchema).default([]),
  voiceOvers: z.array(voiceOverCueSchema).default([]),
  samplePads: z.array(showSamplePadSchema).default([]),
  sequence: z.array(showSequenceItemSchema).default([]),
  advertising: showAdvertisingPlanSchema.default({
    enabled: true,
    scope: 'local',
    frequency: 3,
    clips: []
  })
});

export type VoiceOverCue = z.infer<typeof voiceOverCueSchema>;
export type ShowMediaItem = z.infer<typeof showMediaItemSchema>;
export type ShowSamplePad = z.infer<typeof showSamplePadSchema>;
export type ShowSequenceItem = z.infer<typeof showSequenceItemSchema>;
export type ShowAdClip = z.infer<typeof showAdClipSchema>;
export type ShowAdvertisingPlan = z.infer<typeof showAdvertisingPlanSchema>;
export type ShowProductionPlan = z.infer<typeof showProductionPlanSchema>;
export type AdvertisingScope = z.infer<typeof advertisingScopeSchema>;
export type ShowMediaType = z.infer<typeof showMediaTypeSchema>;

export const samplePadSlots = Array.from({ length: 16 }, (_, index) => index + 1);

export const royaltyFreeSampleClips: ShowSamplePad[] = [
  {
    sampleId: '0x9a1b3c5d7e8f1021',
    title: 'Club Stab',
    url: '/audio/samples/club-stab.wav',
    notes: 'Generated royalty-free synth stab.',
    category: 'drums',
    colorHex: '#ff6b6b'
  },
  {
    sampleId: '0x2b4d6f8a0c1e3f55',
    title: 'Sweep Rise',
    url: '/audio/samples/sweep-rise.wav',
    notes: 'Generated royalty-free riser.',
    category: 'fx',
    colorHex: '#f59e0b'
  },
  {
    sampleId: '0x3c5e7a9c1d2f4b66',
    title: 'Impact Hit',
    url: '/audio/samples/impact-hit.wav',
    notes: 'Generated royalty-free impact hit.',
    category: 'drums',
    colorHex: '#22c55e'
  },
  {
    sampleId: '0x4d6f8b0d2e3a5c77',
    title: 'Signal Chime',
    url: '/audio/samples/signal-chime.wav',
    notes: 'Generated royalty-free transition chime.',
    category: 'fx',
    colorHex: '#3b82f6'
  }
];

export function parseShowProductionPlan(value: unknown): ShowProductionPlan | null {
  const result = showProductionPlanSchema.safeParse(value);
  return result.success ? result.data : null;
}
