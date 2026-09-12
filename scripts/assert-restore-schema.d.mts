export const MAX_BEHIND: number;
export function assessRestoreSchema(input: {
  restored: number;
  latestRestored: string | null;
  expected: string[];
}): { ok: boolean; behind: number; message: string };
export function migrationDirectories(root?: string): string[];
