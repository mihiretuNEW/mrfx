import crypto from 'crypto';

// A secure, static secret for signing tokens.
// This secret is independent of SITE_PASSWORD, so that changing SITE_PASSWORD doesn't invalidate existing sessions!
const JWT_SECRET = 'mihiretu-charting-platform-secure-site-wide-password-gate-key-2026';

export interface TokenPayload {
  authorized: boolean;
  expiresAt: number;
}

export function createToken(): string {
  // Token expires in 100 years (practically unlimited)
  const expiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
  const payload: TokenPayload = {
    authorized: true,
    expiresAt,
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  
  // Sign using HMAC-SHA256 with our static secret
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
  
  // Re-verify signature
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadB64)
    .digest('base64url');
    
  if (signature !== expectedSignature) {
    return false; // Tampered or invalid
  }
  
  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr) as TokenPayload;
    
    if (!payload.authorized) return false;
    
    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return false; // Expired
    }
    
    return true;
  } catch (e) {
    return false;
  }
}
