import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';

export interface AdminSection {
  id: string;
  name: string;
  language: string;
}

interface SectionState {
  sections: AdminSection[];
  activeSectionId: string | null;
  loading: boolean;
  setSections: (sections: AdminSection[]) => void;
  setActiveSectionId: (id: string | null) => void;
  fetchSections: (tenantId: string) => Promise<void>;
}

const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      const value = localStorage.getItem(name);
      if (!value) return null;
      const parsed = JSON.parse(value);
      // Validate the structure - we only persist activeSectionId which should be a string or null
      if (parsed.state && typeof parsed.state.activeSectionId === 'string') {
        return value;
      }
      if (parsed.state && parsed.state.activeSectionId === null) {
        return value;
      }
      // If invalid, remove it
      localStorage.removeItem(name);
      return null;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore
    }
  },
};

export const useSectionStore = create<SectionState>()(
  persist(
    (set, get) => ({
      sections: [],
      activeSectionId: null,
      loading: false,

      setSections: (sections) => set({ sections }),

      setActiveSectionId: (id) => set({ activeSectionId: id }),

      fetchSections: async (tenantId) => {
        if (!tenantId) return;
        set({ loading: true });
        try {
          const { api } = await import('../services/api');
          const response = await api.get('/academic/sections/');
          const raw = response.data?.results || response.data || [];
          const sections: AdminSection[] = Array.isArray(raw) ? raw : [];
          const current = get().activeSectionId;

          let next = current;
          if (!next || !sections.some(s => s.id === next)) {
            next = sections.length > 0 ? sections[0].id : null;
          }
          set({ sections, activeSectionId: next, loading: false });
        } catch {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'sos-section-storage',
      storage: safeStorage,
      partialize: (state) => ({ activeSectionId: state.activeSectionId }),
    }
  )
);
