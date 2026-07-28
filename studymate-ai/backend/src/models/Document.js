import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true },
    content: { type: String, required: true }
  },
  { _id: false }
);

const flashcardSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    lastRevisedAt: { type: Date, default: null },
    nextRevisionDue: { type: Date, default: null },
    revisionStreak: { type: Number, default: 0 },
    intervalDays: { type: Number, default: 1 },
    confidenceHistory: {
      type: [{ type: String, enum: ["sure", "guessed", "wrong"] }],
      default: []
    }
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true, min: 0, max: 3 }
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    rawText: { type: String, required: true },
    extractionMethod: {
      type: String,
      enum: ["embedded", "ocr-pdf", "ocr-image"],
      default: "embedded"
    },
    extractionNote: { type: String, default: "" },
    chunks: [chunkSchema],
    flashcards: [flashcardSchema],
    quiz: [quizSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
