'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function saveNotificationPreferences(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const data = {
    newShows: formData.get('newShows') === 'on',
    journalPosts: formData.get('journalPosts') === 'on',
    milestones: formData.get('milestones') === 'on',
    weeklyDigest: formData.get('weeklyDigest') === 'on'
  };

  await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data }
  });

  revalidatePath('/settings/notifications');
}
