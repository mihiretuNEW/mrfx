export default function handler(req: any, res: any) {
  const isProd = process.env.NODE_ENV === 'production';
  // Expire the cookie immediately
  let cookie = `site_auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
  if (isProd) {
    cookie += '; Secure';
  }
  
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ success: true });
}
