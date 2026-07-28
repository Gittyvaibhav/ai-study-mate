import express from "express";
import { listDoubtSessions, nextHint, startDoubtSession } from "../controllers/doubtController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listDoubtSessions);
router.post("/start", protect, startDoubtSession);
router.post("/:id/next", protect, nextHint);

export default router;
