import axiosClient from "../api/axiosClient";

export const getCurrentUser = async () => {
  const { data } = await axiosClient.get("/auth/me");
  return data;
};

export const loginUser = async (credentials) => {
  const { data } = await axiosClient.post("/auth/login", credentials);
  return data;
};

export const registerUser = async (profile) => {
  const { data } = await axiosClient.post("/auth/register", profile);
  return data;
};
