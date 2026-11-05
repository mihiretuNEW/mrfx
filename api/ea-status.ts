import { loadEAState, updateEASettings } from './_lib/eaState';

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
    if (req.method === 'POST') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }

      const updates: any = {};
      if (body.autoBotEnabled !== undefined) updates.autoBotEnabled = Boolean(body.autoBotEnabled);
      if (body.maxConsecutiveLosses !== undefined) updates.maxConsecutiveLosses = Number(body.maxConsecutiveLosses);
      if (body.lotSize !== undefined) updates.lotSize = Number(body.lotSize);
      if (body.magicNumber !== undefined) updates.magicNumber = Number(body.magicNumber);

      const newState = updateEASettings(updates);
      return res.status(200).json({ ok: true, state: newState });
    }

    const state = loadEAState();
    return res.status(200).json({ ok: true, state });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error in EA status handler',
    });
  }
}
