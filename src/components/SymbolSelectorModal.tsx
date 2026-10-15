/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SymbolInfo, ChartThemeId } from '../types';
import { isDarkTheme, getThemePreset } from '../utils/themePresets';
import { 
  Search, 
  X, 
  Coins, 
  ShieldAlert, 
  Star, 
  Folder, 
  FolderPlus, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Plus,
  FolderCheck,
  Layers
} from 'lucide-react';
import { getCategoryPriority } from '../hooks/useDerivWS';
import { getSymbolSpec } from '../utils/symbolSpecs';

interface SymbolSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbols: SymbolInfo[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
  isFavorite?: (symbol: string) => boolean;
  customFolders?: Record<string, string[]>;
  onCreateFolder?: (folderName: string) => void;
  onDeleteFolder?: (folderName: string) => void;
  onToggleSymbolInFolder?: (symbol: string, folderName: string) => void;
  theme?: ChartThemeId;
}

type MarketCategory = 
  | 'favorites' 
  | 'all' 
  | 'forex_majors' 
  | 'forex_minors' 
  | 'jump' 
  | 'volatility' 
  | 'step' 
  | 'crashboom' 
  | 'metals' 
  | 'cryptocurrency';

export const SymbolSelectorModal: React.FC<SymbolSelectorModalProps> = ({
  isOpen,
  onClose,
  symbols,
  selectedSymbol,
  onSelectSymbol,
  favorites = [],
  onToggleFavorite,
  isFavorite = (_sym: string) => false,
  customFolders = {},
  onCreateFolder,
  onDeleteFolder,
  onToggleSymbolInFolder,
  theme,
}) => {
  const isDark = isDarkTheme(theme);
  const preset = getThemePreset(theme);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<MarketCategory>('favorites');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders');

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim() && onCreateFolder) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowFolderInput(false);
    }
  };

  // Build categorized symbols list
  const filteredSymbols = useMemo(() => {
    const list = Array.isArray(symbols) ? symbols : [];
    return list
      .filter((sym) => {
        if (!sym || !sym.symbol) return false;
        // Search matches
        const matchesSearch = 
          sym.symbol.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
          (sym.display_name || '').toLowerCase().includes((searchTerm || '').toLowerCase());

        const priority = getCategoryPriority(sym);

        // Category matches
        if (activeTab === 'favorites') {
          return matchesSearch && isFavorite(sym.symbol);
        }

        let matchesCategory = activeTab === 'all';
        if (activeTab === 'jump') matchesCategory = priority === 1;
        if (activeTab === 'volatility') matchesCategory = priority === 2;
        if (activeTab === 'step') matchesCategory = priority === 3;
        if (activeTab === 'crashboom') matchesCategory = priority === 4;
        if (activeTab === 'forex_majors') matchesCategory = priority === 5;
        if (activeTab === 'forex_minors') matchesCategory = priority === 6;
        if (activeTab === 'metals') matchesCategory = priority === 7;
        if (activeTab === 'cryptocurrency') matchesCategory = priority === 8;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => getCategoryPriority(a) - getCategoryPriority(b));
  }, [symbols, searchTerm, activeTab, isFavorite]);

  // Group all or favorite symbols into systematic Market Folders
  const marketFolders = useMemo(() => {
    const list = Array.isArray(symbols) ? symbols : [];
    const targetList = activeTab === 'favorites' 
      ? list.filter((s) => s && s.symbol && isFavorite(s.symbol))
      : list;

    const foldersMap: { [key: string]: { id: string; label: string; priority: number; items: SymbolInfo[] } } = {
      forex_majors: { id: 'forex_majors', label: 'Forex Majors', priority: 5, items: [] },
      forex_minors: { id: 'forex_minors', label: 'Forex Minors', priority: 6, items: [] },
      jump: { id: 'jump', label: 'Jump Indices', priority: 1, items: [] },
      volatility: { id: 'volatility', label: 'Volatility Indices', priority: 2, items: [] },
      step: { id: 'step', label: 'Step Indices', priority: 3, items: [] },
      crashboom: { id: 'crashboom', label: 'Crash & Boom Indices', priority: 4, items: [] },
      metals: { id: 'metals', label: 'Metals & Commodities', priority: 7, items: [] },
      cryptocurrency: { id: 'cryptocurrency', label: 'Cryptocurrency', priority: 8, items: [] },
    };

    targetList.forEach((sym) => {
      const priority = getCategoryPriority(sym);
      if (priority === 1) foldersMap.jump.items.push(sym);
      else if (priority === 2) foldersMap.volatility.items.push(sym);
      else if (priority === 3) foldersMap.step.items.push(sym);
      else if (priority === 4) foldersMap.crashboom.items.push(sym);
      else if (priority === 5) foldersMap.forex_majors.items.push(sym);
      else if (priority === 6) foldersMap.forex_minors.items.push(sym);
      else if (priority === 7) foldersMap.metals.items.push(sym);
      else if (priority === 8) foldersMap.cryptocurrency.items.push(sym);
      else foldersMap.volatility.items.push(sym);
    });

    return Object.values(foldersMap)
      .filter((f) => f.items.length > 0)
      .sort((a, b) => a.priority - b.priority);
  }, [symbols, activeTab, isFavorite]);

  if (!isOpen) return null;

  const renderSymbolRow = (sym: SymbolInfo) => {
    const isSelected = sym.symbol === selectedSymbol;
    const isFav = isFavorite(sym.symbol);
    const priority = getCategoryPriority(sym);
    const spec = getSymbolSpec(sym.symbol);

    let marketTag = spec.categoryLabel || 'Volatility';
    let tagColor = 'bg-blue-950/40 text-blue-400 border-blue-900/35';

    if (priority === 1) {
      marketTag = 'Jump Index';
      tagColor = 'bg-green-950/40 text-green-400 border-green-900/35';
    } else if (priority === 2) {
      marketTag = 'Volatility';
      tagColor = 'bg-blue-950/40 text-blue-400 border-blue-900/35';
    } else if (priority === 3) {
      marketTag = 'Step Index';
      tagColor = 'bg-cyan-950/40 text-cyan-400 border-cyan-900/35';
    } else if (priority === 4) {
      marketTag = sym.symbol.toUpperCase().includes('CRASH') ? 'Crash Index' : 'Boom Index';
      tagColor = sym.symbol.toUpperCase().includes('CRASH')
        ? 'bg-rose-950/40 text-rose-400 border-rose-900/35'
        : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/35';
    } else if (priority === 5) {
      marketTag = 'Forex Major';
      tagColor = 'bg-purple-950/40 text-purple-400 border-purple-900/35';
    } else if (priority === 6) {
      marketTag = 'Forex Minor';
      tagColor = 'bg-indigo-950/40 text-indigo-400 border-indigo-900/35';
    } else if (priority === 7) {
      marketTag = 'Precious Metal';
      tagColor = 'bg-amber-950/40 text-amber-400 border-amber-900/35';
    } else if (priority === 8) {
      marketTag = 'Crypto';
      tagColor = 'bg-yellow-950/40 text-yellow-400 border-yellow-900/35';
    }

    return (
      <div
        key={sym.symbol}
        className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all ${
          isSelected 
            ? 'bg-blue-600/20 border border-blue-500/40' 
            : isDark ? 'hover:bg-neutral-900 border border-transparent' : 'hover:bg-neutral-100 border border-transparent'
        }`}
      >
        <button
          id={`symbol-item-${sym.symbol}`}
          onClick={() => {
            onSelectSymbol(sym.symbol);
            onClose();
          }}
          className="flex-grow flex items-center justify-between text-left"
        >
          <div className="flex flex-col">
            <span className={`font-mono text-sm font-bold tracking-wide flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {sym.symbol}
              {isSelected && <span className="w-2 h-2 rounded-full bg-green-500 shadow shadow-green-500" />}
            </span>
            <span className={`text-xs mt-0.5 ${isDark ? 'text-neutral-300' : 'text-slate-600'}`}>
              {sym.display_name}
            </span>
          </div>

          <div className="flex items-center gap-2 mr-3">
            {sym.is_closed && (
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                isDark ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-neutral-100 text-neutral-600 border-neutral-300'
              }`}>
                Closed
              </span>
            )}
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${tagColor}`}>
              {marketTag}
            </span>
          </div>
        </button>

        {/* Favorite toggle star button */}
        {onToggleFavorite && (
          <button
            id={`btn-fav-toggle-${sym.symbol}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(sym.symbol);
            }}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              isDark ? 'hover:bg-neutral-800 text-neutral-500' : 'hover:bg-neutral-200 text-neutral-400'
            }`}
            title={isFav ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star 
              className={`w-4 h-4 transition-colors ${
                isFav 
                  ? 'text-amber-400 fill-amber-400' 
                  : isDark ? 'text-neutral-600 hover:text-amber-300' : 'text-neutral-400 hover:text-amber-500'
              }`} 
            />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none backdrop-blur-sm ${
      isDark ? 'bg-black/75' : 'bg-slate-900/40'
    }`}>
      <div 
        id="symbol-modal"
        className={`w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] transition-colors border ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 text-white' 
            : 'bg-white border-neutral-200 text-slate-900'
        }`}
        style={{
          backgroundColor: isDark ? preset.surfaceColor || '#0c0c0e' : '#ffffff',
          borderColor: isDark ? preset.borderColor : '#e2e8f0',
          color: isDark ? preset.textColor : '#0f172a',
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Coins className="w-5 h-5 text-blue-500" />
            Select Trading Asset
          </h3>
          <button 
            id="close-symbol-modal"
            onClick={onClose} 
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-900 text-gray-400 hover:text-white' : 'hover:bg-neutral-100 text-slate-400 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input bar */}
        <div className={`p-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <div className="relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
            <input
              id="symbol-search-input"
              type="text"
              placeholder="Search pairs (e.g. EURUSD, GBPJPY, EURAUD, BTC, Jump)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-11 pr-4 py-2.5 rounded-lg text-sm transition-colors border focus:outline-none focus:border-blue-500 ${
                isDark 
                  ? 'bg-neutral-900 border-neutral-800 text-white placeholder-gray-500' 
                  : 'bg-neutral-50 border-neutral-200 text-slate-900 placeholder-slate-400'
              }`}
              autoFocus
            />
          </div>
        </div>

        {/* Tabs for Category Filters including Favorites & Forex Folders */}
        <div className={`flex px-4 py-2 gap-1 border-b overflow-x-auto scrollbar-none ${
          isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-100/70 border-neutral-200'
        }`}>
          {([
            'favorites', 
            'all', 
            'forex_majors', 
            'forex_minors', 
            'jump', 
            'volatility', 
            'step', 
            'crashboom', 
            'metals', 
            'cryptocurrency'
          ] as const).map((tab) => {
            const label = {
              favorites: '⭐ Favorites',
              all: 'All Assets',
              forex_majors: 'Forex Majors',
              forex_minors: 'Forex Minors',
              jump: 'Jump Indices',
              volatility: 'Volatility Indices',
              step: 'Step Indices',
              crashboom: 'Crash / Boom',
              metals: 'Metals & Gold',
              cryptocurrency: 'Cryptocurrency',
            }[tab];

            const isActive = activeTab === tab;
            const count = tab === 'favorites' ? favorites.length : undefined;

            return (
              <button
                id={`tab-market-${tab}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive 
                    ? tab === 'favorites' 
                      ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-950/40' 
                      : 'bg-blue-600 text-white shadow-md' 
                    : tab === 'favorites'
                      ? isDark ? 'text-amber-400 hover:bg-amber-950/30 hover:text-amber-300' : 'text-amber-700 hover:bg-amber-100 hover:text-amber-900'
                      : isDark ? 'text-gray-400 hover:text-white hover:bg-neutral-900' : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-200/60'
                }`}
              >
                <span>{label}</span>
                {count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive 
                      ? 'bg-black/30 text-black font-bold' 
                      : isDark ? 'bg-neutral-800 text-amber-300' : 'bg-neutral-200 text-amber-800 font-bold'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Symbols List / Favorites Folders area */}
        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2 max-h-[50vh]">
          {activeTab === 'favorites' ? (
            <div className="space-y-4">
              {/* Folder Actions Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span>Favorite Pairs Foldered View</span>
                </div>

                {onCreateFolder && (
                  <div>
                    {!showFolderInput ? (
                      <button
                        onClick={() => setShowFolderInput(true)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-neutral-700 transition-colors"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>New Custom Folder</span>
                      </button>
                    ) : (
                      <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder name..."
                          className="px-2 py-1 bg-neutral-900 border border-amber-500/50 rounded-lg text-xs text-white placeholder-neutral-500 outline-none w-36"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="p-1 bg-amber-500 text-black rounded-lg hover:bg-amber-400"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowFolderInput(false)}
                          className="p-1 text-neutral-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                  <Star className="w-10 h-10 text-neutral-800 mb-2" />
                  <p className="text-sm text-neutral-300 font-semibold">No favorite pairs saved yet</p>
                  <p className="text-xs text-neutral-500 max-w-xs mt-1">
                    Click the star icon (<Star className="w-3 h-3 inline text-amber-400 fill-amber-400" />) next to any trading pair in "All Assets" or market tabs to save it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 1. Custom User Folders */}
                  {Object.entries(customFolders).map(([folderName, folderSymbols]) => {
                    const folderId = `custom_${folderName}`;
                    const isCollapsed = Boolean(collapsedFolders[folderId]);
                    const matchedSymbols = symbols.filter((s) => (folderSymbols as string[]).includes(s.symbol) && isFavorite(s.symbol));

                    return (
                      <div key={folderId} className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden">
                        {/* Folder Header */}
                        <div 
                          onClick={() => toggleFolderCollapse(folderId)}
                          className="px-3.5 py-2.5 bg-neutral-900 border-b border-neutral-800/60 flex items-center justify-between cursor-pointer hover:bg-neutral-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-neutral-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-neutral-400" />
                            )}
                            <Folder className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400/20" />
                            <span className="text-xs font-bold text-white tracking-wide">{folderName}</span>
                            <span className="px-1.5 py-0.2 bg-neutral-800 border border-neutral-700 text-amber-300 rounded text-[10px] font-mono">
                              {matchedSymbols.length} pairs
                            </span>
                          </div>

                          {onDeleteFolder && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFolder(folderName);
                              }}
                              className="p-1 hover:bg-red-950/40 text-neutral-500 hover:text-red-400 rounded transition-colors"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Folder Contents */}
                        {!isCollapsed && (
                          <div className="p-2 space-y-1">
                            {matchedSymbols.length > 0 ? (
                              matchedSymbols.map(renderSymbolRow)
                            ) : (
                              <div className="p-3 text-center text-neutral-500 text-xs italic">
                                Folder is empty. Favorite pairs to populate.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 2. Auto Market Category Folders */}
                  {marketFolders.map((folder) => {
                    const folderId = `market_${folder.id}`;
                    const isCollapsed = Boolean(collapsedFolders[folderId]);
                    const filteredCategoryItems = folder.items.filter((sym) => 
                      sym.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      sym.display_name.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    if (searchTerm && filteredCategoryItems.length === 0) return null;

                    return (
                      <div key={folderId} className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl overflow-hidden">
                        {/* Folder Header */}
                        <div 
                          onClick={() => toggleFolderCollapse(folderId)}
                          className="px-3.5 py-2.5 bg-neutral-900 border-b border-neutral-800/60 flex items-center justify-between cursor-pointer hover:bg-neutral-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-neutral-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-neutral-400" />
                            )}
                            <Folder className="w-4 h-4 text-blue-400 shrink-0 fill-blue-400/20" />
                            <span className="text-xs font-bold text-white tracking-wide">{folder.label}</span>
                            <span className="px-1.5 py-0.2 bg-neutral-800 text-neutral-300 rounded text-[10px] font-mono">
                              {folder.items.length} favorites
                            </span>
                          </div>
                        </div>

                        {/* Folder Contents */}
                        {!isCollapsed && (
                          <div className="p-2 space-y-1">
                            {filteredCategoryItems.map(renderSymbolRow)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'all' ? (
            /* All Assets view with folder or list toggle */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 text-xs text-neutral-400">
                <span>Displaying all available trading pairs organized by market folder</span>
                <button
                  onClick={() => setViewMode(v => v === 'folders' ? 'list' : 'folders')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-xs text-blue-400 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {viewMode === 'folders' ? 'Switch to Flat List' : 'Switch to Folder View'}
                </button>
              </div>

              {viewMode === 'folders' ? (
                marketFolders.map((folder) => {
                  const folderId = `all_market_${folder.id}`;
                  const isCollapsed = Boolean(collapsedFolders[folderId]);
                  const filteredCategoryItems = folder.items.filter((sym) => 
                    sym.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    sym.display_name.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  if (searchTerm && filteredCategoryItems.length === 0) return null;

                  return (
                    <div key={folderId} className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl overflow-hidden">
                      {/* Folder Header */}
                      <div 
                        onClick={() => toggleFolderCollapse(folderId)}
                        className="px-3.5 py-2.5 bg-neutral-900 border-b border-neutral-800/60 flex items-center justify-between cursor-pointer hover:bg-neutral-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                          <Folder className="w-4 h-4 text-blue-400 shrink-0 fill-blue-400/20" />
                          <span className="text-xs font-bold text-white tracking-wide">{folder.label}</span>
                          <span className="px-1.5 py-0.2 bg-neutral-800 text-neutral-300 rounded text-[10px] font-mono">
                            {filteredCategoryItems.length} pairs
                          </span>
                        </div>
                      </div>

                      {/* Folder Contents */}
                      {!isCollapsed && (
                        <div className="p-2 space-y-1">
                          {filteredCategoryItems.map(renderSymbolRow)}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                filteredSymbols.map(renderSymbolRow)
              )}
            </div>
          ) : (
            /* Standard symbol rows for individual category tabs */
            filteredSymbols.length > 0 ? (
              filteredSymbols.map(renderSymbolRow)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                <ShieldAlert className="w-8 h-8 text-neutral-800 mb-2" />
                <p className="text-sm">No assets match your search filters.</p>
                <button 
                  onClick={() => { setSearchTerm(''); setActiveTab('all'); }} 
                  className="mt-3 text-xs text-blue-400 hover:underline"
                >
                  Clear searches
                </button>
              </div>
            )
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-900 rounded-b-xl flex items-center justify-between text-xs text-neutral-500">
          <span>Total assets loaded: <strong>{symbols?.length || 0}</strong> ({(favorites || []).length} favorited)</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Deriv default API live
          </span>
        </div>
      </div>
    </div>
  );
};
