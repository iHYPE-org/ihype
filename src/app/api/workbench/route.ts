import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkbenchData } from '@/lib/getWorkbenchData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await getWorkbenchData(session.user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/workbench] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
