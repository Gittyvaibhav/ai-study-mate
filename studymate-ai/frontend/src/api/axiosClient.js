import axios from "axios";

const defaultApiUrl = "http://localhost:5000/api";
const configuredApiUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const baseURL = configuredApiUrl.endsWith("/api")
  ? configuredApiUrl
  : `${configuredApiUrl.replace(/\/$/, "")}/api`;

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000
});

export default axiosClient;
