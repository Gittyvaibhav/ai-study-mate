# StudyMate AI

**Turn messy notes into structured study material — flashcards, quizzes, grounded Q&A, and Socratic doubt-solving powered by Google Gemini.**

---

## Overview

Students often have lecture slides, scanned PDFs that are hard to review efficiently. StudyMate AI solves this by accepting those materials as uploads, extracting readable text (including from scanned documents via OCR), and using AI to break content into logical topic chunks, flashcards, and multiple-choice quizzes.

The app is built for students preparing for exams or revising coursework who want more than passive reading. After upload, you can flip through AI-generated flashcards, take a quiz scored on the client, ask questions that are answered only from your uploaded document, and track spaced-revision schedules so cards resurface when they are due. A separate **Doubt Solver** provides a four-step Socratic hint ladder for coding or conceptual questions — nudging you toward the answer instead of giving it immediately.

Everything is tied to a user account with JWT authentication. Documents, flashcards, quiz data, and doubt sessions persist in MongoDB. Uploaded files are processed transiently on disk and deleted after text extraction.

---

## Tech Stack

### Frontend
| Technology | Role |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Dev server and build tool (port 5173) |
| **React Router 7** | Client-side routing (`/dashboard`, `/docs/:id`, `/doubt`, etc.) |
| **Axios** | HTTP client with `withCredentials: true` for cookie auth |
| **Global CSS** (`src/styles.css`) | Dark-theme styling via CSS custom properties — no Tailwind, no component library |

### Backend
| Technology | Role |
|---|---|
| **Node.js (ES modules)** | Runtime |
| **Express 5** | REST API server |
| **MongoDB + Mongoose 8** | Persistent storage for users, documents, doubt sessions |
| **Multer** | Multipart file uploads (max 10 MB) |
| **bcryptjs** | Password hashing |
| **jsonwebtoken + cookie-parser** | JWT auth via httpOnly cookie (7-day expiry) |
| **CORS** | Restricted to `CLIENT_URL` and localhost dev origins |

### AI / ML
| Technology | Role |
|---|---|
| **Google Gemini** via `@google/generative-ai` | Structured content generation, grounded Q&A, Socratic hint ladders |
| **Primary models (fallback chain)** | `gemini-3.6-flash` → `gemini-3.5-flash-lite` |

Models were chosen for speed and cost efficiency on a student-facing demo: flash responses for upload generation, chat, and hint creation without needing a heavyweight reasoning model. The fallback chain handles model availability changes and transient rate limits.

### Document processing
| Technology | Role |
|---|---|
| **pdf-parse** | Fast embedded-text extraction from PDFs |
| **pdfjs-dist** | Secondary embedded-text extraction when pdf-parse yields too little text |
| **pdf-to-img** | Renders scanned PDF pages to images for OCR |
| **Tesseract.js** | OCR for images and scanned PDFs (English, `eng.traineddata`) |
| **sharp** | Image preprocessing before OCR (rotate, resize, grayscale, sharpen) |

### Other
| Technology | Role |
|---|---|
| **concurrently** | Root-level script to run backend + frontend together |
| **nodemon** | Backend hot reload in development |
| **localStorage** | Client-side fallback for flashcard revision metadata when revision API is unavailable |

---

## Features

### Document upload & topic breakdown

**What it does:** Upload a PDF, TXT, JPG, PNG, or WEBP file (≤ 10 MB). The app extracts text, stores the document, and optionally generates AI-structured topic chunks.

**How it works:**
1. `POST /api/docs/upload` receives the file via Multer (`upload.single("file")`) and saves it temporarily to `uploads/`.
2. Text extraction follows file type: images → Tesseract OCR; PDFs → `pdf-parse` → `pdfjs-dist` → OCR fallback (max 15 pages); TXT → UTF-8 read.
3. `splitTextIntoChunks()` in `chunkingService.js` splits text on blank lines into `{ heading, content }` pairs (heading = first sentence, max 70 chars).
4. A `Document` record is created in MongoDB with `rawText`, `chunks`, and `extractionMethod` (`embedded`, `ocr-pdf`, or `ocr-image`). The temp file is deleted.
5. `POST /api/docs/:id/generate` calls `generateStructuredContent()` which sends a sampled version of the document (up to 8 chunks / 12,000 chars) to Gemini and replaces `chunks`, `flashcards`, and `quiz` on the document.

### Flashcard generation

**What it does:** After generation, each document has 8–10 flip-card Q&A pairs. Users navigate cards in `FlashcardDeck`, flip to reveal answers, and mark revision confidence.

**How it works:**
1. Gemini is prompted to return JSON with a `flashcards` array (`{ question, answer }`).
2. `normalizeStructuredContent()` filters invalid entries and caps at 10 cards.
3. If Gemini fails (except missing API key), `buildLocalStructuredContent()` generates fallback cards from sentence/chunk summaries.
4. `FlashcardDeck.jsx` renders cards with prev/next navigation and a confidence picker (Easy / Medium / Hard).

### Quiz generation

**What it does:** Five multiple-choice questions per document, each with four options. Users select answers and submit for a client-side score.

**How it works:**
1. Gemini returns a `quiz` array: `{ question, options[4], correctIndex }`.
2. `normalizeStructuredContent()` validates exactly 4 options and caps at 5 questions.
3. `QuizView.jsx` renders questions from `document.quiz` — no separate API call. Scoring compares `answers[index] === item.correctIndex` entirely in the browser.

### Document-grounded doubt chat

**What it does:** In the **Chat** tab of a document, ask free-form questions. Answers use only the uploaded document's content.

**How it works:**
1. `POST /api/docs/:id/ask` receives `{ question }`.
2. `rankChunksByQuestion()` tokenizes the question, scores each chunk by keyword overlap, and returns the top 3 chunks.
3. `answerFromContext()` sends those chunks plus the question to Gemini with a grounded-assistant prompt ("only answer using the provided context").
4. `ChatBox.jsx` displays the `{ answer }` in a chat bubble UI.

### Socratic doubt solver (hint ladder)

**What it does:** A standalone feature at `/doubt` where you enter any question and receive up to four escalating hints — nudge → approach → pseudocode/structure → full explanation.

**How it works:**
1. `POST /api/doubt/start` calls `generateHintLadder()` which prompts Gemini for JSON `{ hints: [string×4] }`.
2. All four hints are generated upfront and stored in a `DoubtSession` document with `revealedCount: 1`.
3. `POST /api/doubt/:id/next` increments `revealedCount` and returns the next pre-generated hint — no additional Gemini call per hint.
4. `HintLadder.jsx` displays the current hint and a "Give me the next hint" button until `completed: true`.

### Revision tracker

**What it does:** Spaced-repetition scheduling for flashcards. A kanban-style dashboard (`/revision`) groups cards into **Due today**, **Due this week**, and **On track**. The main dashboard shows a banner when cards are due.

**How it works:**
1. After reviewing a flashcard, the user picks Easy / Medium / Hard.
2. `PATCH /api/docs/:id/flashcards/:flashcardIndex/revision` (or POST fallback) updates `lastRevisedAt`, `nextRevisionDue`, `intervalDays`, `revisionStreak`, and `confidenceHistory` on the flashcard sub-document.
3. Interval logic in `docController.calculateNextInterval()`: Easy → interval × 2 (max 30 days); Medium → interval + 1 day; Hard → reset to 1 day, streak → 0.
4. `revisionTracker.js` on the frontend computes status buckets and applies `localStorage` overrides (`studymate-revision-overrides`) if the revision endpoint returns 404/405.

---

## Architecture / Data Flow

```
User (browser)
  │
  ├─ Register/Login ──► POST /api/auth/register|login
  │                       └─► bcrypt hash → JWT cookie (7 days)
  │
  ├─ Upload (DocUpload.jsx)
  │     └─► POST /api/docs/upload  [multipart: file, title?]
  │           └─► uploadDocument() in docController.js
  │                 ├─ Image  → extractTextFromImage() [Tesseract + sharp]
  │                 ├─ PDF    → parseUploadedFile() [pdf-parse → pdfjs → OCR]
  │                 └─ TXT    → fs.readFile UTF-8
  │           └─► splitTextIntoChunks() → Document.create() → delete temp file
  │
  ├─ Generate (DocUpload.jsx, after upload)
  │     └─► POST /api/docs/:id/generate
  │           └─► generateStructuredContent() in geminiService.js
  │                 ├─ buildPromptDocument() — sample ≤8 chunks, ≤12k chars
  │                 ├─ runWithFallbackModels() — gemini-3.6-flash → gemini-3.5-flash-lite
  │                 ├─ extractJson() + normalizeStructuredContent()
  │                 └─ fallback: buildLocalStructuredContent() on Gemini failure
  │           └─► document.save() with chunks, flashcards, quiz
  │
  ├─ Study (DocView.jsx)
  │     ├─ Flashcards tab → FlashcardDeck.jsx
  │     ├─ Quiz tab       → QuizView.jsx (client-side scoring)
  │     └─ Chat tab       → ChatBox.jsx
  │           └─► POST /api/docs/:id/ask
  │                 └─► rankChunksByQuestion() → answerFromContext()
  │
  ├─ Revise flashcard
  │     └─► PATCH /api/docs/:id/flashcards/:index/revision { confidence }
  │           └─► calculateNextInterval() → update flashcard fields → save
  │
  └─ Doubt solver (DoubtSolver.jsx)
        └─► POST /api/doubt/start { question }
              └─► generateHintLadder() → DoubtSession.create()
        └─► POST /api/doubt/:id/next
              └─► increment revealedCount, return next stored hint
```

---

## API Reference

All routes except `/api/health` and auth register/login require authentication via JWT in the `token` httpOnly cookie or `Authorization: Bearer <token>` header.

### Health

#### `GET /api/health`
- **Purpose:** Server liveness check
- **Auth:** None
- **Response:** `{ "status": "ok" }`

---

### Auth

#### `POST /api/auth/register`
- **Purpose:** Create a new user account
- **Request body:** `{ "name": string, "email": string, "password": string }`
- **Response (201):** `{ "_id", "name", "email", "token" }` + sets `token` httpOnly cookie
- **Calls Gemini:** No
- **Errors:**
  - `400` — missing fields or user already exists
  - `500` — server error

#### `POST /api/auth/login`
- **Purpose:** Authenticate an existing user
- **Request body:** `{ "email": string, "password": string }`
- **Response (200):** `{ "_id", "name", "email", "token" }` + sets cookie
- **Calls Gemini:** No
- **Errors:**
  - `400` — missing email or password
  - `401` — invalid credentials
  - `500` — server error

#### `GET /api/auth/me`
- **Purpose:** Return the currently authenticated user
- **Auth:** Required
- **Response (200):** `{ "_id", "name", "email" }`
- **Calls Gemini:** No
- **Errors:** `401` if token missing/invalid; `500` if `JWT_SECRET` is not configured

---

### Documents

#### `GET /api/docs`
- **Purpose:** List all documents for the authenticated user
- **Auth:** Required
- **Response (200):** `Document[]` sorted by `createdAt` descending
- **Calls Gemini:** No

#### `POST /api/docs/upload`
- **Purpose:** Upload and extract text from a study file
- **Auth:** Required
- **Request:** `multipart/form-data` with field `file` (required) and optional `title`
- **Allowed types:** PDF, TXT, JPG, PNG, WEBP — max 10 MB
- **Response (201):** Full `Document` object including `_id`, `title`, `rawText`, `chunks`, `extractionMethod`, `extractionNote`
- **Calls Gemini:** No
- **Errors:**
  - `400` — no file, unreadable text (< 20 chars for PDF/image), or unsupported file type
  - `500` — extraction or save failure

#### `POST /api/docs/:id/generate`
- **Purpose:** Generate AI chunks, flashcards, and quiz from uploaded document text
- **Auth:** Required
- **Request body:** None
- **Response (200):** Updated `Document` with populated `chunks`, `flashcards`, `quiz`
- **Calls Gemini:** Yes — `generateStructuredContent()` via `gemini-3.6-flash` → `gemini-3.5-flash-lite`
- **Prompt:** Structured JSON output (5–10 chunks, 8–10 flashcards, 5 quiz questions); see [Gemini Integration](#gemini--ai-integration-details)
- **Errors:**
  - `404` — document not found or not owned by user
  - `429` — Gemini rate limit (only if API key missing causes throw; otherwise falls back locally)
  - `500` — generation failure

#### `GET /api/docs/:id`
- **Purpose:** Fetch a single document with all study content
- **Auth:** Required
- **Response (200):** Full `Document` object
- **Calls Gemini:** No
- **Errors:** `404` — not found

#### `POST /api/docs/:id/ask`
- **Purpose:** Ask a grounded question about a document
- **Auth:** Required
- **Request body:** `{ "question": string }`
- **Response (200):** `{ "answer": string, "chunksUsed": [{ "heading", "content" }] }`
- **Calls Gemini:** Yes — `answerFromContext()` with top 3 ranked chunks
- **Errors:**
  - `400` — missing question
  - `404` — document not found
  - `429` — Gemini rate limit
  - `500` — answer failure

#### `PATCH /api/docs/:id/flashcards/:flashcardIndex/revision`
#### `POST /api/docs/:id/flashcards/:flashcardIndex/revision`
- **Purpose:** Record a flashcard revision with spaced-repetition scheduling
- **Auth:** Required
- **Request body:** `{ "confidence": "easy" | "medium" | "hard" }`
- **Response (200):** `{ "flashcard": {...}, "flashcardIndex": number, "documentId": string }`
- **Calls Gemini:** No
- **Errors:**
  - `400` — invalid confidence or flashcard index
  - `404` — document or flashcard not found
  - `500` — save failure

---

### Doubt sessions

#### `GET /api/doubt`
- **Purpose:** List all doubt sessions for the authenticated user
- **Auth:** Required
- **Response (200):** `DoubtSession[]` sorted by `createdAt` descending
- **Calls Gemini:** No

#### `POST /api/doubt/start`
- **Purpose:** Start a Socratic hint-ladder session
- **Auth:** Required
- **Request body:** `{ "question": string }`
- **Response (201):** `{ "sessionId", "question", "hint", "revealedCount", "totalHints" }`
- **Calls Gemini:** Yes — `generateHintLadder()` returns 4 hints upfront
- **Errors:**
  - `400` — missing question
  - `429` — Gemini rate limit
  - `500` — hint generation failure

#### `POST /api/doubt/:id/next`
- **Purpose:** Reveal the next pre-generated hint
- **Auth:** Required
- **Request body:** None
- **Response (200):** `{ "sessionId", "hint", "revealedCount", "totalHints", "completed": boolean }`
- **Calls Gemini:** No (hints were stored at session start)
- **Errors:**
  - `404` — session not found
  - `429` — only if upstream error message contains rate limit (unlikely here)
  - `500` — server error

---

## Gemini / AI Integration Details

### Models

```javascript
MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-3.5-flash-lite"]
```

The service tries `gemini-3.6-flash` first, then falls back to `gemini-3.5-flash-lite` on 404/missing-model or rate-limit errors. Deprecated model name patterns (`gemini-1.*`, `gemini-2.0-*`) trigger console warnings if ever configured.

**Why these models:** Both are fast, cost-effective flash variants suited for structured JSON generation, short Q&A, and hint creation in a student demo without long latency.

### Prompt structure

| Function | Strategy |
|---|---|
| `generateStructuredContent()` | Single user prompt requesting **only valid JSON** (no markdown fences) with explicit schema for `chunks`, `flashcards`, `quiz`. Document text appended after rules. No separate system message — role is embedded in the prompt ("You are helping a student study…"). |
| `answerFromContext()` | Grounded assistant prompt with numbered chunk context. Instructs model to refuse if answer is not in context. |
| `generateHintLadder()` | Socratic tutor prompt requesting JSON `{ hints: [×4] }` with escalating depth instructions (nudge → approach → pseudocode → full explanation). |

JSON parsing uses `extractJson()` — tries direct `JSON.parse`, then regex extraction of the last `{...}` block.

### Rate limits & resilience

| Mechanism | Detail |
|---|---|
| **Per-request timeout** | 25 seconds (`GEMINI_TIMEOUT_MS`) |
| **Retry** | One retry after 1.2 s delay on 429, rate-limit, timeout, or 503 errors |
| **Model fallback** | On 404 or rate limit, tries next model in `MODEL_CANDIDATES` |
| **Local fallback** | `generateStructuredContent()` only — falls back to `buildLocalStructuredContent()` on any Gemini failure except missing `GEMINI_API_KEY` |
| **No fallback** | `answerFromContext()` and `generateHintLadder()` surface rate-limit errors as HTTP 429 |

### Token / cost footprint (approximate)

| Feature | Input size cap | Notes |
|---|---|---|
| Structured generation | ≤ 12,000 chars of document text (≤ 8 chunks) | Single Gemini call; largest prompt of the three features |
| Document Q&A | Top 3 ranked chunks (unbounded chunk size, typically paragraph-length) | One call per question |
| Hint ladder | Question text only | One call per doubt session (4 hints generated at once) |

Exact token counts depend on document length and Gemini pricing tier. Prompt sampling intentionally truncates long documents to stay within free-tier limits.

---

## Database / Storage Schema

MongoDB via Mongoose. Three collections:

### `User`

| Field | Type | Notes |
|---|---|---|
| `name` | String, required | Trimmed |
| `email` | String, required, unique | Lowercased |
| `password` | String, required | bcrypt hash, `select: false` |
| `createdAt`, `updatedAt` | Date | Auto timestamps |

### `Document`

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | Owner |
| `title` | String, required | From form or filename |
| `rawText` | String, required | Extracted upload text |
| `extractionMethod` | `"embedded"` \| `"ocr-pdf"` \| `"ocr-image"` | How text was obtained |
| `extractionNote` | String | e.g. "Only the first 15 pages were processed for OCR." |
| `chunks` | `[{ heading, content }]` | Topic sections |
| `flashcards` | See below | Generated study cards |
| `quiz` | See below | Multiple-choice questions |
| `createdAt`, `updatedAt` | Date | Auto timestamps |

**Flashcard sub-schema:**

| Field | Type | Default | Notes |
|---|---|---|---|
| `question` | String | — | Required |
| `answer` | String | — | Required |
| `lastRevisedAt` | Date | `null` | Set on revision |
| `nextRevisionDue` | Date | `null` | Spaced-repetition due date |
| `revisionStreak` | Number | `0` | Resets on "hard" |
| `intervalDays` | Number | `1` | Current interval |
| `confidenceHistory` | `[String]` | `[]` | Last 5 entries: `"sure"` \| `"guessed"` \| `"wrong"` |

**Quiz sub-schema:**

| Field | Type | Notes |
|---|---|---|
| `question` | String | Required |
| `options` | `[String]` | Exactly 4 options |
| `correctIndex` | Number | 0–3 |

### `DoubtSession`

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | Owner |
| `question` | String | User's original question |
| `hints` | `[String]` | Exactly 4 pre-generated hints |
| `revealedCount` | Number | 1–4, how many hints shown |
| `createdAt`, `updatedAt` | Date | Auto timestamps |

### File storage

Uploaded files are written to `{backend}/uploads/` by Multer and **deleted immediately** after text extraction in `uploadDocument()`. Only extracted text persists in MongoDB.

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone and install

```bash
git clone <your-repo-url>
cd "ai study mate"
npm install
npm install --prefix studymate-ai/backend
npm install --prefix studymate-ai/frontend
```

### 2. Configure environment

**Backend** — copy and fill in `studymate-ai/backend/.env`:

```bash
cp studymate-ai/backend/.env.example studymate-ai/backend/.env
```

| Variable | Description |
|---|---|
| `PORT` | Backend server port (default `5000`) |
| `MONGO_URI` | MongoDB connection string (e.g. `mongodb://localhost:27017/studymate-ai`) |
| `JWT_SECRET` | Long random string for signing JWT tokens |
| `GEMINI_API_KEY` | Google Gemini API key — required for AI features |
| `CLIENT_URL` | Frontend origin for CORS (default `http://localhost:5173`) |

**Frontend** — copy and fill in `studymate-ai/frontend/.env`:

```bash
cp studymate-ai/frontend/.env.example studymate-ai/frontend/.env
```

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (default `http://localhost:5000/api`) |

### 3. Run

**Both apps from project root:**

```bash
npm run dev
```

This runs the backend (`nodemon`, port 5000) and frontend (`vite`, port 5173) concurrently.

**Or separately:**

```bash
# Terminal 1 — backend
cd studymate-ai/backend
npm run dev

# Terminal 2 — frontend
cd studymate-ai/frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, and upload your first document.

---

## Known Limitations

- **Gemini free-tier rate limits** — Heavy use (multiple uploads + chat + doubt sessions in quick succession) can hit 429 errors. Structured generation has a local fallback; chat and doubt solver do not.
- **OCR quality** — Scanned PDFs and photos depend on image clarity. Only the first **15 pages** of scanned PDFs are OCR'd. Low-contrast or skewed images may fail the 20-character minimum text threshold.
- **Long documents truncated for AI** — Only the first 8 chunks (max 12,000 characters) are sent to Gemini for generation. Very long notes may not be fully represented in flashcards/quiz.
- **Quiz scoring is client-side only** — Results are not persisted to the database.
- **No server-side logout** — Logout clears client state only; the JWT cookie remains valid until expiry (7 days).
- **Cookie security** — `secure: false` in development; production deployment must set `secure: true` behind HTTPS.
- **No email verification or password reset.**
- **Revision localStorage fallback** — If the revision API is unavailable, the frontend stores overrides in `localStorage`, which does not sync across devices or browsers.
- **Single-user document isolation** — Documents are scoped to the authenticated user; no sharing or collaboration.
- **Model availability** — Model names (`gemini-3.6-flash`, `gemini-3.5-flash-lite`) depend on Google's current API offerings; unavailable models trigger fallback or errors.

---

## Future Improvements

- **Voice quiz mode** — Spoken questions and answers for hands-free revision
- **Quiz result persistence** — Save scores and highlight weak topics over time
- **Regenerate individual flashcards** — Refresh a single card without reprocessing the entire document
- **PDF export** — Download generated flashcards and quiz as a printable study sheet
- **Collaborative study groups** — Share documents and compete on quiz scores
- **Production hardening** — HTTPS-only cookies, refresh tokens, rate limiting middleware, and structured logging
- **Smarter chunking** — Semantic chunking (headings, slide boundaries) instead of paragraph splitting
- **Streaming chat responses** — Token-by-token rendering for document Q&A
- **Multi-language OCR** — Support beyond English Tesseract model
- **Offline mode** — Service worker cache for flashcard review without network

---

## Project structure

```
ai study mate/
├── package.json              # Root scripts (concurrently)
└── studymate-ai/
    ├── backend/
    │   └── src/
    │       ├── server.js
    │       ├── config/db.js
    │       ├── controllers/  # auth, docs, doubt
    │       ├── middleware/   # auth, upload
    │       ├── models/       # User, Document, DoubtSession
    │       ├── routes/
    │       └── services/     # gemini, ocr, pdf, chunking
    └── frontend/
        └── src/
            ├── pages/        # Dashboard, DocUpload, DocView, DoubtSolver, RevisionDashboard
            ├── components/   # FlashcardDeck, QuizView, ChatBox, HintLadder
            ├── services/     # API wrappers
            └── utils/        # revisionTracker, apiErrors
```
