import { describe, expect, it } from 'vitest';
import { pathToSection, sectionToPath, relativeSlotPosition, resolveDragCommit, SHELL_SECTIONS } from '@/lib/mobileShell';

describe('pathToSection / sectionToPath', () => {
  it('maps the three shell routes to sections', () => {
    expect(pathToSection('/listen')).toBe('listen');
    expect(pathToSection('/shows')).toBe('shows');
    expect(pathToSection('/pages')).toBe('pages');
  });

  it('returns null for any other route', () => {
    expect(pathToSection('/discover')).toBeNull();
    expect(pathToSection('/shows/some-slug')).toBeNull();
  });

  it('round-trips back to the same path', () => {
    for (const section of SHELL_SECTIONS) {
      expect(pathToSection(sectionToPath(section))).toBe(section);
    }
  });
});

describe('relativeSlotPosition', () => {
  it('is 0 for the active slot itself', () => {
    expect(relativeSlotPosition(1, 1, 3)).toBe(0);
  });

  it('is +1/-1 for immediate neighbors without wrapping', () => {
    expect(relativeSlotPosition(2, 1, 3)).toBe(1);
    expect(relativeSlotPosition(0, 1, 3)).toBe(-1);
  });

  it('wraps around so the far slot is always the short way (±1), never ±2', () => {
    // active = listen (0): pages (2) should read as -1 (one step left), not +2
    expect(relativeSlotPosition(2, 0, 3)).toBe(-1);
    // active = pages (2): listen (0) should read as +1 (one step right), not -2
    expect(relativeSlotPosition(0, 2, 3)).toBe(1);
  });
});

describe('resolveDragCommit', () => {
  it('commits to next when dragged left past 20% of the container', () => {
    expect(resolveDragCommit(-100, 400)).toBe('next');
  });

  it('commits to prev when dragged right past 20% of the container', () => {
    expect(resolveDragCommit(100, 400)).toBe('prev');
  });

  it('snaps back (null) below the threshold', () => {
    expect(resolveDragCommit(-50, 400)).toBeNull();
    expect(resolveDragCommit(50, 400)).toBeNull();
  });

  it('is defensive against a zero-width container', () => {
    expect(resolveDragCommit(-100, 0)).toBeNull();
  });
});
