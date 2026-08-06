import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      partialize: (state) => ({ activeSectionId: state.activeSectionId }),
    }
  )
);
