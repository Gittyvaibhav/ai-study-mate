import jwt from "jsonwebtoken";
import { requireEnv } from "./env.js";

export const generateToken = (id) => {
  return jwt.sign({ id }, requireEnv("JWT_SECRET"), { expiresIn: "7d" });
};
