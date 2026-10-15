import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, CheckCircle2, Sparkles, ExternalLink, ShieldCheck, Mail, Bot } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [indicatorName, setIndicatorName] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicatorName.trim()) return;

    // Build mailto or Telegram link with pre-filled message
    const subject = encodeURIComponent(`Custom Indicator Request: ${indicatorName}`);
    const body = encodeURIComponent(`Indicator Name: ${indicatorName}\n\nDetails / Description:\n${description}`);
    
    // Trigger direct telegram or email contact
    window.open(`https://t.me/Mihiretu_Support?text=${subject}%0A${body}`, '_blank');
    
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIndicatorName('');
      setDescription('');
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-[#0d0f17] border border-white/15 rounded-2xl shadow-2xl overflow-hidden text-white my-8"
        >
          {/* Header */}
          <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between bg-[#111422]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-wide">Fast 24/7 Support & Indicator Requests</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Quick Redirect Buttons */}
            <div>
              <label className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider block mb-2.5">
                Instant Direct Support Channel
              </label>
              <a
                href="https://t.me/Mihiretu_Support"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 transition-colors flex items-center justify-between group text-sm font-bold text-blue-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚀</span>
                  <div>
                    <div>Telegram Support Agent</div>
                    <div className="text-[11px] text-neutral-400 font-normal">@Mihiretu_Support (24/7 Response)</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

            {/* Custom Indicator Request Form */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Request Custom Indicator or Strategy
                </h4>
              </div>

              {submitted ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Request Sent! Opening Support Chat...
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">
                      Indicator / Strategy Name
                    </label>
                    <input
                      type="text"
                      value={indicatorName}
                      onChange={(e) => setIndicatorName(e.target.value)}
                      placeholder="e.g. LuxAlgo Market Dynamics / Custom Waver"
                      className="w-full px-3.5 py-2.5 bg-[#141824] border border-white/10 rounded-xl outline-none focus:border-blue-500/60 text-white placeholder-neutral-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">
                      Details / Trading Rules (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe how the indicator works or paste formula link..."
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-[#141824] border border-white/10 rounded-xl outline-none focus:border-blue-500/60 text-white placeholder-neutral-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Request to Support Team</span>
                  </button>
                </form>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white/5 text-[11px] text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>All platform indicator updates are provided free to lifetime license holders.</span>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
