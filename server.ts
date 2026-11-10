import path from "path";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";
import app from "./api/_app.js";
import cronHandler from "./api/cron-check.js";
import { liveDerivDaemon } from "./api/_lib/liveDerivDaemon.js";

// Load environment variables
dotenv.config();

function startAutonomousBackgroundWorker() {
  const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
  let isRunning = false;

  const runWorkerPass = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const mockReq = { method: 'GET', query: { checkOnly: '0' }, body: {} };
      const mockRes = {
        setHeader: () => {},
        status: () => mockRes,
        json: () => {},
        end: () => {},
      };
      await (cronHandler as any)(mockReq, mockRes);
    } catch (err) {
      console.error('[Autonomous Worker] Background check error:', err);
    } finally {
      isRunning = false;
    }
  };

  // Initial pass after 10 seconds
  setTimeout(runWorkerPass, 10000);
  // Recurring 60s daemon
  setInterval(runWorkerPass, CHECK_INTERVAL_MS);

  console.log('[Autonomous Worker] 24/7 Background Market Daemon active (running every 60s)');
}

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Render & Production Health Check Endpoints (instant 200 OK for deploy health checks)
  app.get("/healthz", (_req, res) => {
    res.status(200).send("OK");
  });
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    hasDist;

  if (isProduction && hasDist) {
    console.log(`[Server] Serving production build from ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("[Server] Starting Vite development server middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] 🚀 Successfully listening on 0.0.0.0:${PORT} (Production: ${isProduction})`);
    try {
      startAutonomousBackgroundWorker();
    } catch (err) {
      console.error("[Server] Error initializing autonomous worker:", err);
    }
    try {
      liveDerivDaemon.start();
    } catch (err) {
      console.error("[Server] Error initializing live Deriv daemon:", err);
    }
  });

  server.on("error", (err: any) => {
    console.error("[Server] Critical listener error:", err);
  });
}

startServer().catch((err) => {
  console.error("[Server] Failed to start server:", err);
  process.exit(1);
});
