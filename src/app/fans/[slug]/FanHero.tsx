import Link from 'next/link';
import { BadgeShelf } from '@/components/BadgeShelf';
import { HypeButton } from '@/components/HypeButton';

type Badge = { type: string; awardedAt: Date };

interface FanHeroProps {
  profile: {
    id: string;
    name: string;
    slug: string;
    hexId: string;
    headline: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    genres: string[];
    hypeCount: number;
    nowPlaying: string | null;
    heroImage: string | null;
    avatarImage: string | null;
  };
  avatarImage: string | null;
  bannerStyle: React.CSSProperties | undefined;
  fanLevel: number;
  fullSongListenCount: number;
  fullShowListenCount: number;
  badges: Badge[];
  isOwner: boolean;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function FanHero({
  profile,
  avatarImage,
  bannerStyle,
  fanLevel,
  fullSongListenCount,
  fullShowListenCount,
  badges,
  isOwner
}: FanHeroProps) {
  return (
    <header className="artist-banner panel fan-page-banner" style={bannerStyle}>
      <div className="profile-banner-row">
        {avatarImage ? (
          <img alt={`${profile.name} avatar`} className="profile-avatar profile-avatar-hero" src={avatarImage} />
        ) : (
          <div className="profile-avatar profile-avatar-hero profile-avatar-fallback">{getInitials(profile.name)}</div>
        )}
        <div className="artist-banner-copy">
          <div className="badge">FAN</div>
          <h1 className="title fan-page-title">{profile.name}</h1>
          <p className="artist-headline">{profile.headline || 'Capture the shows, artists, and moments you keep coming back to.'}</p>
          <p className="subtitle">{profile.bio}</p>
          <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
          <p className="meta">Share ID: <Link href={`/profiles/${profile.hexId}`}>{profile.hexId}</Link></p>
          <p className="meta">FAN Level {fanLevel} | {fullSongListenCount} full songs | {fullShowListenCount} full shows</p>
          {profile.nowPlaying && (
            <p className="meta" style={{ fontStyle: 'italic' }}>🎵 Now playing: {profile.nowPlaying}</p>
          )}
          <BadgeShelf badges={badges} />
          <div className="tag-row">{profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}</div>
          <HypeButton targetType="profile" targetId={profile.id} initialCount={profile.hypeCount} entityLabel="fan page" />
          <div className="profile-public-actions">
            <Link className="button small secondary" href={`/fans/${profile.slug}?section=recommend`}>See recommendations</Link>
            <Link className="button small secondary" href="/artists">Browse artists</Link>
            <Link className="button small secondary" href="/register?role=FAN">Join fan lane</Link>
          </div>
        </div>
        {isOwner ? (
          <div className="profile-banner-actions">
            <Link className="button small secondary" href={`/home?profile=${profile.id}&edit=menu`}>
              Edit Page
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
