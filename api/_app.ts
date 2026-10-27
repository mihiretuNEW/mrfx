import express from 'express';
import loginHandler from './_lib/login';
import checkHandler from './_lib/check';
import logoutHandler from './_lib/logout';
import { handleHeartbeat, handleGetDevices } from './_lib/telemetry';
import telegramHandler from './_lib/telegram';
import mproAccessHandler from './_lib/mproAccess';
import cloudAlertConfigHandler from './_lib/cloudAlertConfig';
import cronCheckHandler from './_lib/cronCheck';

const app = express();

app.use(express.json());

app.post('/api/mpro-access', (req, res) => mproAccessHandler(req, res));
app.post('/api/mpro-access/verify', (req, res) => mproAccessHandler(req, res));
app.post('/api/mpro2-access', (req, res) => {
  req.body = { ...req.body, indicator: 'mpro2' };
  mproAccessHandler(req, res);
});
app.post('/api/mpro2-access/verify', (req, res) => {
  req.body = { ...req.body, indicator: 'mpro2' };
  mproAccessHandler(req, res);
});

app.post('/api/login', (req, res) => loginHandler(req, res));
app.get('/api/auth/check', (req, res) => checkHandler(req, res));
app.post('/api/logout', (req, res) => logoutHandler(req, res));

app.post('/api/telemetry/heartbeat', (req, res) => handleHeartbeat(req, res));
app.get('/api/telemetry/devices', (req, res) => handleGetDevices(req, res));

app.post('/api/telegram', (req, res) => telegramHandler(req, res));

app.all(['/api/cloud-alert-config', '/api/cloudAlertConfig'], (req, res) => {
  cloudAlertConfigHandler(req, res);
});

app.all(['/api/cron-check', '/api/cronCheck'], (req, res) => {
  cronCheckHandler(req, res);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
