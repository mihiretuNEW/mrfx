import cronCheckHandler from './_lib/cronCheck';

export default async function handler(req: any, res: any) {
  return cronCheckHandler(req, res);
}
