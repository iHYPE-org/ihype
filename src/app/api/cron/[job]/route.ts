import { NextRequest } from 'next/server';
import { GET as cronHandler } from '../route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const url = new URL(request.url);
  url.searchParams.set('job', job);
  return cronHandler(new NextRequest(url.toString(), { headers: request.headers }));
}

export { GET as POST };
