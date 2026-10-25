import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import our handlers
import loginHandler from "./api/login";
import checkHandler from "./api/auth/check";
import logoutHandler from "./api/logout";
import { handleHeartbeat, handleGetDevices } from "./api/telemetry";
import telegramHandler from "./api/telegram";
import mproAccessHandler from "./api/mproAccess";
import cloudAlertConfigHandler from "./api/cloudAlertConfig";
import cronCheckHandler from "./api/cronCheck";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // Map API routes
  app.post("/api/mpro-access", (req, res) => {
    mproAccessHandler(req, res);
  });
  app.post("/api/mpro-access/verify", (req, res) => {
    mproAccessHandler(req, res);
  });
  app.post("/api/mpro2-access", (req, res) => {
    req.body = { ...req.body, indicator: 'mpro2' };
    mproAccessHandler(req, res);
  });
  app.post("/api/mpro2-access/verify", (req, res) => {
    req.body = { ...req.body, indicator: 'mpro2' };
    mproAccessHandler(req, res);
  });
  app.post("/api/login", (req, res) => {
    loginHandler(req, res);
  });

  app.get("/api/auth/check", (req, res) => {
    checkHandler(req, res);
  });

  app.post("/api/logout", (req, res) => {
    logoutHandler(req, res);
  });

  app.post("/api/telemetry/heartbeat", (req, res) => {
    handleHeartbeat(req, res);
  });

  app.get("/api/telemetry/devices", (req, res) => {
    handleGetDevices(req, res);
  });

  app.post("/api/telegram", (req, res) => {
    telegramHandler(req, res);
  });

  app.all("/api/cloud-alert-config", (req, res) => {
    cloudAlertConfigHandler(req, res);
  });

  app.all("/api/cron-check", (req, res) => {
    cronCheckHandler(req, res);
  });

  // Standard health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
