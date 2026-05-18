import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';

export default async function RateLimitsPage() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/');

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <AdminNav active="rate-limits" />
      <h1>Rate Limit Monitor</h1>
      <div className="callout warning" style={{ maxWidth: 600 }}>
        <p>Rate limit data is stored in Vercel KV. To see which endpoints are hitting limits most:</p>
        <ol>
          <li>Check Vercel KV dashboard for keys prefixed with <code>rl:</code></li>
          <li>High-count keys indicate frequently-limited endpoints</li>
          <li>Tune limits in <code>src/app/api/*/route.ts</code> via <code>consumeRateLimit</code> calls</li>
        </ol>
        <p>Common high-traffic endpoints: <code>pk-auth</code>, <code>ads/upload</code>, <code>booking-requests</code></p>
      </div>
    </div>
  );
}
