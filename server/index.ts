import express, { type Request, Response, NextFunction } from "express";
import { ensureDatabaseSchema, getDatabaseStartupErrorMessage } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await ensureDatabaseSchema();
  } catch (error) {
    console.error(`\nSkillSwap could not initialize its database: ${getDatabaseStartupErrorMessage(error)}`);
    console.error("Check DATABASE_URL in .env and ensure the database and credentials are correct.\n");
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.name === "ZodError" ? 400 : err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal server error" : err.message || "Invalid request";

    if (status >= 500) {
      console.error(`[api:error] ${req.method} ${req.path}`, {
        status,
        message: err.message,
        stack: err.stack,
      });
    } else if (status >= 400) {
      console.warn(`[api:client-error] ${req.method} ${req.path}`, {
        status,
        message: err.message,
      });
    }

    if (!res.headersSent) res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT || 5000);
server.listen(port, () => {
  log(`serving on http://localhost:${port}`);
});

})();
