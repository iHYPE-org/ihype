// Cloudflare Workers AI wrapper. Accesses the `AI` binding at runtime;
// returns null in local dev so callers fall through to their error paths.

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

interface AiBinding {
  run(model: string, inputs: { messages: Message[]; max_tokens?: number }): Promise<{ response?: string }>;
}

function getAiBinding(): AiBinding | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const ai = (ctx.env as Record<string, unknown>).AI;
    return ai ? (ai as AiBinding) : null;
  } catch {
    return null;
  }
}

export async function runAI(
  messages: Message[],
  maxTokens = 256
): Promise<string | null> {
  const ai = getAiBinding();
  if (!ai) return null;
  try {
    const result = await ai.run(MODEL, { messages, max_tokens: maxTokens });
    return result.response ?? null;
  } catch {
    return null;
  }
}
