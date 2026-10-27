import { createToken } from './auth';

export default function loginHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { password } = req.body || {};
  const actualPassword = process.env.SITE_PASSWORD || 'Mihiretu12$0962862284';

  let isMatch = password === actualPassword;
  
  if (!isMatch && actualPassword && password && password.startsWith(actualPassword)) {
    if (password[actualPassword.length] === '#') {
      isMatch = true;
    }
  }

  if (isMatch) {
    const token = createToken();
    const isProd = process.env.NODE_ENV === 'production';
    
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
