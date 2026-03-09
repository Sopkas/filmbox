import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requestContext } from "./middleware/request-context.js";
import authRoutes from "./routes/auth.routes.js";
import moviesRoutes from "./routes/movies.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import collectionsRoutes from "./routes/collections.routes.js";
import recommendationsRoutes from "./routes/recommendations.routes.js";

export function createApp() {
  const app = express();

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(requestContext);
  if (config.nodeEnv === "production") {
    app.use(
      helmet({
        contentSecurityPolicy: false
      })
    );
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        if (config.corsOrigin.includes(origin)) {
          return callback(null, true);
        }

        const error = new Error("CORS origin is not allowed");
        error.statusCode = 403;
        return callback(error);
      },
      credentials: true
    })
  );
  app.use(express.json());

  const authLimiter = rateLimit({
    windowMs: config.authRateLimitWindowMs,
    max: config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many auth requests, please try again later"
    }
  });

  const recommendationsLimiter = rateLimit({
    windowMs: config.recommendRateLimitWindowMs,
    max: config.recommendRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many recommendation requests, please try again later"
    }
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true, requestId: req.requestId });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/movies", moviesRoutes);
  app.use("/api/reviews", reviewsRoutes);
  app.use("/api/collections", collectionsRoutes);
  app.use("/api/recommendations", recommendationsLimiter, recommendationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
