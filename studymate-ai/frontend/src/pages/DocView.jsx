import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import FlashcardDeck from "../components/FlashcardDeck";
import QuizView from "../components/QuizView";
import { getDocument, saveFlashcardRevision } from "../services/documentService";
import { getApiErrorMessage } from "../utils/apiErrors";
import { applyLocalRevisions, buildRevisionUpdate, saveLocalRevision } from "../utils/revisionTracker";

const DocView = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [activeTab, setActiveTab] = useState("flashcards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const loadedDocument = await getDocument(id);
        setDocument(applyLocalRevisions([loadedDocument])[0]);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load document"));
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id]);

  const handleReviseFlashcard = async (flashcardIndex, confidence) => {
    let revisionResponse;

    try {
      revisionResponse = await saveFlashcardRevision(id, flashcardIndex, confidence);
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 405) {
        throw err;
      }

      const currentFlashcard = document?.flashcards?.[flashcardIndex];
      const updatedFlashcard = buildRevisionUpdate(currentFlashcard, confidence);
      saveLocalRevision(id, flashcardIndex, updatedFlashcard);
      revisionResponse = { flashcard: updatedFlashcard, flashcardIndex };
    }

    setDocument((currentDocument) => {
      if (!currentDocument) {
        return currentDocument;
      }

      const flashcards = [...(currentDocument.flashcards || [])];
      flashcards[revisionResponse.flashcardIndex] = revisionResponse.flashcard;

      return { ...currentDocument, flashcards };
    });
  };

  if (loading) {
    return <div className="page-state">Loading document...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (!document) {
    return <div className="empty-state">Document not found.</div>;
  }

  const isOcrDocument = document.extractionMethod?.startsWith("ocr");
  const extractionLabel =
    document.extractionMethod === "ocr-image"
      ? "Extracted via OCR from image"
      : document.extractionMethod === "ocr-pdf"
        ? "Extracted via OCR from PDF"
        : "Extracted from embedded text";

  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <div className="stack stack-tight">
          <h1>{document.title}</h1>
          <p>Study from generated flashcards, quizzes, and grounded document chat.</p>
          <span className="chip">{extractionLabel}</span>
          {isOcrDocument ? (
            <p className="helper-text">Extracted via OCR — please double check flashcards for accuracy.</p>
          ) : null}
          {document.extractionNote ? <p className="helper-text">{document.extractionNote}</p> : null}
        </div>
      </section>

      <div className="tab-bar">
        <button className={activeTab === "flashcards" ? "active" : ""} onClick={() => setActiveTab("flashcards")}>Flashcards</button>
        <button className={activeTab === "quiz" ? "active" : ""} onClick={() => setActiveTab("quiz")}>Quiz</button>
        <button className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>Chat</button>
      </div>

      {activeTab === "flashcards" ? <FlashcardDeck flashcards={document.flashcards} onReviseFlashcard={handleReviseFlashcard} /> : null}
      {activeTab === "quiz" ? <QuizView quiz={document.quiz} /> : null}
      {activeTab === "chat" ? <ChatBox docId={document._id} /> : null}
    </div>
  );
};

export default DocView;
