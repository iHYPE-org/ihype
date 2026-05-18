import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function client() { return (_client ??= new Anthropic()); }

export interface AdData {
  advertiserName: string;
  advertiserType: string;
  campaignWebsite: string;
  adTextCopy: string;
}

export interface VettingResult {
  isApproved: boolean;
  reasoning: string;
  requiresManualReview: boolean;
}

export async function vetAdvertisement(adData: AdData): Promise<VettingResult> {
  const systemPrompt = `You are an automated compliance officer for iHYPE.org, a privacy-first, not-for-profit music discovery platform.
Your sole task is to strictly vet advertisement (supporter) applications.

POLICY: Submissions MUST come exclusively from music-industry entities:
- Musical artists, bands, DJs
- Concert venues, music clubs
- Concert promoters, booking agents
- Record labels, music publishers
- Music equipment/instrument brands
- Music-tech companies (streaming tools, music software, etc.)

REJECT: general brands, non-music tech companies, lifestyle brands, food/drink brands, financial services, or anything not directly serving the music community.

If the submission is borderline or you are unsure, set requiresManualReview to true.

Respond ONLY in valid JSON with exactly these keys:
{
  "isApproved": boolean,
  "reasoning": "One sentence explaining approval or rejection.",
  "requiresManualReview": boolean
}`;

  const userPrompt = `Vet this supporter submission:
- Name: ${adData.advertiserName}
- Type: ${adData.advertiserType}
- Website: ${adData.campaignWebsite}
- Copy: "${adData.adTextCopy}"`;

  try {
    const message = await client().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      isApproved: !!result.isApproved,
      reasoning: result.reasoning || 'No reasoning provided.',
      requiresManualReview: !!result.requiresManualReview,
    };
  } catch (error) {
    console.error('[ad-vetting] AI vetting failure:', error);
    return {
      isApproved: false,
      reasoning: 'Vetting system error. Routing to manual review queue.',
      requiresManualReview: true,
    };
  }
}
