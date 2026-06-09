import { NextResponse } from 'next/server';
import { getTransparencySnapshot } from '@/lib/transparency';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getTransparencySnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[api/transparency] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
