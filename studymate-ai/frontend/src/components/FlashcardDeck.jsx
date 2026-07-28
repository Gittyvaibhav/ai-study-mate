import { useState } from "react";
import { formatRelativeTime, normalizeRevision } from "../utils/revisionTracker";

const getRevisionErrorMessage = (err) => {
  if (err.response?.data?.message) {
    return err.response.data.message;
  }

  if (err.response?.status) {
    return `Revision save failed with status ${err.response.status}`;
  }

  return "Could not reach the server. Restart the backend and try again.";
};

const FlashcardDeck = ({ flashcards, onReviseFlashcard }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [confirmingRevision, setConfirmingRevision] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState("");

  if (!flashcards?.length) {
    return <div className="empty-state">No flashcards generated yet.</div>;
  }

  const card = normalizeRevision(flashcards[activeIndex]);
  const nextDueLabel = card.nextRevisionDue
    ? `Next due ${new Date(card.nextRevisionDue).toLocaleDateString()}`
    : "Revision not scheduled yet";

  const handleRevise = async (confidence) => {
    if (!onReviseFlashcard) {
      return;
    }

    setSavingRevision(true);
    setRevisionError("");

    try {
      await onReviseFlashcard(activeIndex, confidence);
      setConfirmingRevision(false);
    } catch (err) {
      setRevisionError(getRevisionErrorMessage(err));
    } finally {
      setSavingRevision(false);
    }
  };

  const moveToCard = (nextIndex) => {
    setFlipped(false);
    setConfirmingRevision(false);
    setRevisionError("");
    setActiveIndex(nextIndex);
  };

  return (
    <div className="flashcard-panel">
      <div className="revision-meta">
        <span>{formatRelativeTime(card.lastRevisedAt)}</span>
        <span>{nextDueLabel}</span>
        <span>{card.intervalDays} day interval</span>
      </div>
      <div className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)}>
        <div className="flashcard-face flashcard-front">
          <span className="chip">Question</span>
          <p>{card.question}</p>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="chip">Answer</span>
          <p>{card.answer}</p>
        </div>
      </div>
      <div className="revision-actions">
        {confirmingRevision ? (
          <div className="revision-confirm">
            <div className="stack stack-tight">
              <span>How well did you remember this?</span>
              {revisionError ? <span className="error-text compact">{revisionError}</span> : null}
            </div>
            <div className="revision-buttons">
              <button className="success-button" onClick={() => handleRevise("easy")} disabled={savingRevision}>Easy</button>
              <button className="warning-button" onClick={() => handleRevise("medium")} disabled={savingRevision}>Medium</button>
              <button className="danger-button" onClick={() => handleRevise("hard")} disabled={savingRevision}>Hard</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmingRevision(true)} disabled={!onReviseFlashcard}>Mark as Revised</button>
        )}
      </div>
      <div className="flashcard-controls">
        <button onClick={() => moveToCard(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>Previous</button>
        <span>{activeIndex + 1} / {flashcards.length}</span>
        <button onClick={() => moveToCard(Math.min(flashcards.length - 1, activeIndex + 1))} disabled={activeIndex === flashcards.length - 1}>Next</button>
      </div>
    </div>
  );
};

export default FlashcardDeck;
