import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export function FanFirstLanding() {
  return (
    <div className="approved-index">
      <Image
        alt=""
        className="approved-index-image"
        height={941}
        priority
        sizes="100vw"
        src="/brand/approved-index.png"
        unoptimized
        width={1672}
      />

      <div className="approved-index-theme">
        <ThemeToggle />
      </div>
      <Link aria-label="Sign in" className="approved-index-signin" href="/login" />
      <Link aria-label="Join free" className="approved-index-join" href="/register" />

      <div className="sr-only">
        <h1>Free local music.</h1>
        <p>Hear the artists playing around you. HYPE what you love. Help your scene get heard.</p>
        <p>Join free and start listening.</p>
      </div>
    </div>
  );
}
