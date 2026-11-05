import { loadEAState } from './_lib/eaState';

export default async function handler(req: any, res: any) {
  // Ultra-fast CORS handling
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const state = loadEAState();
    state.lastEaPingTime = Date.now();

    // 1. Check if Master Auto-Trading is paused
    if (!state.autoBotEnabled) {
      return res.status(200).json({
        ok: true,
        status: 'PAUSED',
        message: 'Auto trading is paused by user in WebApp settings',
        timestamp: Date.now(),
      });
    }

    // 2. Check if Daily Circuit Breaker is active
    if (state.circuitBreakerTripped) {
      return res.status(200).json({
        ok: true,
        status: 'CIRCUIT_BREAKER_ACTIVE',
        consecutiveLossesToday: state.consecutiveLossesToday,
        maxConsecutiveLosses: state.maxConsecutiveLosses,
        message: 'Max daily consecutive losses reached. Trading stopped for today.',
        timestamp: Date.now(),
      });
    }

    // 3. Check for PENDING signal ready for EA execution
    if (state.pendingSignal && state.pendingSignal.status === 'PENDING') {
      const sig = state.pendingSignal;
      return res.status(200).json({
        ok: true,
        status: 'PENDING',
        signal: {
          id: sig.id,
          symbol: sig.symbol,
          type: sig.type, // "BUY" or "SELL"
          entryPrice: sig.entryPrice,
          slPrice: sig.slPrice,
          tp1Price: sig.tp1Price,
          tp2Price: sig.tp2Price,
          tp3Price: sig.tp3Price,
          slPips: sig.slPips,
          tp1Pips: sig.tp1Pips,
          lotSize: sig.lotSize || state.lotSize || 0.001,
          magicNumber: state.magicNumber || 757575,
          createdAt: sig.createdAt,
        },
        timestamp: Date.now(),
      });
    }

    // 4. No pending signal - EA stays idle
    return res.status(200).json({
      ok: true,
      status: 'IDLE',
      activeTrade: state.activeTrade
        ? {
            id: state.activeTrade.id,
            symbol: state.activeTrade.symbol,
            type: state.activeTrade.type,
            ticket: state.activeTrade.ticket,
            entryPrice: state.activeTrade.entryPrice,
            slPrice: state.activeTrade.slPrice,
            tp1Price: state.activeTrade.tp1Price,
            executedAt: state.activeTrade.executedAt,
          }
        : null,
      consecutiveLossesToday: state.consecutiveLossesToday,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal error in EA signal endpoint',
    });
  }
}
