import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hexId: string }> },
) {
  const { hexId } = await params;
  const nonce = request.headers.get('x-nonce') ?? '';

  let track: { title: string; artistName: string; audioUrl: string; artworkUrl: string | null } | null = null;

  const asset = await db.artistMediaAsset.findFirst({
    where: { hexId, isPublished: true },
    select: { hexId: true, title: true, profile: { select: { name: true } } },
  });

  if (asset) {
    track = {
      title: asset.title,
      artistName: asset.profile.name,
      audioUrl: `/api/public-media/${encodeURIComponent(asset.hexId)}`,
      artworkUrl: null,
    };
  } else {
    const profile = await db.profile.findUnique({
      where: { hexId },
      select: {
        name: true,
        mediaUploads: {
          where: { isPublished: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { hexId: true, title: true },
        },
      },
    });
    const latest = profile?.mediaUploads[0];
    if (profile && latest) {
      track = {
        title: latest.title,
        artistName: profile.name,
        audioUrl: `/api/public-media/${encodeURIComponent(latest.hexId)}`,
        artworkUrl: null,
      };
    }
  }

  if (!track) {
    return new NextResponse('<html><body style="background:var(--bg);color:#666;font-family:monospace;display:flex;align-items:center;justify-content:center;height:80px;margin:0">No track found</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(track.title)} — ${escHtml(track.artistName)}</title>
<style>
/* This is a standalone document served by a route handler — globals.css never
   reaches it and next/font mints no variables here, so the six var() references
   below had nothing to resolve against: the body painted transparent, the
   artwork gradient did not render and the artist line fell back to inherited
   ink. The tokens are therefore declared locally, at design system v8's values.
   Keep them in step with globals.css by hand; there is no import seam to share.
   design-exempt: standalone embed document, no access to the token layer. */
:root{--bg:#0b1220;--ink:#eef1f6;--ink-2:#96a1b5;--accent:#ff5029;--accent-2:#ff3e9a;--ink-on-accent:#0b1220}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:"Work Sans",system-ui,sans-serif;height:80px;overflow:hidden;display:flex;align-items:center}
.player{display:flex;align-items:center;gap:12px;padding:12px 16px;width:100%}
.art{width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent-2));flex-shrink:0;overflow:hidden}
.art img{width:100%;height:100%;object-fit:cover}
.info{flex:1;min-width:0}
.title{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.artist{font-size:12px;color:var(--ink-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctrl{display:flex;align-items:center;gap:8px;flex-shrink:0}
.playbtn{width:36px;height:36px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.playbtn:hover{background:#ff6a47}
.playbtn svg{width:16px;height:16px;fill:var(--ink-on-accent)}
.link{font-size:11px;color:var(--ink-2);text-decoration:none;font-family:monospace;letter-spacing:.06em;white-space:nowrap}
.link:hover{color:var(--ink)}
</style>
</head>
<body>
<div class="player">
  <div class="art">${track.artworkUrl ? `<img src="${escHtml(track.artworkUrl)}" alt="">` : ''}</div>
  <div class="info">
    <div class="title">${escHtml(track.title)}</div>
    <div class="artist">${escHtml(track.artistName)}</div>
  </div>
  <div class="ctrl">
    <button class="playbtn" id="btn" aria-label="Play or pause">
      <svg id="play-icon" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14"/></svg>
      <svg id="pause-icon" viewBox="0 0 16 16" style="display:none"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>
    </button>
    <a class="link" href="https://ihype.org" rel="noopener noreferrer" target="_blank">ihype.org ↗</a>
  </div>
</div>
<audio id="audio" src="${escHtml(track.audioUrl)}" preload="none"></audio>
<script nonce="${nonce}">
var a=document.getElementById('audio'),pi=document.getElementById('play-icon'),pa=document.getElementById('pause-icon'),btn=document.getElementById('btn');
function toggle(){if(a.paused){a.play();pi.style.display='none';pa.style.display=''}else{a.pause();pi.style.display='';pa.style.display='none'}}
btn.addEventListener('click',toggle);
a.onended=function(){pi.style.display='';pa.style.display='none'};
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function escHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
