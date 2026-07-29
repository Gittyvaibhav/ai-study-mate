import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import docRoutes from "./routes/docRoutes.js";
import doubtRoutes from "./routes/doubtRoutes.js";
import { validateRequiredEnv } from "./utils/env.js";

dotenv.config();
validateRequiredEnv();

const app = express();
const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174"
  ].filter(Boolean)
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get(["/favicon.ico", "/favicon.png"], (_req, res) => {
  res.status(204).end();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

app.use("/api", async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/docs", docRoutes);
app.use("/api/doubt", doubtRoutes);

app.use((error, _req, res, _next) => {
  const message = error?.message || "Server error";
  const statusCode = message.includes("Only PDF") ? 400 : 500;
  res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Running on port ${PORT}`);
  });
};

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
