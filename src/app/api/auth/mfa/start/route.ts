import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'MFA is temporarily disabled.' }, { status: 410 });
}
