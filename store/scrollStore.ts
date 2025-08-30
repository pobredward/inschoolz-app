import { create } from 'zustand';

interface ScrollPosition {
  y: number;
  timestamp: number;
}

interface ScrollStore {
  scrollPositions: Record<string, ScrollPosition>;
  saveScrollPosition: (key: string, position: number) => void;
  getScrollPosition: (key: string) => number;
  clearScrollPosition: (key: string) => void;
  clearAllScrollPositions: () => void;
}

export const useScrollStore = create<ScrollStore>((set, get) => ({
  scrollPositions: {},
  
  saveScrollPosition: (key: string, position: number) => {
    set((state) => ({
      scrollPositions: {
        ...state.scrollPositions,
        [key]: {
          y: position,
          timestamp: Date.now(),
        },
      },
    }));
  },
  
  getScrollPosition: (key: string) => {
    const position = get().scrollPositions[key];
    if (!position) return 0;
    
    // 10분 이후에는 스크롤 위치를 삭제 (너무 오래된 위치는 의미 없음)
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - position.timestamp > tenMinutes) {
      get().clearScrollPosition(key);
      return 0;
    }
    
    return position.y;
  },
  
  clearScrollPosition: (key: string) => {
    set((state) => {
      const newPositions = { ...state.scrollPositions };
      delete newPositions[key];
      return { scrollPositions: newPositions };
    });
  },
  
  clearAllScrollPositions: () => {
    set({ scrollPositions: {} });
  },
}));
