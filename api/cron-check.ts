import cronCheckHandler from './_lib/cronCheck';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  try {
    return await cronCheckHandler(req, res);
  } catch (err: any) {
    console.error('Unhandled cronCheckHandler error:', err);
    return res.status(200).json({
      ok: false,
      status: 'error_caught_in_root_handler',
      error: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
