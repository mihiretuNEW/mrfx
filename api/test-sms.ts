import sendSmsHandler from './send-sms';

export default async function handler(req: any, res: any) {
  return sendSmsHandler(req, res);
}
