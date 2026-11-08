import cloudAlertConfigHandler from './_lib/cloudAlertConfig.js';

export default async function handler(req: any, res: any) {
  return cloudAlertConfigHandler(req, res);
}
