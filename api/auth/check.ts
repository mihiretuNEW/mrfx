import crypto from 'crypto';

const JWT_SECRET = 'mihiretu-charting-platform-secure-site-wide-password-gate-key-2026';

export interface TokenPayload {
  authorized: boolean;
  expiresAt: number;
}

function verifyToken(token: string): boolean {
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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    if (name) {
      cookies[name] = decodeURIComponent(parts.slice(1).join('='));
    }
  });
  return cookies;
}

export default function handler(req: any, res: any) {
  // Allow only GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookies = parseCookies(req.headers.cookie);
  let token = cookies['site_auth_token'];

  // Check Authorization header if cookie is missing
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  const isValid = verifyToken(token);

  if (isValid && token) {
    // If the request was authorized, make sure the cookie is set/restored
    const isProd = process.env.NODE_ENV === 'production';
    let cookie = `site_auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3153600000`;
    if (isProd) {
      cookie += '; Secure';
    }
    res.setHeader('Set-Cookie', cookie);
  }

  return res.status(200).json({ authenticated: isValid, token: isValid ? token : undefined });
}
