import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ key: null });
  return NextResponse.json({ key });
}
