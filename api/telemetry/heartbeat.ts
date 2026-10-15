import { handleHeartbeat } from '../telemetry';

export default function handler(req: any, res: any) {
  return handleHeartbeat(req, res);
}
