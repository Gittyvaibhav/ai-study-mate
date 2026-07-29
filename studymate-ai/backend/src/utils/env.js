const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET", "GEMINI_API_KEY", "CLIENT_URL"];

export const requireEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const validateRequiredEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new Error(`Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }
};
