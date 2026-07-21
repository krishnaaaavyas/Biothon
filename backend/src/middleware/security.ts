import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const positiveInteger = (name: string, fallback: number) => {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const allowedOrigins = () => {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.length) return configured;
  return process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"];
};

export const createRateLimiter = () => rateLimit({
  windowMs: positiveInteger("RATE_LIMIT_WINDOW_MS", 60_000),
  limit: positiveInteger("RATE_LIMIT_MAX_REQUESTS", 100),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: "RATE_LIMIT_EXCEEDED" }),
});

export const securityMiddleware = [
  helmet(),
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("x-request-id", req.header("x-request-id") || crypto.randomUUID());
    next();
  },
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins().includes(origin)) return callback(null, true);
      return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"));
    },
    credentials: true,
  }),
  createRateLimiter(),
];
