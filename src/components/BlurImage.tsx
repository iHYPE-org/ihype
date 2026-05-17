'use client';

import Image from 'next/image';

export function BlurImage({ src, alt, ...props }: React.ComponentProps<typeof Image>) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4="
      loading="lazy"
      {...props}
    />
  );
}
