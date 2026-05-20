export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({})) as { error?: string } & T;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed.');
  return data as T;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
