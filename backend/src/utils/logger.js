const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "authorization",
  "auth",
  "jwt",
  "secret"
]);

function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const next = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        next[key] = "[REDACTED]";
      } else {
        next[key] = redact(nested);
      }
    }
    return next;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  return value;
}

function writeLog(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...redact(meta)
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function createLogger(baseMeta = {}) {
  const base = redact(baseMeta);

  return {
    child(extraMeta = {}) {
      return createLogger({ ...base, ...redact(extraMeta) });
    },
    debug(message, meta = {}) {
      writeLog("debug", message, { ...base, ...meta });
    },
    info(message, meta = {}) {
      writeLog("info", message, { ...base, ...meta });
    },
    warn(message, meta = {}) {
      writeLog("warn", message, { ...base, ...meta });
    },
    error(message, meta = {}) {
      writeLog("error", message, { ...base, ...meta });
    }
  };
}

export const logger = createLogger({ service: "kinopulse-backend" });
