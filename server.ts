import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import app from "./api/_app.js";
import cronHandler from "./api/cron-check.js";
import { liveDerivDaemon } from "./api/_lib/liveDerivDaemon.js";

// Load environment variables
dotenv.config();

function startAutonomousBackgroundWorker() {
  const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds (covers minutes 1, 2, 3, 4 without gaps)
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(expressStaticMiddleware(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startAutonomousBackgroundWorker();
    liveDerivDaemon.start();
  });
}

function expressStaticMiddleware(distPath: string) {
  const express = require('express');
  return express.static(distPath);
}

startServer();
