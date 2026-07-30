import { NextResponse } from 'next/server';
import { readRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

export function GET() {
  const key = readRuntimeEnv('VAPID_PUBLIC_KEY');
  if (!key) return NextResponse.json({ key: null });
  return NextResponse.json({ key });
}
