import mongoose from "mongoose";
import { requireEnv } from "../utils/env.js";

let connectionPromise;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(requireEnv("MONGO_URI"));
  }

  try {
    await connectionPromise;
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;
    console.error("MongoDB connection failed:", error.message);
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};
