import cronCheckHandler from '../cron-check.js';

export default async function handler(req: any, res: any) {
  return cronCheckHandler(req, res);
}
