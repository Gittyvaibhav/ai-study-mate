const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "it",
  "as",
  "at",
  "by",
  "from",
  "what",
  "when",
  "why",
  "how",
  "which"
]);

const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));

export const splitTextIntoChunks = (rawText) => {
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [{ heading: "Main Content", content: rawText.trim() }];
  }

  return paragraphs.map((content, index) => {
    const firstSentence = content.split(/[.!?]/)[0]?.trim();
    return {
      heading: firstSentence ? firstSentence.slice(0, 70) : `Section ${index + 1}`,
      content
    };
  });
};

export const rankChunksByQuestion = (question, chunks) => {
  const questionTokens = tokenize(question);

  return chunks
    .map((chunk) => {
      const chunkTokens = tokenize(`${chunk.heading} ${chunk.content}`);
      const uniqueChunkTokens = new Set(chunkTokens);
      const overlap = questionTokens.reduce((score, token) => score + (uniqueChunkTokens.has(token) ? 1 : 0), 0);
      return { ...chunk, score: overlap };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score, ...chunk }) => chunk);
};
