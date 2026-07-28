import axiosClient from "../api/axiosClient";

export const listDoubtSessions = async () => {
  const { data } = await axiosClient.get("/doubt");
  return data;
};

export const startDoubtSession = async (question) => {
  const { data } = await axiosClient.post("/doubt/start", { question });
  return data;
};

export const getNextHint = async (sessionId) => {
  const { data } = await axiosClient.post(`/doubt/${sessionId}/next`);
  return data;
};
