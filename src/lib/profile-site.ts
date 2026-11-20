import { z } from 'zod';

// This is a standalone public microsite, not the retired AI page editor.
// Keeping the configuration small and enumerated prevents arbitrary HTML,
// external scripts, and surprising public disclosure of private profile fields.
export const siteThemes = ['spotlight', 'paper', 'electric'] as const;
export const siteConfigSchema = z.object({
  published: z.boolean(),
  theme: z.enum(siteThemes),
  tagline: z.string().trim().max(180),
  sections: z.object({
    about: z.boolean(),
    shows: z.boolean(),
    music: z.boolean(),
    videos: z.boolean(),
    merch: z.boolean(),
    contact: z.boolean(),
  }).strict(),
}).strict();

export type SiteConfig = z.infer<typeof siteConfigSchema>;

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  published: false,
  theme: 'spotlight',
  tagline: '',
  sections: {
    about: true,
    shows: true,
    music: true,
    videos: true,
    merch: false,
    contact: false, // May contain a private phone/email — opt in to sharing.
  },
};

export function readProfileSiteConfig(raw: unknown): SiteConfig {
  const result = siteConfigSchema.safeParse(raw);
  return result.success ? result.data : {
    ...DEFAULT_SITE_CONFIG,
    sections: { ...DEFAULT_SITE_CONFIG.sections },
  };
}

export function isSafeSiteUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
