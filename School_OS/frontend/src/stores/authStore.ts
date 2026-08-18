import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  profile_photo?: string;
  default_language: string;
  email_alerts: boolean;
  sms_alerts: boolean;
  is_platform_admin: boolean;
  must_change_password?: boolean;
}

export interface TenantInfo {
  id: string;
  school_name: string;
  education_type: string;
  logo_url: string;
}

export interface RoleInfo {
  tenant_id: string;
  role: string;
  role_display: string;
}

export interface DeviceInfo {
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  tenants: TenantInfo[];
  roles: RoleInfo[];
  sessionId: string | null;
  deviceInfo: DeviceInfo | null;
  pinIsSet: boolean;
  pinVerifiedAt: number | null;
  
  // Actions
  setAuth: (token: string, refreshToken: string, user: User, tenants: TenantInfo[], roles: RoleInfo[], sessionId?: string, deviceInfo?: DeviceInfo) => void;
  setToken: (token: string) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
  fetchPinStatus: () => Promise<void>;
  setPinIsSet: (value: boolean) => void;
  verifyPin: (pin: string) => Promise<boolean>;
  setPinVerified: () => void;
  
  // Selectors/Computed
  isAuthenticated: () => boolean;
  isPinVerificationValid: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      tenants: [],
      roles: [],
      sessionId: null,
      deviceInfo: null,
      pinIsSet: false,
      pinVerifiedAt: null,

      setAuth: (token, refreshToken, user, tenants, roles, sessionId, deviceInfo) =>
        set({ token, refreshToken, user, tenants, roles, sessionId, deviceInfo: deviceInfo || null }),

      setToken: (token) => set({ token }),

      clearMustChangePassword: () =>
        set((state) => ({
          user: state.user ? { ...state.user, must_change_password: false } : state.user,
        })),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, tenants: [], roles: [], sessionId: null, deviceInfo: null }),

      fetchPinStatus: async () => {
        try {
          const res = await api.get('/auth/pin/');
          set({ pinIsSet: res.data.pin_is_set });
        } catch {
          set({ pinIsSet: false });
        }
      },

      setPinIsSet: (value) => set({ pinIsSet: value }),

      verifyPin: async (pin: string) => {
        const res = await api.post('/auth/pin/verify/', { pin });
        if (res.data.verification_token) {
          set({ pinVerifiedAt: Date.now() });
          return true;
        }
        return false;
      },

      setPinVerified: () => set({ pinVerifiedAt: Date.now() }),

      isAuthenticated: () => !!get().token,

      isPinVerificationValid: () => {
        const { pinVerifiedAt } = get();
        if (!pinVerifiedAt) return false;
        return Date.now() - pinVerifiedAt < 30 * 60 * 1000;
      },
    }),
    {
      name: 'sos-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tenants: state.tenants,
        roles: state.roles,
        sessionId: state.sessionId,
      }),
    }
  )
);
