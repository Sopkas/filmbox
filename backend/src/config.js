import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const configFileDir = path.dirname(fileURLToPath(import.meta.url));
const backendRootDir = path.resolve(configFileDir, "..");
dotenv.config({ path: path.join(backendRootDir, ".env") });
dotenv.config({ path: path.join(backendRootDir, ".env.local"), override: true });

const requiredEnv = ["DATABASE_URL", "JWT_SECRET", "POISKKINO_API_KEY"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function parseCorsOrigins(raw) {
  if (!raw || !raw.trim()) {
    return ["http://localhost:5173", "http://localhost:5174"];
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.some((origin) => origin === "*")) {
    throw new Error("CORS_ORIGIN must list specific origins when credentials are enabled");
  }

  return origins;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  poiskkinoApiKey: process.env.POISKKINO_API_KEY,
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  mockGoogle: process.env.MOCK_GOOGLE === "true",
  polzaApiKey: process.env.POLZA_API_KEY || "",
  polzaBaseUrl: process.env.POLZA_BASE_URL || "https://api.polza.ai/api/v1",
  polzaModel: process.env.POLZA_MODEL || "google/gemini-3.1-flash-lite-preview",
  mockPoiskkino: process.env.MOCK_POISKKINO === "true",
  poiskkinoCacheTtlMs: Number(process.env.POISKKINO_CACHE_TTL_MS || 5 * 60 * 1000),
  poiskkinoCacheMaxEntries: Number(process.env.POISKKINO_CACHE_MAX_ENTRIES || 100),
  poiskkinoThrottleMs: Number(process.env.POISKKINO_THROTTLE_MS || 300),
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  recommendRateLimitWindowMs: Number(process.env.RECOMMEND_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  recommendRateLimitMax: Number(process.env.RECOMMEND_RATE_LIMIT_MAX || 20),
  trustProxy: process.env.TRUST_PROXY === "true",
  authCookieName: process.env.AUTH_COOKIE_NAME || "kinopulse_token",
  authCookieMaxAgeMs: Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)
};
