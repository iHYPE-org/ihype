export function capString(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

export function sanitizeShowInput(body: Record<string, unknown>) {
  if (typeof body.title === 'string') body.title = body.title.slice(0, 200);
  if (typeof body.description === 'string') body.description = body.description.slice(0, 2000);
  if (typeof body.venue === 'string') body.venue = body.venue.slice(0, 200);
  if (Array.isArray(body.tags))
    body.tags = (body.tags as string[]).map((t) => String(t).slice(0, 50)).slice(0, 20);
  return body;
}
