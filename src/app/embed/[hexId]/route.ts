import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hexId: string }> }
) {
  const { hexId } = await params;

  // hexId could be a profile hexId or mediaAsset hexId
  let track: { title: string; artistName: string; audioUrl: string; artworkUrl: string | null } | null = null;

  // First try as ArtistMediaAsset hexId
  const asset = await db.artistMediaAsset.findUnique({
    where: { hexId, isPublished: true },
    include: { profile: { select: { name: true } } },
  });

  if (asset) {
    track = {
      title: asset.title,
      artistName: asset.profile.name,
      audioUrl: asset.storageUrl ?? '',
      artworkUrl: null,
    };
  } else {
    // Try as profile hexId — get latest track
    const profile = await db.profile.findUnique({
      where: { hexId },
      select: { name: true, mediaUploads: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (profile?.mediaUploads[0]) {
      const a = profile.mediaUploads[0];
      track = {
        title: a.title,
        artistName: profile.name,
        audioUrl: a.storageUrl ?? '',
        artworkUrl: null,
      };
    }
  }

  if (!track) {
    return new NextResponse('<html><body style="background:#0a0805;color:#666;font-family:monospace;display:flex;align-items:center;justify-content:center;height:80px;margin:0">No track found</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(track.title)} — ${escHtml(track.artistName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0805;color:#f0ebe5;font-family:"DM Sans",system-ui,sans-serif;height:80px;overflow:hidden;display:flex;align-items:center}
.player{display:flex;align-items:center;gap:12px;padding:12px 16px;width:100%}
.art{width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,#ff5029,#ff3e9a);flex-shrink:0;overflow:hidden}
.art img{width:100%;height:100%;object-fit:cover}
.info{flex:1;min-width:0}
.title{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f0ebe5}
.artist{font-size:12px;color:#9e9080;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctrl{display:flex;align-items:center;gap:8px;flex-shrink:0}
.playbtn{width:36px;height:36px;border-radius:50%;background:#ff5029;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.playbtn:hover{background:#ff6a47}
.playbtn svg{width:16px;height:16px;fill:#fff}
.link{font-size:11px;color:#9e9080;text-decoration:none;font-family:monospace;letter-spacing:.06em;white-space:nowrap}
.link:hover{color:#f0ebe5}
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
    <button class="playbtn" id="btn" onclick="toggle()">
      <svg id="play-icon" viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14"/></svg>
      <svg id="pause-icon" viewBox="0 0 16 16" style="display:none"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>
    </button>
    <a class="link" href="https://ihype.org" target="_blank">ihype.org ↗</a>
  </div>
</div>
<audio id="audio" src="${escHtml(track.audioUrl)}" preload="none"></audio>
<script>
var a=document.getElementById('audio'),pi=document.getElementById('play-icon'),pa=document.getElementById('pause-icon');
function toggle(){if(a.paused){a.play();pi.style.display='none';pa.style.display=''}else{a.pause();pi.style.display='';pa.style.display='none'}}
a.onended=function(){pi.style.display='';pa.style.display='none'};
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'ALLOWALL',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
