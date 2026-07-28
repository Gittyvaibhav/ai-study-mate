import DoubtSession from "../models/DoubtSession.js";
import { generateHintLadder } from "../services/geminiService.js";

export const startDoubtSession = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ message: "Question is required" });
    }

    const hints = await generateHintLadder(question);
    const session = await DoubtSession.create({
      user: req.user._id,
      question,
      hints,
      revealedCount: 1
    });

    return res.status(201).json({
      sessionId: session._id,
      question: session.question,
      hint: session.hints[0],
      revealedCount: session.revealedCount,
      totalHints: session.hints.length
    });
  } catch (error) {
    const message = error.message || "Failed to start doubt session";
    const statusCode = message.includes("rate limit") ? 429 : 500;
    return res.status(statusCode).json({ message });
  }
};

export const nextHint = async (req, res) => {
  try {
    const session = await DoubtSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) {
      return res.status(404).json({ message: "Doubt session not found" });
    }

    if (session.revealedCount >= session.hints.length) {
      return res.json({
        sessionId: session._id,
        hint: session.hints[session.hints.length - 1],
        revealedCount: session.revealedCount,
        totalHints: session.hints.length,
        completed: true
      });
    }

    session.revealedCount += 1;
    await session.save();

    return res.json({
      sessionId: session._id,
      hint: session.hints[session.revealedCount - 1],
      revealedCount: session.revealedCount,
      totalHints: session.hints.length,
      completed: session.revealedCount >= session.hints.length
    });
  } catch (error) {
    const message = error.message || "Failed to load next hint";
    const statusCode = message.includes("rate limit") ? 429 : 500;
    return res.status(statusCode).json({ message });
  }
};

export const listDoubtSessions = async (req, res) => {
  const sessions = await DoubtSession.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json(sessions);
};
