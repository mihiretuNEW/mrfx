import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, Lock, AlertTriangle, KeyRound, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { markCurrentDevicePasswordPassed } from '../utils/deviceTracker';

interface LoginPageProps {
  onBackToHome?: () => void;
}

export function LoginPage({ onBackToHome }: LoginPageProps) {
  const { login, error } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsSubmitting(true);
    const success = await login(password);
    if (success) {
      markCurrentDevicePasswordPassed();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-[#fafafa] font-sans antialiased overflow-hidden selection:bg-neutral-800 relative p-4">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(24,24,27,0.8),rgba(9,9,11,1))]" />
      
      {/* Decorative clean grid lines in background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)] opacity-20 pointer-events-none" />

      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Homepage</span>
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md p-8 relative z-10 bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Sleek top accent line */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-5 h-5 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-1 font-sans flex items-center gap-2">
            <span>Mcharts</span>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
              Private
            </span>
          </h1>
          <p className="text-xs text-neutral-400 text-center leading-normal max-w-[280px]">
            Please enter the site password to access the private charting platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Site Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-neutral-500" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 rounded-xl outline-none text-sm transition-all duration-150 text-white placeholder-neutral-600"
                disabled={isSubmitting}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3.5 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-red-300 leading-normal">
                {error}
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 font-semibold text-sm rounded-xl text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Enter Platform'
            )}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-neutral-900/80 text-center text-[10px] text-neutral-600 select-none">
          SECURE COMPACT COOKIE VALIDATION
        </div>
      </motion.div>
    </div>
  );
}

