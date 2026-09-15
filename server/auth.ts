import type { NextFunction, Request, Response } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function loadOptionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.session.userId) req.user = await storage.getUser(req.session.userId);
    next();
  } catch (error) {
    next(error);
  }
}