import { headers } from 'next/headers';
import { isNativeAppUserAgent } from '@/lib/native-app';

/**
 * The server half of `native-app.ts`: does THIS request come from the iOS or
 * Android app? Reads the user agent the next store build appends. A build
 * without the token answers false here and is caught on the client instead
 * (`useNativeApp`), so a page must never rely on this alone to hide a buy path.
 */
export async function isNativeAppRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  return isNativeAppUserAgent(requestHeaders.get('user-agent'));
}
