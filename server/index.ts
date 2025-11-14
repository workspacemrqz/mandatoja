import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { startAgentScheduler } from "./scheduler";
import { pool } from "./db";

const app = express();

// Trust proxy for production deployment (Replit uses a proxy)
if (process.env.NODE_ENV === "production") {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

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
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // Windows does not support SO_REUSEPORT; omit reusePort for portability
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
      
      setImmediate(() => {
        (async () => {
          log('[Initialization] Starting background tasks...');
          
          try {
            startAgentScheduler(storage);
            log('[Scheduler] Agent scheduler started successfully');
          } catch (error) {
            console.error('[Scheduler] Failed to start agent scheduler:', error);
          }
          
          try {
            const { initializePgVector } = await import("./lib/init-pgvector.js");
            await initializePgVector();
            log('[PgVector] Vector database initialized successfully');
          } catch (error) {
            console.error('[PgVector] Failed to initialize pgvector:', error);
          }
          
          try {
            const { startCloneAgentWorker } = await import("./workers/clone-agent-worker.js");
            startCloneAgentWorker();
            log('[Clone Agent Worker] Worker started successfully');
          } catch (error) {
            console.error('[Clone Agent Worker] Failed to start worker:', error);
          }
          
          try {
            const { startScheduledMessagesWorker } = await import("./workers/scheduled-messages-worker.js");
            startScheduledMessagesWorker();
            log('[Scheduled Messages Worker] Worker started successfully');
          } catch (error) {
            console.error('[Scheduled Messages Worker] Failed to start worker:', error);
          }
          
          try {
            const { startMilitantAgentWorker } = await import("./workers/militant-agent-worker.js");
            startMilitantAgentWorker();
            log('[Militant Agent Worker] Worker started successfully');
          } catch (error) {
            console.error('[Militant Agent Worker] Failed to start worker:', error);
          }
          
          log('[Initialization] All background tasks initialized');
        })();
      });
    });
    
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
