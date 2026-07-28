import mongoose from "mongoose";

const doubtSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, required: true },
    hints: [{ type: String, required: true }],
    revealedCount: { type: Number, default: 1, min: 1, max: 4 }
  },
  { timestamps: true }
);

export default mongoose.model("DoubtSession", doubtSessionSchema);
