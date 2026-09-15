import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./db";
import { loadOptionalUser, requireAuth } from "./auth";
import { storage, toPublicUser } from "./storage";
import { normalizeEmail, normalizeSkills, safeUser } from "./utils";
import { rankMatches } from "./matching";
import { swapRequestStatuses, type SwapRequestStatus } from "@shared/schema";

const PgSession = connectPgSimple(session);
const availabilityValues = ["weekdays", "weekends", "evenings", "flexible"] as const;
const skillSchema = z.array(z.string().trim().min(1).max(60)).max(20).default([]);

const registrationSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
  email: z.string().email().transform(normalizeEmail),
  location: z.string().trim().max(100).optional().nullable(),
  avatar: z.string().url().max(500).optional().nullable(),
  skillsOffered: skillSchema,
  skillsWanted: skillSchema,
  availability: z.array(z.enum(availabilityValues)).max(4).default([]),
  isPublic: z.boolean().default(true),
});

const loginSchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  password: z.string().min(1),
});

const profileSchema = registrationSchema.omit({ password: true, username: true }).partial().extend({
  email: z.string().email().transform(normalizeEmail).optional(),
});

const requestSchema = z.object({
  toUserId: z.coerce.number().int().positive(),
  message: z.string().trim().max(1000).optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(swapRequestStatuses),
});

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  skill: z.string().trim().max(60).optional(),
  offeredSkill: z.string().trim().max(60).optional(),
  wantedSkill: z.string().trim().max(60).optional(),
  availability: z.enum(availabilityValues).optional(),
  location: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "rating", "newest"]).default("name"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

function establishSession(req: Request, userId: number) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function publicResponse(user: Awaited<ReturnType<typeof storage.getUser>>) {
  return user ? toPublicUser(user) : null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required to start the application");
  }

  app.set("trust proxy", 1);
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({ pool, createTableIfMissing: true }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const data = registrationSchema.parse(req.body);
      if (await storage.getUserByEmail(data.email) || await storage.getUserByUsername(data.username)) {
        return res.status(409).json({ message: "Email or username is already in use" });
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await storage.createUser({
        username: data.username,
        passwordHash,
        name: data.name,
        email: data.email,
        location: data.location ?? null,
        avatar: data.avatar ?? null,
        skillsOffered: normalizeSkills(data.skillsOffered),
        skillsWanted: normalizeSkills(data.skillsWanted),
        availability: data.availability,
        isPublic: data.isPublic,
      });
      await establishSession(req, user.id);
      return res.status(201).json({ user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      await establishSession(req, user.id);
      return res.json({ user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("connect.sid");
      return res.status(204).send();
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: safeUser(req.user!) });
  });

  app.get("/api/users/public", loadOptionalUser, async (req, res, next) => {
    try {
      const query = querySchema.parse(req.query);
      const result = await storage.getPublicUsers({
        ...query,
        currentUserId: req.user?.id,
        offeredSkill: query.offeredSkill ?? query.skill,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/me", requireAuth, (req, res) => {
    res.json({ user: safeUser(req.user!) });
  });

  app.get("/api/matches", requireAuth, async (req, res, next) => {
    try {
      const currentUser = toPublicUser(req.user!);
      const candidates = await storage.getAllPublicUsers(req.user!.id);
      res.json({ matches: rankMatches(currentUser, candidates) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/users/me", requireAuth, async (req, res, next) => {
    try {
      const data = profileSchema.parse(req.body);
      const email = data.email ? normalizeEmail(data.email) : undefined;
      if (email && email !== req.user!.email && await storage.getUserByEmail(email)) {
        return res.status(409).json({ message: "Email is already in use" });
      }

      const user = await storage.updateUser(req.user!.id, {
        ...(data.name === undefined ? {} : { name: data.name }),
        ...(email === undefined ? {} : { email }),
        ...(data.location === undefined ? {} : { location: data.location ?? null }),
        ...(data.avatar === undefined ? {} : { avatar: data.avatar ?? null }),
        ...(data.skillsOffered === undefined ? {} : { skillsOffered: normalizeSkills(data.skillsOffered) }),
        ...(data.skillsWanted === undefined ? {} : { skillsWanted: normalizeSkills(data.skillsWanted) }),
        ...(data.availability === undefined ? {} : { availability: data.availability }),
        ...(data.isPublic === undefined ? {} : { isPublic: data.isPublic }),
      });
      res.json({ user: safeUser(user!) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:id", loadOptionalUser, async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const user = await storage.getUser(id);
      if (!user || (!user.isPublic && user.id !== req.user?.id)) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user: user.id === req.user?.id ? safeUser(user) : toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/swap-requests", requireAuth, async (req, res, next) => {
    try {
      res.json({ requests: await storage.getSwapRequestsByUser(req.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/swap-requests", requireAuth, async (req, res, next) => {
    try {
      const data = requestSchema.parse(req.body);
      if (data.toUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot request yourself" });
      }
      const recipient = await storage.getUser(data.toUserId);
      if (!recipient || !recipient.isPublic) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      const existing = await storage.getSwapRequestsByUser(req.user!.id);
      if (existing.some((request) => ["pending", "accepted"].includes(request.status) && (
        (request.fromUserId === req.user!.id && request.toUserId === data.toUserId) ||
        (request.fromUserId === data.toUserId && request.toUserId === req.user!.id)
      ))) {
        return res.status(409).json({ message: "An active request already exists" });
      }

      const swapRequest = await storage.createSwapRequest({
        fromUserId: req.user!.id,
        toUserId: data.toUserId,
        message: data.message ?? null,
      });
      res.status(201).json({ request: swapRequest });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/swap-requests/user/:userId", requireAuth, async (req, res, next) => {
    try {
      const userId = z.coerce.number().int().positive().parse(req.params.userId);
      if (userId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
      res.json({ requests: await storage.getSwapRequestsByUser(userId) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/swap-requests/:id/status", requireAuth, async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { status } = statusSchema.parse(req.body);
      const request = await storage.getSwapRequest(id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") return res.status(409).json({ message: "Only pending requests can change status" });

      const isRecipientAction = ["accepted", "rejected"].includes(status) && request.toUserId === req.user!.id;
      const isSenderCancellation = status === "cancelled" && request.fromUserId === req.user!.id;
      if (!isRecipientAction && !isSenderCancellation) return res.status(403).json({ message: "Forbidden" });

      const updatedRequest = await storage.updateSwapRequestStatus(id, status as SwapRequestStatus);
      res.json({ request: updatedRequest });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/swap-requests/:id", requireAuth, async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const request = await storage.getSwapRequest(id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.fromUserId !== req.user!.id || request.status !== "pending") {
        return res.status(403).json({ message: "Only the sender can cancel a pending request" });
      }
      const updatedRequest = await storage.updateSwapRequestStatus(id, "cancelled");
      res.json({ request: updatedRequest });
    } catch (error) {
      next(error);
    }
  });

  return createServer(app);
}
