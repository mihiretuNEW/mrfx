import crypto from 'crypto';

const MPRO_SECRET = 'mpro-signals-pro-license-engine-2026-secure-key-fx';
const MPRO2_SECRET = 'mpro2-fibonacci-confluence-pro-2026-secure-key-fx';

const VALID_MPRO_KEYS = [
  'Mihiretu-Mpro-2284-FX',
  'MIHIRETU-MPRO-2284-FX',
  'Mpro-2284-FX',
  'Mcharts-Mihiretu-Jump10-2019',
  'MCHARTS-MIHIRETU-JUMP10-2019',
];

// Mpro2 keys must follow the pattern: 096886-XX-Mchart (e.g., 096886-XX-Mchart, 096886-PRO-Mchart, 096886-01-Mchart, etc.)
export function isValidMpro2Key(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  const pattern = /^096886-[A-Za-z0-9_-]+-Mchart$/i;
  return pattern.test(trimmed) || 
    trimmed.toUpperCase() === '096886-XX-MCHART' ||
    trimmed.toUpperCase() === 'MCHARTS-MIHIRETU-JUMP10-2019';
}

export interface MproTokenPayload {
  isPro: boolean;
  tier: 'PRO';
  indicator?: 'mpro' | 'mpro2';
  issuedAt: number;
  expiresAt: number;
}

export function createMproProToken(indicator: 'mpro' | 'mpro2' = 'mpro'): string {
  // 10 years validity
  const expiresAt = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
  const payload: MproTokenPayload = {
    isPro: true,
    tier: 'PRO',
    indicator,
    issuedAt: Date.now(),
    expiresAt,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  const secret = indicator === 'mpro2' ? MPRO2_SECRET : MPRO_SECRET;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyMproProToken(token: string, indicator: 'mpro' | 'mpro2' = 'mpro'): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, signature] = parts;
  const secret = indicator === 'mpro2' ? MPRO2_SECRET : MPRO_SECRET;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  if (signature !== expectedSig) return false;

  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr) as MproTokenPayload;
    if (!payload.isPro) return false;
    if (Date.now() > payload.expiresAt) return false;
    return true;
  } catch {
    return false;
  }
}

export default function mproAccessHandler(req: any, res: any) {
  if (req.method === 'POST') {
    const { key, action, token, indicator } = req.body || {};

    if (action === 'verify_token') {
      const ind = indicator === 'mpro2' ? 'mpro2' : 'mpro';
      const isValid = verifyMproProToken(token, ind);
      return res.json({ isPro: isValid });
    }

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: 'Please provide an access key' });
    }

    const cleanKey = key.trim();

    // Check if verifying for Mpro2 (or if key matches 096886-XX-Mchart pattern)
    if (indicator === 'mpro2' || cleanKey.toUpperCase().startsWith('096886-')) {
      if (isValidMpro2Key(cleanKey)) {
        const proToken = createMproProToken('mpro2');
        return res.json({
          success: true,
          isPro: true,
          proToken,
          message: 'Mpro2 Signal PRO Active (096886 Key Verified)',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid or unauthorized license key.',
      });
    }

    // Check standard Mpro keys
    const isMatch = VALID_MPRO_KEYS.some((k) => k.toLowerCase() === cleanKey.toLowerCase());

    if (isMatch) {
      const proToken = createMproProToken('mpro');
      return res.json({
        success: true,
        isPro: true,
        proToken,
        message: 'Mpro Signals PRO Active',
      });
    }

    // Also check if user entered an 096886 key in standard Mpro modal
    if (isValidMpro2Key(cleanKey)) {
      const proToken = createMproProToken('mpro2');
      return res.json({
        success: true,
        isPro: true,
        proToken,
        message: 'Mpro2 Signal PRO Active',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired access key.',
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

