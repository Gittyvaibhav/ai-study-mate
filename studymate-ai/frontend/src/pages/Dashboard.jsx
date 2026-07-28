import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments } from "../services/documentService";
import { listDoubtSessions } from "../services/doubtService";
import { getApiErrorMessage } from "../utils/apiErrors";
import { applyLocalRevisions, countDueToday } from "../utils/revisionTracker";

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [documentsResponse, doubtsResponse] = await Promise.all([
          listDocuments(),
          listDoubtSessions()
        ]);
        setDocuments(applyLocalRevisions(documentsResponse));
        setDoubts(doubtsResponse);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load dashboard"));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="page-state">Loading dashboard...</div>;
  }

  const dueTodayCount = countDueToday(documents);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <h1>Study dashboard</h1>
          <p>Manage uploaded docs and recent doubt sessions in one place.</p>
        </div>
        <div className="hero-actions">
          <Link className="button-link" to="/docs/upload">Upload document</Link>
          <Link className="button-link secondary" to="/doubt">Start doubt solver</Link>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
      {dueTodayCount ? (
        <div className="revision-banner">
          <span>You have {dueTodayCount} {dueTodayCount === 1 ? "topic" : "topics"} due for revision today.</span>
          <Link to="/revision">Open Revision Tracker</Link>
        </div>
      ) : null}

      <div className="grid-2">
        <section className="card">
          <div className="section-header">
            <h2>Your documents</h2>
            <Link to="/docs/upload">Add new</Link>
          </div>
          {documents.length ? documents.map((doc) => (
            <Link key={doc._id} to={`/docs/${doc._id}`} className="list-item">
              <strong>{doc.title}</strong>
              <span>{new Date(doc.createdAt).toLocaleString()}</span>
            </Link>
          )) : <div className="empty-state">No documents uploaded yet.</div>}
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Recent doubts</h2>
            <Link to="/doubt">New doubt</Link>
          </div>
          {doubts.length ? doubts.map((session) => (
            <div key={session._id} className="list-item stack-tight">
              <strong>{session.question}</strong>
              <span>{session.revealedCount}/{session.hints.length} hints used</span>
            </div>
          )) : <div className="empty-state">No doubt sessions yet.</div>}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
