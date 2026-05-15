type CitationInput = {
   rank: number;
   title: string;
   publisher: string;
   publishedAt: string | null;
   url: string;
   snippet: string;
   reliability: string;
   sourceType: string;
};

type PromptInput = {
   trendTitle: string;
   trendCategory: string;
   trendUrl: string;
   query: string;
   citations: CitationInput[];
};

export const STORY_GENERATION_SYSTEM_PROMPT = `
You are the editorial engine for Proofline, an evidence-first AI newsroom.
Your job is to answer one core question from a trending claim and produce a clear, trustworthy story.

Rules:
1) Return ONLY valid JSON. No markdown fence.
2) Use only the provided evidence list. Do not invent facts.
3) body_markdown must be pure markdown article text.
4) body_markdown must be at least 180 words.
5) Write natural editorial paragraphs; no chunked fragments.
6) Keep language simple and readable. Avoid dense wording.
7) Body must use citation markers with bracket format [n].
   - For single source: [2]
   - For multiple sources: [2] [5] (must include a space between markers).
8) If evidence is mixed or weak, say so and lower confidence.
9) Keep tone factual, direct, and non-sensational.
10) No emojis anywhere in headline, title, subtitle, or body_markdown.
11) You may use light markdown emphasis (**bold**, *italic*) where it improves clarity.

Output JSON shape:
{
  "headline": "Question-form headline ending with ?",
  "title": "Direct newsroom title statement",
  "subtitle": "One-sentence summary with key context",
  "verdict": "TRUE | FALSE | MIXED | UNVERIFIED",
  "confidence": 0-100,
  "body_markdown": "Pure markdown article body, paragraph-led, citations [n], minimum 180 words"
}
`.trim();

function formatCitationLine(citation: CitationInput): string {
   const publishedAt = citation.publishedAt ?? 'unknown date';
   return `[${citation.rank}] ${citation.title} | ${citation.publisher} | ${publishedAt} | ${citation.reliability} | ${citation.sourceType}\nURL: ${citation.url}\nSnippet: ${citation.snippet}`;
}

export function buildStoryGenerationUserPrompt(input: PromptInput): string {
   const evidenceBlock = input.citations
      .map(citation => formatCitationLine(citation))
      .join('\n\n');

   return `
Trend:
- Title: ${input.trendTitle}
- Category: ${input.trendCategory}
- Original URL: ${input.trendUrl}
- Search Query Used: ${input.query}

Evidence List:
${evidenceBlock}

Task:
- Identify the strongest question this trend is really asking.
- Write the story to answer that question with evidence.
- Use citation markers [n] from the evidence list.
- Keep flow natural: what happened -> what evidence says -> what is disputed -> what this means now.
- Mention uncertainty clearly where needed.
- Ensure headline is a question.
- Ensure verdict is one of TRUE/FALSE/MIXED/UNVERIFIED.
- Confidence must be an integer 0-100.
- body_markdown must be at least 180 words.
`.trim();
}
