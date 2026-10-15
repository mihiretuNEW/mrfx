import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already opened as an installed PWA (standalone mode), no need to display
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* 1. Android / Chrome / Edge Native Install Button */}
      {isInstallable ? (
        <button
          id="btn-pwa-install"
          onClick={install}
          title="Add Mcharts to Home Screen (Install App)"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm border border-blue-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
          <span className="sm:hidden">App</span>
        </button>
      ) : (
        /* 2. Generic / iOS / Mobile Browser "Add to Homescreen" guide button */
        <button
          id="btn-pwa-guide"
          onClick={() => setShowGuide(true)}
          title="Install Mcharts on Phone (Add to Home Screen)"
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-[#1e222d] hover:bg-[#2a2e39] text-gray-300 hover:text-white border border-[#2a2e39] transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Add to Homescreen</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {/* Mobile Homescreen Installation Guide Modal */}
      {showGuide && (
        <div 
          id="pwa-guide-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowGuide(false)}
        >
          <div 
            className="w-full max-w-md bg-[#1c2030] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden text-gray-200 p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2e39]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add to Home Screen (PWA)</h3>
                  <p className="text-xs text-gray-400">Install Mcharts as a standalone mobile app</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Tabs/Content */}
            <div className="mt-4 space-y-4 text-xs leading-relaxed">
              {isIOS ? (
                <div className="space-y-3 bg-[#131722] p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <Share2 className="w-4 h-4" />
                    <span>Safari on iPhone / iPad:</span>
                  </div>
                  <ol className="space-y-2.5 pl-2 list-decimal list-inside text-gray-300">
                    <li>
                      Safari browser ታች ወይም ላይ ያለውን <strong className="text-white">Share</strong> (የማጋሪያ ምልክት) ይንኩ።
                    </li>
                    <li>
                      ወደ ታች ዝቅ ብለው <strong className="text-white">"Add to Home Screen"</strong> የሚለውን ይምረጡ።
                    </li>
                    <li>
                      ከላይ በስተቀኝ <strong className="text-white">"Add"</strong> የሚለውን ይጫኑ።
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 bg-[#131722] p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <PlusSquare className="w-4 h-4" />
                    <span>Android / Chrome:</span>
                  </div>
                  <ol className="space-y-2.5 pl-2 list-decimal list-inside text-gray-300">
                    <li>
                      Chrome browser ከላይ በስተቀኝ ያሉትን <strong className="text-white">ሶስት ነጥቦች (⋮)</strong> ይንኩ።
                    </li>
                    <li>
                      ዝርዝሩ ውስጥ <strong className="text-white">"Install app"</strong> ወይም <strong className="text-white">"Add to Home screen"</strong> የሚለውን ይምረጡ።
                    </li>
                    <li>
                      ማረጋገጫ ሲጠይቅ <strong className="text-white">"Install"</strong> የሚለውን ይጫኑ።
                    </li>
                  </ol>
                </div>
              )}

              {/* Benefits */}
              <div className="p-3 bg-blue-950/30 border border-blue-800/30 rounded-xl space-y-1.5 text-blue-200">
                <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>የ PWA አፕሊኬሽን ጥቅሞች፡</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-300 pl-1">
                  <li>የብሮውዘር URL bar ሳይኖር ሙሉ ስክሪን (Standalone) ሆኖ ይሰራል</li>
                  <li>በጣም ፈጣን ጭነትና ቀላል የመሸጎጫ ማከማቻ (Fast Cache)</li>
                  <li>ከስልክዎ ዋና ስክሪን ልክ እንደ ተራ መተግበሪያ በአንድ ጠቅታ ይከፈታል</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex gap-2">
              {isInstallable && (
                <button
                  onClick={() => {
                    setShowGuide(false);
                    install();
                  }}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition-colors"
                >
                  Install Now
                </button>
              )}
              <button
                onClick={() => setShowGuide(false)}
                className="flex-1 py-2 rounded-lg bg-[#2a2e39] hover:bg-[#363a45] text-gray-200 font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
