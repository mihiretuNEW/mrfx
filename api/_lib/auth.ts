import crypto from 'crypto';

const JWT_SECRET = 'mihiretu-charting-platform-secure-site-wide-password-gate-key-2026';

export interface TokenPayload {
  authorized: boolean;
  expiresAt: number;
}

export function createToken(): string {
  const expiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
  const payload: TokenPayload = {
    authorized: true,
    expiresAt,
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadB64)
    .digest('base64url');
    
  return `${payloadB64}.${signature}`;
}

export function verifyToken(token: string): boolean {
  if (!token) return false;
  
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [payloadB64, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadB64)
    .digest('base64url');
    
  if (signature !== expectedSignature) {
    return false;
  }
  
  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr) as TokenPayload;
    if (!payload.authorized) return false;
    if (Date.now() > payload.expiresAt) return false;
    return true;
  } catch (e) {
    return false;
  }
}
