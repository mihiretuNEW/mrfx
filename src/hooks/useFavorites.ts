import { useState, useEffect } from 'react';

export interface FavoriteFolders {
  [folderName: string]: string[];
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_favorite_symbols');
      if (saved) return JSON.parse(saved);
      // Default initialized favorites (Gold XAUUSD first)
      return ['frxXAUUSD', 'frxEURUSD', 'R_100', '1HZ100V', 'cryBTCUSD'];
    } catch {
      return ['frxXAUUSD', 'frxEURUSD', 'R_100', '1HZ100V'];
    }
  });

  const [customFolders, setCustomFolders] = useState<FavoriteFolders>(() => {
    try {
      const saved = localStorage.getItem('mihiretu_favorite_folders');
      if (saved) return JSON.parse(saved);
      return {
        'Top Picks': ['frxXAUUSD', 'frxEURUSD', 'R_100', '1HZ100V']
      };
    } catch {
      return {};
    }
  });

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mihiretu_favorite_symbols', JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorite symbols:', e);
    }
  }, [favorites]);

  // Save custom folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mihiretu_favorite_folders', JSON.stringify(customFolders));
    } catch (e) {
      console.error('Failed to save favorite folders:', e);
    }
  }, [customFolders]);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      if (prev.includes(symbol)) {
        // Remove from favorites
        return prev.filter((s) => s !== symbol);
      } else {
        // Add to favorites
        return [...prev, symbol];
      }
    });
  };

  const isFavorite = (symbol: string) => favorites.includes(symbol);

  const createFolder = (folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    setCustomFolders((prev) => {
      if (prev[trimmed]) return prev;
      return { ...prev, [trimmed]: [] };
    });
  };

  const deleteFolder = (folderName: string) => {
    setCustomFolders((prev) => {
      const copy = { ...prev };
      delete copy[folderName];
      return copy;
    });
  };

  const toggleSymbolInFolder = (symbol: string, folderName: string) => {
    setCustomFolders((prev) => {
      const existing = prev[folderName] || [];
      const updated = existing.includes(symbol)
        ? existing.filter((s) => s !== symbol)
        : [...existing, symbol];
      return { ...prev, [folderName]: updated };
    });
  };

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    customFolders,
    createFolder,
    deleteFolder,
    toggleSymbolInFolder,
  };
}
