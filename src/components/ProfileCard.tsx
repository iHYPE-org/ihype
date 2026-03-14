import Link from 'next/link';
import { HypeButton } from '@/components/HypeButton';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { shortenHexId } from '@/lib/hex-id';

type ProfileCardProfile = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  slug: string;
  hexId: string;
  name: string;
  city: string | null;
  country: string | null;
  hypeCount: number;
  bio: string | null;
  genres: string[];
  avatarImage: string | null;
};

function getProfileBasePath(type: ProfileCardProfile['type']) {
  if (type === 'VENUE') return 'venues';
  if (type === 'DJ') return 'promoters';
  if (type === 'LISTENER') return 'fans';
  return 'artists';
}

function getProfileLabel(type: ProfileCardProfile['type']) {
  if (type === 'DJ') return 'PROMOTER';
  if (type === 'LISTENER') return 'FAN';
  return type;
}

function getProfileSummary(bio: string | null) {
  if (!bio) return null;
  return bio.length > 160 ? `${bio.slice(0, 157).trimEnd()}...` : bio;
}

export function ProfileCard({ profile }: { profile: ProfileCardProfile }) {
  const basePath = getProfileBasePath(profile.type);
  const avatarImage = getSafeImageUrl(profile.avatarImage);
  const summary = getProfileSummary(profile.bio);

  return (
    <article className="card">
      {avatarImage ? (
        <div className="card-avatar">
          <img alt={`${profile.name} avatar`} className="profile-avatar" src={avatarImage} />
        </div>
      ) : null}
      <div className="badge">{getProfileLabel(profile.type)}</div>
      <h3>{profile.name}</h3>
      <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
      <p className="meta">
        {shortenHexId(profile.hexId)} | {profile.hypeCount} hype
      </p>
      {summary ? <p>{summary}</p> : null}
      <div className="tag-row">
        {profile.genres.map((genre) => <span key={genre} className="tag">{genre}</span>)}
      </div>
      <HypeButton entityLabel={getProfileLabel(profile.type).toLowerCase()} initialCount={profile.hypeCount} targetId={profile.id} targetType="profile" />
      <div className="cta-row">
        <Link className="button small secondary" href={`/${basePath}/${profile.slug}`}>View page</Link>
        <Link className="button small secondary" href={`/profiles/${profile.hexId}`}>Share</Link>
      </div>
    </article>
  );
}
