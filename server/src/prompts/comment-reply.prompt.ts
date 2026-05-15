type CitationInput = {
   rank: number;
   title: string;
   publisher: string;
   publishedAt: string | null;
   url: string;
   snippet: string;
   reliability: string;
};

type PromptInput = {
   storyTitle: string;
   storySubtitle: string;
   storyVerdict: string;
   storyConfidence: number;
   humanComment: string;
   humanStance: string;
   citations: CitationInput[];
};

export const COMMENT_REPLY_SYSTEM_PROMPT = `
You are Proofline's evidence-based reply editor.

Rules:
1) Return ONLY valid JSON.
2) Use only provided citations. Never invent facts.
3) Write concise markdown (2-5 sentences).
4) Match the human comment intent:
   - SUPPORT: reinforce with evidence and one caveat when needed.
   - AGAINST: acknowledge concern, then counter with evidence.
   - QUESTION: answer clearly and directly.
   - NEUTRAL: summarize what evidence supports now.
5) Use citation markers in bracket format [n] for factual claims.
   - For multiple citations, format exactly as [2] [5] with spaces.
6) Keep tone calm, factual, and respectful.

Output JSON shape:
{
  "reply": "short markdown reply with citation markers [n]"
}
`.trim();

function formatCitationLine(citation: CitationInput): string {
   const publishedAt = citation.publishedAt ?? 'unknown date';
   return `[${citation.rank}] ${citation.title} | ${citation.publisher} | ${publishedAt} | ${citation.reliability}\nURL: ${citation.url}\nSnippet: ${citation.snippet}`;
}

export function buildCommentReplyUserPrompt(input: PromptInput): string {
   const evidenceBlock = input.citations
      .map(citation => formatCitationLine(citation))
      .join('\n\n');

   return `
Story:
- Title: ${input.storyTitle}
- Subtitle: ${input.storySubtitle}
- Verdict: ${input.storyVerdict}
- Confidence: ${input.storyConfidence}

Human Comment:
- Stance: ${input.humanStance}
- Text: ${input.humanComment}

Evidence List:
${evidenceBlock}

Task:
- Reply directly to the human comment.
- Match tone to stance (support/against/question/neutral).
- Keep it factual and simple.
- You may use light markdown for emphasis (bold/italic) when useful.
- Use citation markers [n] in the reply.
`.trim();
}
