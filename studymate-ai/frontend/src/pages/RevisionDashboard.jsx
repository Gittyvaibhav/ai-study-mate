import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments } from "../services/documentService";
import { getApiErrorMessage } from "../utils/apiErrors";
import { applyLocalRevisions, collectRevisionItems, formatRelativeTime, getRevisionStatusLabel } from "../utils/revisionTracker";

const statusCopy = {
  "due-today": "Red zone",
  "due-week": "This week",
  "on-track": "Steady"
};

const RevisionDashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const documentsResponse = await listDocuments();
        setDocuments(applyLocalRevisions(documentsResponse));
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load revision tracker"));
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const revisionItems = useMemo(() => collectRevisionItems(documents), [documents]);
  const groupedItems = useMemo(() => ({
    "due-today": revisionItems.filter((item) => item.status === "due-today"),
    "due-week": revisionItems.filter((item) => item.status === "due-week"),
    "on-track": revisionItems.filter((item) => item.status === "on-track")
  }), [revisionItems]);

  if (loading) {
    return <div className="page-state">Loading revision tracker...</div>;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <h1>Revision Tracker</h1>
          <p>See what needs another pass, sorted by the next due date.</p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary" to="/dashboard">Back to dashboard</Link>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="revision-board">
        {Object.entries(groupedItems).map(([status, items]) => (
          <section key={status} className={`card revision-column ${status}`}>
            <div className="section-header">
              <div>
                <h2>{getRevisionStatusLabel(status)}</h2>
                <span>{statusCopy[status]}</span>
              </div>
              <span className="score-pill">{items.length}</span>
            </div>

            {items.length ? items.map((item) => (
              <Link
                key={`${item.documentId}-${item.flashcardIndex}`}
                to={`/docs/${item.documentId}`}
                className="revision-item"
              >
                <span className="revision-doc">{item.documentTitle}</span>
                <strong>{item.question}</strong>
                <span>{formatRelativeTime(item.lastRevisedAt)}</span>
                <span>{item.nextRevisionDue ? `Due ${new Date(item.nextRevisionDue).toLocaleDateString()}` : "Due now"}</span>
              </Link>
            )) : (
              <div className="empty-state">Nothing here right now.</div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default RevisionDashboard;
