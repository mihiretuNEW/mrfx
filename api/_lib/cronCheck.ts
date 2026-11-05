import cronCheckHandler from '../cron-check';

export default async function handler(req: any, res: any) {
  return cronCheckHandler(req, res);
}
