import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hexId: string }> }
) {
  const { hexId } = await params;
  const snippet = `<iframe src="https://ihype.org/embed/${hexId}" width="320" height="80" frameborder="0" scrolling="no" allow="autoplay" style="border-radius:12px;overflow:hidden"></iframe>`;
  return new NextResponse(snippet, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
