import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.routes.js";
import moviesRoutes from "./routes/movies.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import collectionsRoutes from "./routes/collections.routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/movies", moviesRoutes);
  app.use("/api/reviews", reviewsRoutes);
  app.use("/api/collections", collectionsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

