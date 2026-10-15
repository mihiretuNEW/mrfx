/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MasterJournalModal: Quantitative Trade Journal & Factor Attribution Learning Engine
 * Compares winning vs losing setups on Jump 10 (1H) deterministically without AI guessing.
 */

import React, { useState } from 'react';
import { 
  LoggedTrade, 
  FactorAttributionReport, 
  generateEmpiricalAttributionReport, 
  deleteLoggedTrade, 
  saveLoggedTrade, 
  clearAllLoggedTrades 
} from '../utils/masterSystem';
import { 
  X, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Info, 
  Lightbulb, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';

interface MasterJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: LoggedTrade[];
  onTradesUpdated: () => void;
  currentSymbol: string;
}

export const MasterJournalModal: React.FC<MasterJournalModalProps> = ({
  isOpen,
  onClose,
  trades,
  onTradesUpdated,
  currentSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'attribution' | 'history'>('analytics');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTrades = symbolFilter === 'all' ? trades : trades.filter((t) => t.symbol === symbolFilter);
  const report: FactorAttributionReport = generateEmpiricalAttributionReport(filteredTrades);

  const handleUpdateStatus = (trade: LoggedTrade, newStatus: 'WIN_TP' | 'LOSS_SL' | 'OPEN') => {
    const updated: LoggedTrade = {
      ...trade,
      status: newStatus,
      outcomeTime: newStatus === 'OPEN' ? undefined : Math.floor(Date.now() / 1000),
      outcomePrice: newStatus === 'WIN_TP' ? trade.takeProfit : newStatus === 'LOSS_SL' ? trade.stopLoss : undefined,
      actualR: newStatus === 'WIN_TP' ? 3.0 : newStatus === 'LOSS_SL' ? -1.0 : undefined,
    };
    saveLoggedTrade(updated);
    onTradesUpdated();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this trade record?')) {
      deleteLoggedTrade(id);
      onTradesUpdated();
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete ALL logged trades? This cannot be undone.')) {
      clearAllLoggedTrades();
      onTradesUpdated();
    }
  };

  return (
    <div 
      id="master-journal-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl flex flex-col text-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-white tracking-wide flex items-center gap-2">
                MASTER SYSTEM: STRATEGY AUDIT & JOURNAL
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold">
                  PRO
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Empirical factor analysis of your Mpro + Mpro2 setups on Jump 10 (1H)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Symbol filter toggle */}
            <div className="flex items-center gap-1 text-xs bg-neutral-900 border border-neutral-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSymbolFilter('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  symbolFilter === 'all' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Symbols
              </button>
              <button
                type="button"
                onClick={() => setSymbolFilter(currentSymbol)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  symbolFilter === currentSymbol ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {currentSymbol}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-800/80 bg-neutral-950 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-white font-bold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Performance Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'attribution'
                ? 'border-blue-500 text-white font-bold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>Factor Attribution (Learning)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-500 text-white font-bold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-4 h-4 text-neutral-400" />
            <span>Trade Ledger ({filteredTrades.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Performance Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 flex flex-col">
                  <span className="text-[11px] font-semibold text-neutral-400">WIN RATE</span>
                  <span className="text-2xl font-black font-mono text-white mt-1">
                    {report.winRate}%
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">
                    {report.totalWins} Wins / {report.totalLosses} Losses ({report.totalOpen} Open)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 flex flex-col">
                  <span className="text-[11px] font-semibold text-neutral-400">NET R-MULTIPLE</span>
                  <span className={`text-2xl font-black font-mono mt-1 ${
                    report.netR >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {report.netR >= 0 ? `+${report.netR.toFixed(1)}` : report.netR.toFixed(1)} R
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">
                    Strict 1:3 RR model (+3R / -1R)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 flex flex-col">
                  <span className="text-[11px] font-semibold text-neutral-400">PROFIT FACTOR</span>
                  <span className="text-2xl font-black font-mono text-blue-400 mt-1">
                    {report.profitFactor.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">
                    Gross Wins / Gross Losses
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 flex flex-col">
                  <span className="text-[11px] font-semibold text-neutral-400">MAX LOSS STREAK</span>
                  <span className="text-2xl font-black font-mono text-amber-400 mt-1">
                    {report.maxConsecutiveLosses} Trades
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">
                    Max consecutive wins: {report.maxConsecutiveWins}
                  </span>
                </div>
              </div>

              {/* Mathematical Insight Panel */}
              <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span>The Mathematical Reality of Your 1:3 System:</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  In a strict 1:3 Risk-to-Reward system, the break-even win rate is exactly <strong>25.0%</strong>. 
                  At <strong>40% win rate</strong> (8 wins, 12 losses), your net result is already <strong>+12.0R profit</strong>. 
                  The Master Gatekeeper’s job is not to reach 90% win rate—it is to eliminate the 4 or 5 consecutive "suicide trades" 
                  taken into runaway slopes or without room for 1:3, raising your baseline to ~55%.
                </p>
              </div>

              {/* Master Verdict Accuracy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-emerald-900/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>Approved by Master [TAKE]</span>
                    <span className="font-mono text-base">{report.takeTradesWinRate}% Win Rate</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${report.takeTradesWinRate}%` }} 
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Sample: {report.takeTradesCount} trades approved with green TAKE badge.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/60 border border-rose-900/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                    <span>Flagged to [SKIP] / Avoid</span>
                    <span className="font-mono text-base">{report.skipTradesWinRate}% Win Rate</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                      style={{ width: `${report.skipTradesWinRate}%` }} 
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Sample: {report.skipTradesCount} trades flagged as Hostile Trend or Blocked 1:3 Target.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Factor Attribution (Learning) */}
          {activeTab === 'attribution' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">
                    Empirical Factor Diagnostics (Zero AI Guessing)
                  </h4>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    This engine analyzes your actual past trades to isolate which market conditions produce your 3R wins versus your losses.
                  </p>
                </div>
              </div>

              {/* Actionable Rules derived from data */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wide">
                  Empirical Findings & System Directives:
                </h4>
                {report.actionableInsights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-200 flex items-start gap-2.5"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold text-[10px]">
                      FINDING #{idx + 1}
                    </span>
                    <span className="leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>

              {/* 4 Factor Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Factor 1: Retest vs First Touch */}
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                  <h5 className="text-xs font-bold text-white flex items-center justify-between">
                    <span>1. Touch Type Factor</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Retest vs First Touch</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">2nd Touch / Retest:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {report.retestWinRate}% ({report.retestWins}/{report.retestCount})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Blind First Touch:</span>
                      <span className="font-mono font-bold text-neutral-300">
                        {report.firstTouchWinRate}% ({report.firstTouchWins}/{report.firstTouchCount})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Mpro2 Yellow Midline:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {report.midlineWinRate}% ({report.midlineWins}/{report.midlineCount})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Factor 2: Slope & Regime Alignment */}
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                  <h5 className="text-xs font-bold text-white flex items-center justify-between">
                    <span>2. Slope Alignment Factor</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Aligned vs Runaway Counter-Trend</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Favorable / Aligned Slope:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {report.favorableSlopeWinRate}% ({report.favorableSlopeWins}/{report.favorableSlopeCount})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Hostile Runaway Slope:</span>
                      <span className="font-mono font-bold text-rose-400">
                        {report.hostileSlopeWinRate}% ({report.hostileSlopeWins}/{report.hostileSlopeCount})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Factor 3: 1:3 Clearance to Opposing Band */}
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                  <h5 className="text-xs font-bold text-white flex items-center justify-between">
                    <span>3. Target Clearance Factor</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Sufficient Room vs Blocked</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Clear Airway to 3R:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {report.sufficientRoomWinRate}% ({report.sufficientRoomWins}/{report.sufficientRoomCount})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Opposing Band Blocked 3R:</span>
                      <span className="font-mono font-bold text-rose-400">
                        {report.blockedRoomWinRate}% ({report.blockedRoomWins}/{report.blockedRoomCount})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Factor 4: Strategic Action */}
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2 flex flex-col justify-center">
                  <h5 className="text-xs font-bold text-white">Summary Rule</h5>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    By filtering out trades with <strong>Hostile Slopes</strong> and <strong>Blocked 3R Targets</strong>, 
                    your win rate naturally stabilizes, eliminating the emotional burden of consecutive drawdowns.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Trade History Table */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  Showing {filteredTrades.length} logged setups
                </span>
                {filteredTrades.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Records</span>
                  </button>
                )}
              </div>

              {filteredTrades.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs space-y-2">
                  <p>No trades logged yet.</p>
                  <p className="text-neutral-400">
                    Use the <strong>"Log Trade"</strong> button on the chart HUD to record your next Jump 10 setup!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTrades.map((trade) => {
                    const isExpanded = expandedTradeId === trade.id;
                    const dateStr = new Date(trade.timestamp * 1000).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={trade.id}
                        className="rounded-xl bg-neutral-900/60 border border-neutral-800 overflow-hidden text-xs transition-all"
                      >
                        {/* Summary Bar */}
                        <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] flex items-center gap-1 ${
                              trade.direction === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {trade.direction === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {trade.direction}
                            </span>

                            <span className="font-mono font-bold text-white">{trade.symbol}</span>
                            <span className="text-neutral-500 text-[11px]">{trade.timeframe}</span>
                            <span className="text-neutral-500 text-[11px]">• {dateStr}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Master Decision at entry */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              trade.decisionAtEntry === 'TAKE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              trade.decisionAtEntry === 'WAIT' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                              'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {trade.decisionAtEntry}
                            </span>

                            {/* Status Badge */}
                            <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              trade.status === 'WIN_TP' ? 'bg-emerald-500 text-black' :
                              trade.status === 'LOSS_SL' ? 'bg-rose-600 text-white' :
                              'bg-neutral-800 text-neutral-300'
                            }`}>
                              {trade.status === 'WIN_TP' ? '+3.0R (TP HIT)' :
                               trade.status === 'LOSS_SL' ? '-1.0R (SL HIT)' :
                               'OPEN TRACKING'}
                            </span>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                              {trade.status === 'OPEN' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(trade, 'WIN_TP')}
                                    className="px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 text-[10px]"
                                    title="Mark as TP Win"
                                  >
                                    TP
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(trade, 'LOSS_SL')}
                                    className="px-1.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-800 text-[10px]"
                                    title="Mark as SL Loss"
                                  >
                                    SL
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                                className="px-2 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 text-[11px]"
                              >
                                {isExpanded ? 'Less' : 'Details'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(trade.id)}
                                className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-rose-400"
                                title="Delete record"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Pre-trade Snapshot Details */}
                        {isExpanded && trade.preTradeSnapshot && (
                          <div className="p-3 border-t border-neutral-800 bg-neutral-950/70 text-[11px] space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-neutral-300">
                              <div>
                                <span className="text-neutral-500 block">Entry / SL / TP</span>
                                <span className="font-mono font-bold">{trade.entryPrice} / {trade.stopLoss} / {trade.takeProfit}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Calculated R:R</span>
                                <span className="font-mono font-bold text-blue-400">1 : {trade.riskRewardRatio}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Pre-trade Slope</span>
                                <span className="font-mono">{trade.preTradeSnapshot.slope?.slopeText || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Touch & Rejection</span>
                                <span className="font-mono">{trade.preTradeSnapshot.rejection?.rejectionText || 'N/A'}</span>
                              </div>
                            </div>

                            {trade.preTradeSnapshot.decisionReasons && (
                              <div className="pt-1">
                                <span className="text-neutral-500 block text-[10px]">Master Reasons at Entry:</span>
                                <ul className="list-disc list-inside text-neutral-400 text-[10px] space-y-0.5">
                                  {trade.preTradeSnapshot.decisionReasons.map((r, i) => (
                                    <li key={i}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {trade.notes && (
                              <div className="pt-1 text-neutral-400 italic">
                                Notes: "{trade.notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
