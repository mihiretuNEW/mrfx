export interface SmsSendResult {
  ok: boolean;
  sent?: boolean;
  id?: number | string;
  description?: string;
  error?: string;
}

export function formatEthiopianPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^0-9]/g, '');

  if (cleaned.startsWith('09') && cleaned.length === 10) {
    return '251' + cleaned.substring(1);
  }
  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return '251' + cleaned.substring(1);
  }
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    return '251' + cleaned;
  }
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '251' + cleaned;
  }
  if (cleaned.startsWith('251') && cleaned.length === 12) {
    return cleaned;
  }
  return cleaned;
}

export async function sendSmsDirect(
  apiKey: string,
  rawPhone: string,
  text: string
): Promise<SmsSendResult> {
  const key = (apiKey || '').trim();
  const phone = formatEthiopianPhone(rawPhone);

  if (!key) {
    return { ok: false, error: 'SMS Ethiopia API Key is required' };
  }
  if (!phone || phone.length < 10) {
    return { ok: false, error: 'Valid Ethiopian phone number is required (e.g. 251968865885)' };
  }
  if (!text) {
    return { ok: false, error: 'SMS text is required' };
  }

  try {
    const res = await fetch('https://smsethiopia.com/api/sms/send', {
      method: 'POST',
      headers: {
        KEY: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msisdn: phone,
        text,
      }),
    });

    const data: any = await res.json().catch(() => null);

    if (res.ok && data && (data.sent === true || data.status === 'success' || data.description?.includes('Accepted'))) {
      return {
        ok: true,
        sent: true,
        id: data.id,
        description: data.description || 'Accepted for delivery',
      };
    }

    return {
      ok: false,
      error: data?.message || data?.description || `HTTP ${res.status}: Failed to send SMS`,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error connecting to smsethiopia.com',
    };
  }
}

export function formatTradeSignalSms(params: {
  type: 'BUY' | 'SELL';
  symbolName: string;
  tf: string;
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  slPips: number;
  tp1Pips: number;
}): string {
  const icon = params.type === 'BUY' ? 'BUY' : 'SELL';
  return (
    `🚨 MCHARTS ${icon} SIGNAL!\n` +
    `Pair: ${params.symbolName} (${params.tf})\n` +
    `Entry: ${params.entryPrice.toFixed(2)}\n` +
    `TP: ${params.tp1Price.toFixed(2)} (+${params.tp1Pips})\n` +
    `SL: ${params.slPrice.toFixed(2)} (-${params.slPips})\n` +
    `Risk: 1-2% only. Mire stay disciplined!`
  );
}

export function formatTradeResolutionSms(params: {
  isWin: boolean;
  symbolName: string;
  pips: number;
  exitPrice: number;
  reason: string;
}): string {
  if (params.isWin) {
    return (
      `🎯 TARGET HIT (WIN)! ✅\n` +
      `Pair: ${params.symbolName}\n` +
      `Result: +${params.pips} Pips Won\n` +
      `Exit: ${params.exitPrice.toFixed(2)}\n` +
      `Profit locked in!`
    );
  } else {
    return (
      `🛑 STOP LOSS HIT ❌\n` +
      `Pair: ${params.symbolName}\n` +
      `Result: -${params.pips} Pips\n` +
      `Exit: ${params.exitPrice.toFixed(2)}\n` +
      `Never revenge trade. Wait for next setup.`
    );
  }
}
