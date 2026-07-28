import { useState } from "react";
import HintLadder from "../components/HintLadder";
import { getNextHint, startDoubtSession } from "../services/doubtService";
import { getApiErrorMessage } from "../utils/apiErrors";

const DoubtSolver = () => {
  const [question, setQuestion] = useState("");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startSession = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!question.trim()) {
      setError("Enter a question first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await startDoubtSession(question.trim());
      setSession({
        sessionId: data.sessionId,
        question: data.question,
        currentHint: data.hint,
        revealedCount: data.revealedCount,
        totalHints: data.totalHints,
        completed: data.revealedCount >= data.totalHints
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to start doubt session"));
    } finally {
      setLoading(false);
    }
  };

  const loadNextHint = async () => {
    if (loading || !session?.sessionId || session.completed) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getNextHint(session.sessionId);
      setSession((current) => ({
        ...current,
        currentHint: data.hint,
        revealedCount: data.revealedCount,
        totalHints: data.totalHints,
        completed: data.completed
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load next hint"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack narrow">
      <section className="card">
        <h1>Doubt solver</h1>
        <p>Enter a question and reveal the solution one hint at a time.</p>
        <form className="stack gap-md" onSubmit={startSession}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} placeholder="Ask a coding or conceptual question..." />
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? "Generating hints..." : "Start hint ladder"}</button>
        </form>
      </section>

      {session ? (
        <section className="stack gap-md">
          <div className="card">
            <h2>{session.question}</h2>
          </div>
          <HintLadder
            currentHint={session.currentHint}
            revealedCount={session.revealedCount}
            totalHints={session.totalHints}
            onNext={loadNextHint}
            loading={loading}
          />
        </section>
      ) : null}
    </div>
  );
};

export default DoubtSolver;
