import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteVideoPlayer } from './SiteVideoPlayer';

describe('public microsite video play control', () => {
  it('uses a text-presentation play glyph without loading a video before interaction', () => {
    const markup = renderToStaticMarkup(
      <SiteVideoPlayer title="Live set" playbackId="ci-only-playback" />,
    );
    const playGlyph = String.fromCodePoint(0x25b6);
    const textSelector = String.fromCodePoint(0xfe0e);

    expect(markup).toContain('aria-label="Play Live set"');
    expect(markup).toContain(playGlyph + textSelector);
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('player.mux.com');
  });
});
