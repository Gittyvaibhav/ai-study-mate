import fs from "fs/promises";
import Document from "../models/Document.js";
import { extractTextFromImage } from "../services/ocrService.js";
import { parseUploadedFile } from "../services/pdfParserService.js";
import { answerFromContext, generateStructuredContent } from "../services/geminiService.js";
import { rankChunksByQuestion, splitTextIntoChunks } from "../services/chunkingService.js";

const cleanupUploadedFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore cleanup failures.
  }
};

export const uploadDocument = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a PDF, TXT, or image file" });
    }

    const isImageFile = req.file.mimetype?.startsWith("image/");
    const isPdfFile = req.file.mimetype === "application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf");

    let parsedText = "";
    let extractionMethod = "embedded";
    let extractionNote = "";

    if (isImageFile) {
      parsedText = await extractTextFromImage(filePath);
      extractionMethod = "ocr-image";
    } else if (isPdfFile) {
      const parsed = await parseUploadedFile(filePath, req.file.originalname);
      parsedText = parsed.text || "";
      extractionMethod = parsed.method === "ocr" ? "ocr-pdf" : "embedded";

      if (parsed.ocrMeta?.truncated) {
        extractionNote = "Only the first 15 pages were processed for OCR.";
      }
    } else {
      const parsed = await parseUploadedFile(filePath, req.file.originalname);
      parsedText = parsed.text || "";
      extractionMethod = parsed.method || "embedded";
    }

    const cleanedText = parsedText.trim();

    if ((isImageFile || isPdfFile) && cleanedText.length < 20) {
      return res.status(400).json({
        message: "We couldn't extract readable text from this file. Try a clearer scan, better lighting, or type your notes as .txt instead."
      });
    }

    if (!cleanedText && !isImageFile && !isPdfFile) {
      return res.status(400).json({ message: "Uploaded file did not contain readable text" });
    }

    const title = req.body.title?.trim() || req.file.originalname.replace(/\.[^.]+$/, "");
    const chunks = splitTextIntoChunks(cleanedText);

    const document = await Document.create({
      user: req.user._id,
      title,
      rawText: cleanedText,
      extractionMethod,
      extractionNote,
      chunks
    });

    return res.status(201).json({
      ...document.toObject(),
      ...(extractionNote ? { extractionNote } : {})
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to upload document" });
  } finally {
    await cleanupUploadedFile(filePath);
  }
};

export const generateDocumentContent = async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const structuredContent = await generateStructuredContent(document.rawText);
    document.chunks = structuredContent.chunks;
    document.flashcards = structuredContent.flashcards;
    document.quiz = structuredContent.quiz;
    await document.save();

    return res.json(document);
  } catch (error) {
    const message = error.message || "Failed to generate document content";
    const statusCode = message.includes("rate limit") ? 429 : 500;
    return res.status(statusCode).json({ message });
  }
};

export const askDocument = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ message: "Question is required" });
    }

    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const chunksToUse = rankChunksByQuestion(question, document.chunks?.length ? document.chunks : splitTextIntoChunks(document.rawText));
    const answer = await answerFromContext(question, chunksToUse);
    return res.json({ answer, chunksUsed: chunksToUse });
  } catch (error) {
    const message = error.message || "Failed to answer question";
    const statusCode = message.includes("rate limit") ? 429 : 500;
    return res.status(statusCode).json({ message });
  }
};

const confidenceMap = {
  easy: "sure",
  medium: "guessed",
  hard: "wrong"
};

const calculateNextInterval = (currentInterval, confidence) => {
  const interval = Math.max(Number(currentInterval) || 1, 1);

  if (confidence === "easy") {
    return Math.min(interval * 2, 30);
  }

  if (confidence === "medium") {
    return interval + 1;
  }

  return 1;
};

export const reviseFlashcard = async (req, res) => {
  try {
    const { confidence } = req.body;
    const flashcardIndex = Number(req.params.flashcardIndex);

    if (!["easy", "medium", "hard"].includes(confidence)) {
      return res.status(400).json({ message: "Confidence must be easy, medium, or hard" });
    }

    if (!Number.isInteger(flashcardIndex) || flashcardIndex < 0) {
      return res.status(400).json({ message: "Invalid flashcard index" });
    }

    const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const flashcard = document.flashcards[flashcardIndex];
    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    const now = new Date();
    const nextInterval = calculateNextInterval(flashcard.intervalDays, confidence);
    const nextRevisionDue = new Date(now);
    nextRevisionDue.setDate(nextRevisionDue.getDate() + nextInterval);

    flashcard.lastRevisedAt = now;
    flashcard.intervalDays = nextInterval;
    flashcard.nextRevisionDue = nextRevisionDue;
    flashcard.revisionStreak = confidence === "hard" ? 0 : (flashcard.revisionStreak || 0) + 1;
    flashcard.confidenceHistory = [
      ...(flashcard.confidenceHistory || []),
      confidenceMap[confidence]
    ].slice(-5);

    await document.save();

    return res.json({ flashcard, flashcardIndex, documentId: document._id });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update revision" });
  }
};

export const listDocuments = async (req, res) => {
  const documents = await Document.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json(documents);
};

export const getDocument = async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, user: req.user._id });
  if (!document) {
    return res.status(404).json({ message: "Document not found" });
  }

  return res.json(document);
};
