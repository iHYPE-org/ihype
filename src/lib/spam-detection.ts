import Anthropic from '@anthropic-ai/sdk';

export type SpamResult = { isSpam: boolean; confidence: number };

export async function checkForSpam(
  text: string,
  context: string = 'user-generated content'
): Promise<SpamResult> {
  if (!text || text.trim().length < 10) {
    return { isSpam: false, confidence: 0 };
  }

  const prompt = `You are a spam and bot detection system for iHYPE, an independent music platform.
Context: ${context}
Text to evaluate:
"""
${text.slice(0, 1000)}
"""

Is this spam, bot-generated content, or automated abuse? Consider:
- Promotional links unrelated to independent music
- Generic templated text with suspicious patterns
- Fake engagement bait
- Clearly automated or nonsensical content

Respond with ONLY valid JSON: {"isSpam": true/false, "confidence": 0.0-1.0}
No explanation, just the JSON object.`;

  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const result = JSON.parse(responseText) as { isSpam?: boolean; confidence?: number };
    return {
      isSpam: Boolean(result.isSpam),
      confidence: typeof result.confidence === 'number' ? Math.min(1, Math.max(0, result.confidence)) : 0
    };
  } catch {
    return { isSpam: false, confidence: 0 };
  }
}
