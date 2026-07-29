import { GoogleGenerativeAI } from "@google/generative-ai";
import { splitTextIntoChunks } from "./chunkingService.js";
import { requireEnv } from "../utils/env.js";

const MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
const MAX_PROMPT_CHARS = 12000;
const MAX_PROMPT_CHUNKS = 8;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000);
const GEMINI_RETRY_DELAY_MS = 1200;
const DEPRECATED_PATTERNS = [/^gemini-1\./, /^gemini-2\.0-/];

MODEL_CANDIDATES.forEach((name) => {
  if (DEPRECATED_PATTERNS.some((pattern) => pattern.test(name))) {
    console.warn(`[geminiService] Warning: "${name}" appears to be a deprecated Gemini model.`);
  }
});

const getGenAI = () => {
  return new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
};

const getModel = (modelName) => {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({ model: modelName });
};

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const isRetryableGeminiError = (error) => {
  const message = error?.message?.toLowerCase() || "";
  return message.includes("429") || message.includes("rate limit") || message.includes("timeout") || message.includes("503");
};

const withTimeout = (promise, timeoutMs, label) => {
  let timeoutId;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const generateWithBoundedRetry = async (model, prompt, modelName) => {
  try {
    return await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, `Gemini model ${modelName}`);
  } catch (error) {
    if (!isRetryableGeminiError(error)) {
      throw error;
    }

    // One short retry smooths over rate-limit jitter without creating a runaway demo request.
    await wait(GEMINI_RETRY_DELAY_MS);
    return withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, `Gemini model ${modelName}`);
  }
};

const runWithFallbackModels = async (prompt) => {
  let lastError;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = getModel(modelName);
      const result = await generateWithBoundedRetry(model, prompt, modelName);
      return result.response.text();
    } catch (error) {
      lastError = error;
      const message = error?.message || "Unknown Gemini error";
      const isMissingModel =
        message.includes("404") ||
        message.includes("no longer available") ||
        message.toLowerCase().includes("not found") ||
        message.toLowerCase().includes("not_found");
      const isRateLimit = message.includes("429") || message.toLowerCase().includes("rate limit");

      if (isMissingModel || isRateLimit) {
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("Gemini generation failed");
};

const extractJson = (text) => {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}$/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw new Error("Gemini did not return valid JSON");
  }
};

const normalizeStructuredContent = (payload, rawText) => {
  const chunks = Array.isArray(payload?.chunks)
    ? payload.chunks
        .filter((chunk) => chunk?.heading && chunk?.content)
        .map((chunk) => ({ heading: String(chunk.heading).trim(), content: String(chunk.content).trim() }))
    : splitTextIntoChunks(rawText);

  const flashcards = Array.isArray(payload?.flashcards)
    ? payload.flashcards
        .filter((item) => item?.question && item?.answer)
        .slice(0, 10)
        .map((item) => ({ question: String(item.question).trim(), answer: String(item.answer).trim() }))
    : [];

  const quiz = Array.isArray(payload?.quiz)
    ? payload.quiz
        .filter((item) => item?.question && Array.isArray(item?.options) && item.options.length === 4)
        .slice(0, 5)
        .map((item) => ({
          question: String(item.question).trim(),
          options: item.options.slice(0, 4).map((option) => String(option).trim()),
          correctIndex: Number.isInteger(item.correctIndex) ? item.correctIndex : 0
        }))
    : [];

  return { chunks, flashcards, quiz };
};

const splitIntoSentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const summarizeText = (text, maxLength = 180) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
};

const buildLocalStructuredContent = (rawText) => {
  const chunks = splitTextIntoChunks(rawText).slice(0, 8).map((chunk) => ({
    heading: summarizeText(chunk.heading || "Main Idea", 70),
    content: summarizeText(chunk.content || rawText, 420)
  }));

  const sentencePool = splitIntoSentences(rawText);
  const flashcards = (chunks.length ? chunks : [{ heading: "Main Idea", content: rawText }])
    .slice(0, 8)
    .map((chunk) => ({
      question: `What is the main point of ${chunk.heading}?`,
      answer: summarizeText(chunk.content, 220)
    }));

  while (flashcards.length < 8 && sentencePool.length) {
    const sentence = sentencePool.shift();
    flashcards.push({
      question: "What does this note say?",
      answer: summarizeText(sentence, 220)
    });
  }

  const quiz = (chunks.length ? chunks : [{ heading: "Main Idea", content: rawText }])
    .slice(0, 5)
    .map((chunk, index) => {
      const otherHeadings = chunks
        .filter((_otherChunk, otherIndex) => otherIndex !== index)
        .map((otherChunk) => otherChunk.heading)
        .filter(Boolean)
        .slice(0, 3);

      const correctOption = summarizeText(chunk.content, 90);
      const fallbackOptions = [
        correctOption,
        otherHeadings[0] || "A supporting detail from the notes",
        otherHeadings[1] || "A related but different topic",
        otherHeadings[2] || "An unrelated distractor"
      ];

      return {
        question: `Which option best matches ${chunk.heading}?`,
        options: fallbackOptions,
        correctIndex: 0
      };
    });

  while (quiz.length < 5 && chunks.length) {
    const chunk = chunks[quiz.length % chunks.length];
    quiz.push({
      question: `Which statement best describes ${chunk.heading}?`,
      options: [
        summarizeText(chunk.content, 90),
        "A supporting detail from another section",
        "A contrasting idea",
        "A definition from outside the notes"
      ],
      correctIndex: 0
    });
  }

  return { chunks, flashcards, quiz };
};

const buildPromptDocument = (rawText) => {
  const normalizedText = rawText.replace(/\r\n/g, "\n").trim();

  if (!normalizedText) {
    return "";
  }

  const chunks = splitTextIntoChunks(normalizedText).slice(0, MAX_PROMPT_CHUNKS);
  const sampledText = chunks.map((chunk) => `${chunk.heading}\n${chunk.content}`).join("\n\n").trim();

  if (sampledText.length <= MAX_PROMPT_CHARS) {
    return sampledText;
  }

  return sampledText.slice(0, MAX_PROMPT_CHARS);
};

export const generateStructuredContent = async (rawText) => {
  const promptDocument = buildPromptDocument(rawText);
  const prompt = `You are helping a student study from the provided document.
Return ONLY valid JSON and nothing else. Do not use markdown fences.
Use exactly this shape:
{
  "chunks": [{ "heading": string, "content": string }],
  "flashcards": [{ "question": string, "answer": string }],
  "quiz": [{ "question": string, "options": [string, string, string, string], "correctIndex": number }]
}
Rules:
- Create 5 to 10 logical chunks with short headings.
- Create 8 to 10 flashcards.
- Create 5 quiz questions with exactly 4 answer options each.
- Keep everything grounded in the document only.
- If the document is short, still return valid arrays and reuse the most important ideas.
- If the document is long, focus on the most important sections below instead of trying to mirror every line.

Document:
${promptDocument}`;

  try {
    const text = await runWithFallbackModels(prompt);
    const payload = extractJson(text);
    return normalizeStructuredContent(payload, rawText);
  } catch (error) {
    const message = error?.message || "Unknown Gemini error";
    if (message.includes("Missing required environment variable")) {
      throw error;
    }

    return buildLocalStructuredContent(rawText);
  }
};

export const answerFromContext = async (question, contextChunks) => {
  const contextText = contextChunks
    .map((chunk, index) => `Chunk ${index + 1}\nHeading: ${chunk.heading}\nContent: ${chunk.content}`)
    .join("\n\n");

  const prompt = `You are a grounded study assistant.
Only answer using the provided context.
If the answer is not in the context, say that you cannot find it in the uploaded document.
Do not use outside knowledge.

Question: ${question}

Context:
${contextText}`;

  try {
    return (await runWithFallbackModels(prompt)).trim();
  } catch (error) {
    const message = error?.message || "Unknown Gemini error";
    if (message.includes("429")) {
      throw new Error("Gemini rate limit hit. Please wait a moment and retry.");
    }
    throw new Error(`Failed to answer from context: ${message}`);
  }
};

export const generateHintLadder = async (question) => {
  const prompt = `You are a Socratic tutor.
Return ONLY valid JSON and nothing else. Do not use markdown fences.
Create exactly 4 hints for the question below.
The hints must escalate in depth:
1. A gentle nudge.
2. A stronger approach hint.
3. A pseudocode or structure hint.
4. A full explanation that still teaches the method without being overly terse.
Use this shape:
{ "hints": [string, string, string, string] }

Question: ${question}`;

  try {
    const text = await runWithFallbackModels(prompt);
    const payload = extractJson(text);
    const hints = Array.isArray(payload?.hints) ? payload.hints.map((hint) => String(hint).trim()).filter(Boolean) : [];

    if (hints.length !== 4) {
      throw new Error("Gemini did not return four hints");
    }

    return hints;
  } catch (error) {
    const message = error?.message || "Unknown Gemini error";
    if (message.includes("429")) {
      throw new Error("Gemini rate limit hit. Please wait a moment and retry.");
    }
    throw new Error(`Failed to generate hint ladder: ${message}`);
  }
};
