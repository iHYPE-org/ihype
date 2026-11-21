import { z } from 'zod';

export const experienceSchema = z.object({
  preset: z.enum(['standard', 'simple', 'music', 'events']).default('standard'),
  accent: z.enum(['default', 'cyan', 'violet', 'amber']).default('default'),
  density: z.enum(['comfortable', 'compact', 'spacious']).default('comfortable'),
  contrast: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  largeText: z.boolean().default(false),
  navigation: z.object({
    music: z.boolean().default(true),
    events: z.boolean().default(true),
    discover: z.boolean().default(true),
    community: z.boolean().default(true),
    creator: z.boolean().default(true),
  }).default({ music: true, events: true, discover: true, community: true, creator: true }),
});
export type ExperiencePreferences = z.infer<typeof experienceSchema>;
export const defaultExperience: ExperiencePreferences = experienceSchema.parse({});
export function parseExperience(value: unknown): ExperiencePreferences {
  const parsed = experienceSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultExperience;
}
