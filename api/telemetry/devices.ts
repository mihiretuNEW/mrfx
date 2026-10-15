import { handleGetDevices } from '../telemetry';

export default function handler(req: any, res: any) {
  return handleGetDevices(req, res);
}
