import { useState } from "react";
import { askDocumentQuestion } from "../services/documentService";
import { getApiErrorMessage } from "../utils/apiErrors";

const ChatBox = ({ docId }) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = async (event) => {
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
      const trimmedQuestion = question.trim();
      const userMessage = { role: "user", text: trimmedQuestion };
      setMessages((current) => [...current, userMessage]);
      const answer = await askDocumentQuestion(docId, trimmedQuestion);
      setMessages((current) => [...current, { role: "assistant", text: answer.answer }]);
      setQuestion("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to get an answer"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-thread">
        {messages.length === 0 ? <div className="empty-state">Ask a question grounded in this document.</div> : null}
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble ${message.role}`}>
            {message.text}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleAsk}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the uploaded document..." rows={3} />
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>{loading ? "Thinking..." : "Ask"}</button>
      </form>
    </div>
  );
};

export default ChatBox;
