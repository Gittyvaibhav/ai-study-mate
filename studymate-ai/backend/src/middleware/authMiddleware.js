import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireEnv } from "../utils/env.js";

export const protect = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.token;
    const tokenFromHeader = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    const decoded = jwt.verify(token, requireEnv("JWT_SECRET"));
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    const message = error.message || "";
    if (message.includes("Missing required environment variable")) {
      return res.status(500).json({ message });
    }

    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};
