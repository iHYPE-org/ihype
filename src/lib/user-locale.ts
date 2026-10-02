import { db } from '@/lib/db';
import { isSupportedLocale, type Locale } from '@/lib/i18n/locales';

/**
 * The language a member chose, for mail — where there is no request, no
 * cookie and therefore nothing `getLocale()` can read. `User.locale` is
 * written at signup from the cookie and on every switch (PATCH /api/me);
 * null means the member never chose, and null is handed back as null so the
 * caller's translator falls to English rather than this module deciding.
 * A failed read is the same answer: an email in English is never the error.
 */
export async function readUserLocale(userId: string): Promise<Locale | null> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
    return isSupportedLocale(user?.locale) ? user.locale : null;
  } catch {
    return null;
  }
}
