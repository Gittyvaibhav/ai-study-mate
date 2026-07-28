import axiosClient from "../api/axiosClient";

export const listDocuments = async () => {
  const { data } = await axiosClient.get("/docs");
  return data;
};

export const getDocument = async (documentId) => {
  const { data } = await axiosClient.get(`/docs/${documentId}`);
  return data;
};

export const uploadDocument = async (formData) => {
  const { data } = await axiosClient.post("/docs/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
};

export const generateDocumentContent = async (documentId) => {
  const { data } = await axiosClient.post(`/docs/${documentId}/generate`);
  return data;
};

export const askDocumentQuestion = async (documentId, question) => {
  const { data } = await axiosClient.post(`/docs/${documentId}/ask`, { question });
  return data;
};

export const saveFlashcardRevision = async (documentId, flashcardIndex, confidence) => {
  const revisionPath = `/docs/${documentId}/flashcards/${flashcardIndex}/revision`;

  try {
    const { data } = await axiosClient.patch(revisionPath, { confidence });
    return data;
  } catch (error) {
    if (error.response?.status && error.response.status !== 404 && error.response.status !== 405) {
      throw error;
    }

    const { data } = await axiosClient.post(revisionPath, { confidence });
    return data;
  }
};
