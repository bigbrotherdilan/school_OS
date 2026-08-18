import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { type ThemeConfig, DEFAULT_THEME } from '../utils/theme';

export interface SchoolConfig {
  currency_code: string;
  currency_symbol: string;
  grading_scale_max: number;
  grade_a_threshold: number;
  grade_b_threshold: number;
  grade_c_threshold: number;
  promotion_cutoff: number;
  payment_methods: string[];
  finance_recording: 'admin_and_bursar' | 'bursar_only';
  default_language: string;
  phone_format_placeholder: string;
}

export interface SchoolInfo {
  school_name: string;
  motto: string;
  phone: string;
  email: string;
  address: string;
  region: string;
  division: string;
  country: string;
  postal_code: string;
  education_type: string;
  school_type: string;
  session_type: string;
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
  finance_recording: 'admin_and_bursar',
  default_language: 'en',
  phone_format_placeholder: '6XX XXX XXX',
};

interface TenantState {
  activeTenantId: string | null;
  themeConfig: ThemeConfig | null;
  themeTenantId: string | null;
  draftTheme: ThemeConfig | null;
  logoUrl: string | null;
  schoolConfig: SchoolConfig;
  configLoaded: boolean;
  schoolInfo: SchoolInfo | null;
  
  setActiveTenantId: (id: string) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  setDraftTheme: (config: ThemeConfig | null) => void;
  fetchSchoolConfig: (tenantId: string) => Promise<void>;
  patchSchoolConfig: (patch: Partial<SchoolConfig>) => Promise<void>;
  fetchThemeConfig: (tenantId: string) => Promise<void>;
  updateThemeConfig: (patch: Partial<ThemeConfig>) => Promise<void>;
  uploadLogo: (tenantId: string, file: File) => Promise<string>;
  fetchSchoolInfo: (tenantId: string) => Promise<void>;
  updateSchoolInfo: (patch: Partial<SchoolInfo>) => Promise<void>;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      activeTenantId: null,
      themeConfig: null,
      themeTenantId: null,
      draftTheme: null,
      logoUrl: null,
      schoolConfig: DEFAULT_CONFIG,
      configLoaded: false,
      schoolInfo: null,

      setActiveTenantId: (id) => set({ activeTenantId: id, configLoaded: false }),
      setThemeConfig: (themeConfig) => set({ themeConfig }),
      setDraftTheme: (draftTheme) => set({ draftTheme }),

      fetchSchoolConfig: async (tenantId: string) => {
        if (get().configLoaded && get().activeTenantId === tenantId) return;
        try {
          const res = await api.get(`/tenants/${tenantId}/school_config/`);
          set({ schoolConfig: { ...DEFAULT_CONFIG, ...res.data }, configLoaded: true });
        } catch {
          set({ schoolConfig: DEFAULT_CONFIG, configLoaded: true });
        }
      },

      patchSchoolConfig: async (patch: Partial<SchoolConfig>) => {
        const tenantId = get().activeTenantId;
        if (!tenantId) throw new Error('No active tenant.');
        const res = await api.patch(`/tenants/${tenantId}/school_config/`, patch);
        set({ schoolConfig: { ...get().schoolConfig, ...res.data }, configLoaded: true });
      },

      fetchThemeConfig: async (tenantId: string) => {
        try {
          const res = await api.get(`/tenants/${tenantId}/config/`);
          const theme = res.data?.theme || {};
          set({
            themeConfig: {
              primaryColor: theme.primaryColor || DEFAULT_THEME.primaryColor,
              secondaryColor: theme.secondaryColor || DEFAULT_THEME.secondaryColor,
              accentColor: theme.accentColor || DEFAULT_THEME.accentColor,
              fontFamily: theme.fontFamily || DEFAULT_THEME.fontFamily,
            },
            themeTenantId: tenantId,
            logoUrl: res.data?.logo_url || null,
          });
        } catch {
          set({ themeConfig: null, themeTenantId: null, logoUrl: null });
        }
      },

      updateThemeConfig: async (patch: Partial<ThemeConfig>) => {
        const tenantId = get().activeTenantId;
        if (!tenantId) throw new Error('No active tenant.');
        const next: ThemeConfig = { ...DEFAULT_THEME, ...get().themeConfig, ...patch };
        await api.patch(`/tenants/${tenantId}/theme/`, { theme_config: next });
        set({ themeConfig: next, themeTenantId: tenantId });
      },

      uploadLogo: async (tenantId: string, file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post(`/tenants/${tenantId}/logo/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res.data?.logo_url || '';
        set({ logoUrl: url });
        return url;
      },

      fetchSchoolInfo: async (tenantId: string) => {
        try {
          const res = await api.get(`/tenants/${tenantId}/school-info/`);
          set({ schoolInfo: res.data });
        } catch {
          set({ schoolInfo: null });
        }
      },

      updateSchoolInfo: async (patch: Partial<SchoolInfo>) => {
        const tenantId = get().activeTenantId;
        if (!tenantId) throw new Error('No active tenant.');
        const res = await api.patch(`/tenants/${tenantId}/school-info/`, patch);
        set({ schoolInfo: res.data });
      },
    }),
    {
      name: 'sos-tenant-storage',
      partialize: (state) => {
        const { draftTheme: _draft, ...rest } = state;
        return rest;
      },
    }
  )
);
