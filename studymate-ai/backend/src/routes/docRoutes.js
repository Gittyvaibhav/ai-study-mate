import express from "express";
import { askDocument, generateDocumentContent, getDocument, listDocuments, reviseFlashcard, uploadDocument } from "../controllers/docController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", protect, listDocuments);
router.post("/upload", protect, upload.single("file"), uploadDocument);
router.post("/:id/generate", protect, generateDocumentContent);
router.post("/:id/ask", protect, askDocument);
router.post("/:id/flashcards/:flashcardIndex/revision", protect, reviseFlashcard);
router.patch("/:id/flashcards/:flashcardIndex/revision", protect, reviseFlashcard);
router.get("/:id", protect, getDocument);

export default router;
