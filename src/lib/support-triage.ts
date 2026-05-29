type SupportCategory = 'BILLING' | 'BUG' | 'ABUSE' | 'ACCOUNT' | 'FEATURE' | 'OTHER';

const RULES: Array<{ keywords: RegExp; category: SupportCategory; autoReply?: string }> = [
  {
    keywords: /refund|charge|payment|billing|money|stripe|ticket price/i,
    category: 'BILLING',
    autoReply: 'For refund requests, please include your order number. We process refunds within 3-5 business days.',
  },
  { keywords: /bug|broken|error|crash|not working|glitch|issue/i, category: 'BUG' },
  { keywords: /spam|fake|abuse|harassment|inappropriate|report/i, category: 'ABUSE' },
  {
    keywords: /delete.*account|account.*delete|login|password|sign.*in|cant.*access/i,
    category: 'ACCOUNT',
    autoReply: 'To delete your account: Settings → Delete Account. To reset login, use the magic link on the login page.',
  },
  { keywords: /feature|suggest|idea|would.*be.*nice|please.*add/i, category: 'FEATURE' },
];

export function triageSupportRequest(
  subject: string,
  details: string
): { category: SupportCategory; autoReply?: string } {
  const combined = `${subject} ${details}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.test(combined)) return { category: rule.category, autoReply: rule.autoReply };
  }
  return { category: 'OTHER' };
}
