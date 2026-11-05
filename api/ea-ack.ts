import { acknowledgeSignalExecution, recordTradeResult } from './_lib/eaState';

export default async function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const action = (body.action || req.query?.action || 'EXECUTED').toUpperCase();
    const signalId = body.signalId || req.query?.signalId;
    const ticket = Number(body.ticket || req.query?.ticket || 0);

    if (action === 'EXECUTED') {
      if (!signalId && !ticket) {
        return res.status(400).json({ ok: false, error: 'signalId or ticket is required for execution ACK' });
      }

      const result = acknowledgeSignalExecution({
        signalId: signalId || `TICKET_${ticket}`,
        ticket,
        executionPrice: Number(body.executionPrice || req.query?.executionPrice || 0),
      });

      return res.status(200).json(result);
    }

    if (action === 'CLOSED') {
      const isWin = body.isWin !== undefined ? Boolean(body.isWin) : Number(body.profit || 0) > 0;
      const result = recordTradeResult({
        signalId,
        ticket,
        exitPrice: Number(body.exitPrice || 0),
        exitReason: body.exitReason || (isWin ? 'Target Hit (Win)' : 'Stop Loss (Loss)'),
        profit: Number(body.profit || 0),
        isWin,
      });

      return res.status(200).json(result);
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error processing EA acknowledgment',
    });
  }
}
