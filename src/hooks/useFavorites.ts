import { useCallback, useState } from 'react';

// Избранные матчи (по id). Хранятся только в памяти, пока открыто приложение.
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  const isFavorite = (id: string) => favorites.includes(id);

  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const index = prev.indexOf(id);
      if (index === -1) {
        return [...prev, id];
      }
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  }, []);

  return { favorites, isFavorite, toggle };
}
