export interface GitHubDispatchPayload {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  lot: number;
  entryPrice: number;
  sl: number;
  tp: number;
  slPips?: number;
  tpPips?: number;
  isDemo?: boolean;
  timestamp: number;
}

export interface GitHubDispatchResult {
  ok: boolean;
  status?: number;
  error?: string;
  message?: string;
}

export async function sendGitHubDispatch(
  owner: string,
  repo: string,
  token: string,
  payload: GitHubDispatchPayload
): Promise<GitHubDispatchResult> {
  const cleanOwner = (owner || 'mihiretuNEW').trim();
  const cleanRepo = (repo || 'my-vps').trim();
  const cleanToken = (token || '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').trim();

  if (!cleanOwner || !cleanRepo || !cleanToken) {
    return { ok: false, error: 'GitHub owner, repo, and token are required' };
  }

  const url = `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/dispatches`;

  // GitHub allows a maximum of 10 properties in client_payload
  const compactedPayload = {
    id: payload.id,
    symbol: payload.symbol,
    action: payload.action,
    lot: payload.lot,
    entry: payload.entryPrice,
    sl: payload.sl,
    tp: payload.tp,
    isDemo: Boolean(payload.isDemo),
    time: payload.timestamp,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mcharts-AutoTrader/1.0',
      },
      body: JSON.stringify({
        event_type: 'trade_signal',
        client_payload: compactedPayload,
      }),
    });

    // GitHub returns 204 No Content on successful repository_dispatch
    if (res.status === 204 || res.ok) {
      return {
        ok: true,
        status: res.status,
        message: `✅ GitHub Dispatch sent to ${cleanOwner}/${cleanRepo} (HTTP ${res.status})`,
      };
    }

    const text = await res.text().catch(() => '');
    let errMsg = `GitHub API returned HTTP ${res.status}`;
    try {
      const data = JSON.parse(text);
      if (data.message) errMsg = data.message;
    } catch {}

    return {
      ok: false,
      status: res.status,
      error: errMsg,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error connecting to GitHub API',
    };
  }
}
