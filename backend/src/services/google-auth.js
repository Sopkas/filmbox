import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

const oauthClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseMockGoogleToken(idToken) {
  const prefix = "mock-google:";
  if (!idToken.startsWith(prefix)) {
    throw createHttpError(401, "Invalid Google token");
  }

  const raw = idToken.slice(prefix.length);
  const [sub, email, name = "Google User"] = raw.split("|");

  if (!sub || !email) {
    throw createHttpError(401, "Invalid Google token");
  }

  return {
    sub: String(sub).trim(),
    email: String(email).trim(),
    name: String(name).trim(),
    emailVerified: true
  };
}

export async function verifyGoogleIdentityToken(idToken) {
  const token = String(idToken || "").trim();
  if (!token) {
    throw createHttpError(400, "Google token is required");
  }

  if (config.mockGoogle) {
    return parseMockGoogleToken(token);
  }

  if (!config.googleClientId || !oauthClient) {
    throw createHttpError(503, "Google OAuth не настроен: укажите GOOGLE_CLIENT_ID");
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: config.googleClientId
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      throw createHttpError(401, "Invalid Google token");
    }

    if (payload.email_verified === false) {
      throw createHttpError(403, "Google email is not verified");
    }

    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name || ""),
      emailVerified: payload.email_verified !== false
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw createHttpError(401, "Invalid Google token");
  }
}
