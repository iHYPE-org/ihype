import DOMPurify from 'dompurify';

const CHAT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

export function sanitizeChatHtml(dirty: string): string {
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(dirty, CHAT_CONFIG) as string;
}

export function sanitizePreviewHtml(dirty: string): string {
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(dirty, { FORCE_BODY: true }) as string;
}
