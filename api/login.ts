import crypto from 'crypto';

const JWT_SECRET = 'mihiretu-charting-platform-secure-site-wide-password-gate-key-2026';

export interface TokenPayload {
  authorized: boolean;
  expiresAt: number;
}

function createToken(): string {
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

export default function handler(req: any, res: any) {
  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { password } = req.body || {};
  const actualPassword = process.env.SITE_PASSWORD;

  if (!actualPassword) {
    return res.status(500).json({ error: 'SITE_PASSWORD environment variable is not configured on the server' });
  }

  // Treat # as comment if password is cut off by some env loader (like dotenv)
  let isMatch = password === actualPassword;
  
  if (!isMatch && actualPassword && password.startsWith(actualPassword)) {
    // If the actualPassword in the environment got truncated at '#' (which dotenv does)
    if (password[actualPassword.length] === '#') {
      isMatch = true;
    }
  }

  if (isMatch) {
    const token = createToken();
    const isProd = process.env.NODE_ENV === 'production';
    
    // Set cookie: HttpOnly, SameSite=Lax, Max-Age=100 years (3153600000 seconds)
    let cookie = `site_auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3153600000`;
    if (isProd) {
      cookie += '; Secure';
    }
    
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true, token });
  } else {
    return res.status(401).json({ error: 'Incorrect password' });
  }
}
