import telegramHandler from './_lib/telegram';

export default async function handler(req: any, res: any) {
  return telegramHandler(req, res);
}
