import Link from 'next/link';
import Image from 'next/image';
import { HypeButton } from '@/components/HypeButton';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { shortenHexId } from '@/lib/hex-id';

type ProfileCardProfile = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  slug: string;
  hexId: string;
  name: string;
  contactInfo: string | null;
  addressLine1: string | null;
  hoursText: string | null;
  hometown: string | null;
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

function getProfileSummary(bio: string | null, maxLength = 160) {
  if (!bio) return null;
  return bio.length > maxLength ? `${bio.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...` : bio;
}

export function ProfileCard({ profile, compact = false }: { profile: ProfileCardProfile; compact?: boolean }) {
  const basePath = getProfileBasePath(profile.type);
  const avatarImage = getSafeImageUrl(profile.avatarImage);
  const summary = getProfileSummary(profile.bio, compact ? 96 : 160);
  const visibleGenres = compact ? profile.genres.slice(0, 2) : profile.genres;

  return (
    <article className={`card profile-card profile-card-${basePath}${compact ? ' compact' : ''}`}>
      <div className="profile-card-head">
        <div className="badge">{getProfileLabel(profile.type)}</div>
        <span className="profile-card-hype">{profile.hypeCount} hype</span>
      </div>
      <div className="profile-card-identity">
        {avatarImage ? (
          <div className="card-avatar profile-card-avatar-shell">
            <Image
              alt={`${profile.name} avatar`}
              className="profile-avatar profile-card-avatar"
              src={avatarImage}
              width={300}
              height={300}
              sizes="(max-width: 768px) 100vw, 300px"
              style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
              unoptimized
            />
          </div>
        ) : (
          <div className="profile-avatar profile-avatar-fallback profile-card-avatar profile-card-avatar-shell">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="profile-card-copy">
          <h3>{profile.name}</h3>
          <p className="meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
        </div>
      </div>
      {profile.type === 'VENUE' && (profile.addressLine1 || profile.hoursText || profile.contactInfo) ? (
        <p className="meta profile-card-detail">
          {[profile.addressLine1, profile.hoursText, profile.contactInfo].filter(Boolean).join(' | ')}
        </p>
      ) : null}
      {profile.type === 'ARTIST' && profile.hometown ? <p className="meta profile-card-detail">Hometown: {profile.hometown}</p> : null}
      <p className="meta profile-card-detail">{shortenHexId(profile.hexId)}</p>
      {summary ? <p className="profile-card-summary">{summary}</p> : null}
      <div className="tag-row profile-card-tags">
        {visibleGenres.map((genre) => <span key={genre} className="tag">{genre}</span>)}
      </div>
      <div className="profile-card-actions">
        <HypeButton entityLabel={getProfileLabel(profile.type).toLowerCase()} initialCount={profile.hypeCount} targetId={profile.id} targetType="profile" />
      </div>
      <div className="cta-row profile-card-cta-row">
        <Link className="button small secondary" href={`/${basePath}/${profile.slug}`}>View page</Link>
        {!compact ? <Link className="button small secondary" href={`/profiles/${profile.hexId}`}>Share</Link> : null}
      </div>
    </article>
  );
}
