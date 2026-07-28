const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "studymate-revision-overrides";
const confidenceMap = {
  easy: "sure",
  medium: "guessed",
  hard: "wrong"
};

export const normalizeRevision = (flashcard = {}) => ({
  ...flashcard,
  lastRevisedAt: flashcard.lastRevisedAt || null,
  nextRevisionDue: flashcard.nextRevisionDue || null,
  revisionStreak: flashcard.revisionStreak || 0,
  intervalDays: flashcard.intervalDays || 1,
  confidenceHistory: flashcard.confidenceHistory || []
});

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return "Never revised";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Never revised";
  }

  const diffDays = Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);

  if (diffDays <= 0) {
    return "Last revised today";
  }

  if (diffDays === 1) {
    return "Last revised yesterday";
  }

  return `Last revised ${diffDays} days ago`;
};

export const getRevisionStatus = (nextRevisionDue) => {
  if (!nextRevisionDue) {
    return "due-today";
  }

  const dueDate = new Date(nextRevisionDue);
  if (Number.isNaN(dueDate.getTime())) {
    return "due-today";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  if (dueDate <= new Date()) {
    return "due-today";
  }

  if (dueDate <= weekEnd) {
    return "due-week";
  }

  return "on-track";
};

export const getRevisionStatusLabel = (status) => {
  if (status === "due-today") {
    return "Due today";
  }

  if (status === "due-week") {
    return "Due this week";
  }

  return "On track";
};

export const collectRevisionItems = (documents = []) =>
  documents
    .flatMap((doc) =>
      (doc.flashcards || []).map((flashcard, index) => {
        const normalized = normalizeRevision(flashcard);
        const status = getRevisionStatus(normalized.nextRevisionDue);

        return {
          ...normalized,
          documentId: doc._id,
          documentTitle: doc.title,
          flashcardIndex: index,
          status
        };
      })
    )
    .sort((a, b) => {
      const aTime = a.nextRevisionDue ? new Date(a.nextRevisionDue).getTime() : 0;
      const bTime = b.nextRevisionDue ? new Date(b.nextRevisionDue).getTime() : 0;
      return aTime - bTime;
    });

export const countDueToday = (documents = []) =>
  collectRevisionItems(documents).filter((item) => item.status === "due-today").length;

const readRevisionOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (_error) {
    return {};
  }
};

const writeRevisionOverrides = (overrides) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
};

const calculateIntervalDays = (currentInterval, confidence) => {
  const interval = Math.max(Number(currentInterval) || 1, 1);

  if (confidence === "easy") {
    return Math.min(interval * 2, 30);
  }

  if (confidence === "medium") {
    return interval + 1;
  }

  return 1;
};

export const buildRevisionUpdate = (flashcard, confidence) => {
  const current = normalizeRevision(flashcard);
  const lastRevisedAt = new Date();
  const intervalDays = calculateIntervalDays(current.intervalDays, confidence);
  const nextRevisionDue = new Date(lastRevisedAt);
  nextRevisionDue.setDate(nextRevisionDue.getDate() + intervalDays);

  return {
    ...current,
    lastRevisedAt: lastRevisedAt.toISOString(),
    nextRevisionDue: nextRevisionDue.toISOString(),
    revisionStreak: confidence === "hard" ? 0 : current.revisionStreak + 1,
    intervalDays,
    confidenceHistory: [
      ...current.confidenceHistory,
      confidenceMap[confidence]
    ].slice(-5)
  };
};

export const saveLocalRevision = (documentId, flashcardIndex, flashcard) => {
  const overrides = readRevisionOverrides();
  const documentRevisions = overrides[documentId] || {};
  documentRevisions[flashcardIndex] = {
    lastRevisedAt: flashcard.lastRevisedAt,
    nextRevisionDue: flashcard.nextRevisionDue,
    revisionStreak: flashcard.revisionStreak,
    intervalDays: flashcard.intervalDays,
    confidenceHistory: flashcard.confidenceHistory
  };

  writeRevisionOverrides({
    ...overrides,
    [documentId]: documentRevisions
  });
};

export const applyLocalRevisions = (documents = []) => {
  const overrides = readRevisionOverrides();

  return documents.map((doc) => {
    const documentRevisions = overrides[doc._id];
    if (!documentRevisions) {
      return doc;
    }

    return {
      ...doc,
      flashcards: (doc.flashcards || []).map((flashcard, index) => ({
        ...flashcard,
        ...(documentRevisions[index] || {})
      }))
    };
  });
};
