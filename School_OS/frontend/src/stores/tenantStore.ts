import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface SchoolConfig {
  currency_code: string;
  currency_symbol: string;
  grading_scale_max: number;
  grade_a_threshold: number;
  grade_b_threshold: number;
  grade_c_threshold: number;
  promotion_cutoff: number;
  payment_methods: string[];
  default_language: string;
  phone_format_placeholder: string;
}

const DEFAULT_CONFIG: SchoolConfig = {
  currency_code: 'XAF',
  currency_symbol: 'XAF',
  grading_scale_max: 20,
  grade_a_threshold: 16,
  grade_b_threshold: 12,
  grade_c_threshold: 10,
  promotion_cutoff: 9.5,
  payment_methods: ['mtn_momo', 'orange_money', 'bank_transfer'],
  default_language: 'en',
  phone_format_placeholder: '6XX XXX XXX',
};

interface TenantState {
  activeTenantId: string | null;
  themeConfig: ThemeConfig | null;
  schoolConfig: SchoolConfig;
  configLoaded: boolean;
  
  setActiveTenantId: (id: string) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  fetchSchoolConfig: (tenantId: string) => Promise<void>;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      activeTenantId: null,
      themeConfig: null,
      schoolConfig: DEFAULT_CONFIG,
      configLoaded: false,

      setActiveTenantId: (id) => set({ activeTenantId: id, configLoaded: false }),
      setThemeConfig: (themeConfig) => set({ themeConfig }),

      fetchSchoolConfig: async (tenantId: string) => {
        if (get().configLoaded && get().activeTenantId === tenantId) return;
        try {
          const res = await api.get(`/tenants/${tenantId}/school_config/`);
          set({ schoolConfig: { ...DEFAULT_CONFIG, ...res.data }, configLoaded: true });
        } catch {
          set({ schoolConfig: DEFAULT_CONFIG, configLoaded: true });
        }
      },
    }),
    {
      name: 'sos-tenant-storage',
    }
  )
);
