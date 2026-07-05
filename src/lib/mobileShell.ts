export type ShellSection = 'listen' | 'shows' | 'pages';

export const SHELL_SECTIONS: ShellSection[] = ['listen', 'shows', 'pages'];

const PATHS: Record<ShellSection, string> = {
  listen: '/listen',
  shows: '/shows',
  pages: '/pages',
};

export function pathToSection(pathname: string): ShellSection | null {
  if (pathname === '/listen') return 'listen';
  if (pathname === '/shows') return 'shows';
  if (pathname === '/pages') return 'pages';
  return null;
}

export function sectionToPath(section: ShellSection): string {
  return PATHS[section];
}

/**
 * Circular offset of section `i` relative to `active`, in {-1, 0, 1} — the
 * shortest direction around the 3-item loop. Used to position each of the
 * shell's 3 always-mounted slots so wraparound (Pages -> Listen, Listen ->
 * Pages) is a single visual step instead of a jump.
 */
export function relativeSlotPosition(i: number, active: number, total: number): number {
  const rel = ((i - active) % total + total) % total;
  return rel > total / 2 ? rel - total : rel;
}

/**
 * Given a completed drag's horizontal distance and the container width,
 * decide whether it committed to the next/previous section or should snap
 * back to where it started. Pure so it's unit-testable without a DOM.
 */
export function resolveDragCommit(dragPx: number, containerWidth: number): 'next' | 'prev' | null {
  if (containerWidth <= 0) return null;
  const ratio = dragPx / containerWidth;
  if (ratio <= -0.2) return 'next';
  if (ratio >= 0.2) return 'prev';
  return null;
}
