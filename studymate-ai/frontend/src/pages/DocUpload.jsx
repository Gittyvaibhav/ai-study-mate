import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateDocumentContent, uploadDocument } from "../services/documentService";
import { getApiErrorMessage } from "../utils/apiErrors";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".jpg", ".jpeg", ".png", ".webp"];

const validateUploadFile = (selectedFile) => {
  if (!selectedFile) {
    return "Choose a PDF, TXT, or image file first";
  }

  const extension = selectedFile.name.slice(selectedFile.name.lastIndexOf(".")).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(selectedFile.type) && !ALLOWED_EXTENSIONS.includes(extension)) {
    return "Upload a PDF, TXT, JPG, PNG, or WEBP file";
  }

  if (selectedFile.size > MAX_UPLOAD_BYTES) {
    return "File must be 10 MB or smaller";
  }

  return "";
};

const DocUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const likelyOcrUpload = Boolean(
    file && (file.type.startsWith("image/") || (file.type === "application/pdf" && file.size > 2 * 1024 * 1024))
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      const uploadedDocument = await uploadDocument(formData);

      await generateDocumentContent(uploadedDocument._id);
      navigate(`/docs/${uploadedDocument._id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack narrow">
      <section className="card">
        <h1>Upload study notes</h1>
        <p>Upload a PDF, TXT, or image file to generate flashcards, quizzes, and grounded chat.</p>
        <form className="stack gap-md" onSubmit={handleSubmit}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" />
          <input
            type="file"
            accept="application/pdf,text/plain,image/jpeg,image/png,image/webp,.pdf,.txt,.jpg,.jpeg,.png,.webp"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          {loading && likelyOcrUpload ? (
            <p className="helper-text">Reading your notes... this may take a bit longer for scanned or handwritten pages.</p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? <span className="loading-label">{likelyOcrUpload ? "Reading notes..." : "Uploading..."}</span> : "Upload and generate"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default DocUpload;
